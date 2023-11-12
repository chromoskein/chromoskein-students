import type { Allocator, GraphicsLibrary } from "../../..";
import type { BoundingBox, Ray } from "../../../shared";
import { IParametricObject } from "./shared";
import * as r from 'restructure';
import { mat4, vec3, vec4 } from "gl-matrix";
import { padVolume } from "./volumeHelpers";
import { volumeFromPathlines } from "./volumeFromPathlines";

class Pipelines {
    private static _instance: Pipelines;
    private static _lastDeviceUsed: GPUDevice;

    public shaderModules: Map<string, GPUShaderModule>;
    public bindGroupLayouts: Map<string, GPUBindGroupLayout>;
    public pipelineLayouts: Map<string, GPUPipelineLayout>;
    public renderPipelines: Map<string, GPURenderPipeline>;
    public computePipelines: Map<string, GPUComputePipeline>;

    private constructor(graphicsLibrary: GraphicsLibrary) {
        const device = graphicsLibrary.device;

        this.shaderModules = new Map();
        this.bindGroupLayouts = new Map();
        this.pipelineLayouts = new Map();
        this.renderPipelines = new Map();
        this.computePipelines = new Map();

        const volumeFromPathlinesBGL = device.createBindGroupLayout({
            label: `VolumeFromPathlines`,
            entries: [{
                binding: 0,
                visibility: GPUShaderStage.COMPUTE,
                buffer: { type: 'uniform' },
            },
            {
                binding: 1,
                visibility: GPUShaderStage.COMPUTE,
                buffer: { type: 'read-only-storage' },
            },
            {
                binding: 2,
                visibility: GPUShaderStage.COMPUTE,
                buffer: { type: 'read-only-storage' },
            },
            {
                binding: 3,
                visibility: GPUShaderStage.COMPUTE,
                buffer: { type: 'read-only-storage' },
            },
            {
                binding: 4,
                visibility: GPUShaderStage.COMPUTE,
                buffer: { type: 'read-only-storage' },
            },
            {
                binding: 5,
                visibility: GPUShaderStage.COMPUTE,
                storageTexture: {
                    format: 'rgba8unorm',
                    access: 'write-only',
                    viewDimension: "3d"
                }
            }]
        });

        const volumeFromPathlinesPL = device.createPipelineLayout({
            bindGroupLayouts: [volumeFromPathlinesBGL]
        });

        this.bindGroupLayouts.set('volumeFromPathlines', volumeFromPathlinesBGL);
        this.pipelineLayouts.set('volumeFromPathlines', volumeFromPathlinesPL)

        const volumeFromPathlinesModule = device.createShaderModule({
            code: volumeFromPathlines(),
        });
        this.shaderModules.set('volumeFromPathlines', volumeFromPathlinesModule);

        this.computePipelines.set('volumeFromPathlines', device.createComputePipeline({
            layout: volumeFromPathlinesPL,
            compute: {
                module: volumeFromPathlinesModule,
                entryPoint: 'main',
            }
        }));

        Pipelines._lastDeviceUsed = graphicsLibrary.device;
    }

    public static getInstance(graphicsLibrary: GraphicsLibrary): Pipelines {
        if (this._instance && Pipelines._lastDeviceUsed == graphicsLibrary.device) {
            return this._instance;
        }

        return this._instance = new this(graphicsLibrary);
    }
}

export interface VolumeProperties {
    modelMatrix: mat4,
    modelMatrixInverse: mat4,
    color: vec4,
    translate: vec4,
    scale: vec4,
    transparency: number,
    func: number,
    frameID: number,
}

const VolumeUniformSize = 188;

export const VolumeStruct = new r.Struct({
    modelMatrix: new r.Array(r.floatle, 16),
    modelMatrixInverse: new r.Array(r.floatle, 16),
    color: new r.Array(r.floatle, 4),
    translate: new r.Array(r.floatle, 4),
    scale: new r.Array(r.floatle, 4),
    transparency: r.floatle,
    func: r.uint32le,
    frameID: r.uint32le,
});

export const VolumeTextureSize: number = 64;

export class Volume extends IParametricObject {
    private _pipelines: Pipelines;

    public static variableName = 'volume';
    public static typeName = 'Volume';

    public getVariableName(): string { return Volume.variableName };
    public getTypeName(): string { return Volume.typeName };

    static bindGroupLayouts: Array<GPUBindGroupLayout> = [];
    static createBindGroupLayouts(device: GPUDevice): void {
        Volume.bindGroupLayouts = [device.createBindGroupLayout({
            label: this.typeName,
            entries: [{
                binding: 0,
                visibility: GPUShaderStage.VERTEX | GPUShaderStage.FRAGMENT,
                buffer: { type: 'read-only-storage' },
            }, {
                binding: 1,
                visibility: GPUShaderStage.FRAGMENT,
                texture: {
                    viewDimension: "3d"
                }
            }, {
                binding: 2,
                visibility: GPUShaderStage.FRAGMENT,
                sampler: {
                    type: 'filtering'
                }
            }, {
                binding: 3,
                visibility: GPUShaderStage.FRAGMENT,
                texture: {
                    viewDimension: "2d"
                }
            }, {
                binding: 4,
                visibility: GPUShaderStage.FRAGMENT,
                texture: { sampleType: "unfilterable-float", viewDimension: "2d" }
            },
            {
                binding: 5,
                visibility: GPUShaderStage.FRAGMENT,
                storageTexture: {
                    // Would be great to have read-write back
                    access: "write-only",
                    format: "rgba32float"
                }
            }]
        }),
        device.createBindGroupLayout({
            label: this.typeName,
            entries: [{
                binding: 0,
                visibility: GPUShaderStage.FRAGMENT,
                texture: {
                    viewDimension: "2d",
                    sampleType: "depth"
                }
            }]
        })
        ];
    }

    static accumulationTextures: [GPUTexture, GPUTexture] | null = null;

    public properties: VolumeProperties[];

    //#region GPU Code
    public static gpuCodeGlobals = /* wgsl */`
        struct ${this.typeName} {
            modelMatrix: mat4x4<f32>,
            modelMatrixInverse: mat4x4<f32>,
            color: vec4<f32>,
            translate: vec4<f32>,
            scale: vec4<f32>,
            transparency: f32,
            func: u32,
            frameID: u32,
        };
        
        @group(1) @binding(0) var<storage, read> ${this.variableName}: array<${this.typeName}>;
        @group(1) @binding(1) var ${this.variableName}Texture: texture_3d<f32>;
        @group(1) @binding(2) var linearSampler: sampler;
        @group(1) @binding(3) var colormap: texture_2d<f32>;
        @group(1) @binding(4) var accum_buffer_in: texture_2d<f32>;
        @group(1) @binding(5) var accum_buffer_out: texture_storage_2d<rgba32float, write>;

        const M_PI: f32 = 3.14159265358979323846;
    `;

    public static gpuCodeGetObject = ``;
    public static gpuCodeGetObjectUntypedArray = ``;

    static gpuCodeIntersectionTest = /* wgsl */`
        fn rayUnitBoxIntersection(ray: Ray) -> vec2<f32> {
            let tMin = (vec3<f32>(-1.0) - ray.origin) / ray.direction;
            let tMax = (vec3<f32>(1.0) - ray.origin) / ray.direction;

            let t1 = min(tMin, tMax);
            let t2 = max(tMin, tMax);

            let tN = max( max( t1.x, t1.y ), t1.z );
            let tF = min( min( t2.x, t2.y ), t2.z );

            return vec2(tN, tF);
        }

        fn ray${this.typeName}Intersection(ray: Ray, ${this.variableName}: ${this.typeName}) -> Intersection {
            let rayOriginLocalSpace = (${this.variableName}.modelMatrixInverse * vec4<f32>(ray.origin, 1.0)).xyz;
            let rayDirectionLocalSpace = normalize(${this.variableName}.modelMatrixInverse * vec4<f32>(ray.direction, 0.0)).xyz;

            let tMin = (vec3<f32>(-1.0) - rayOriginLocalSpace) / rayDirectionLocalSpace;
            let tMax = (vec3<f32>(1.0) - rayOriginLocalSpace) / rayDirectionLocalSpace;

            let t1 = min(tMin, tMax);
            let t2 = max(tMin, tMax);

            let tN = max( max( t1.x, t1.y ), t1.z );
            let tF = min( min( t2.x, t2.y ), t2.z );

            if(tN > tF) {
                return Intersection(
                    -1.0,
                    vec3<f32>(0.0),
                    vec3<f32>(0.0),
                );
            }

            var normal = vec3<f32>(0.0);
            if (tN > 0.0) {
                normal = step(vec3<f32>(tN), t1);
            } else {
                normal = step(t2, vec3<f32>(tF));
            }
            normal = normal * (-sign(rayDirectionLocalSpace.xyz));

            let t = max(tN, 0.0);
            let intersection = rayOriginLocalSpace + t * rayDirectionLocalSpace;

            return Intersection(
                t,
                (${this.variableName}.modelMatrix * vec4<f32>(intersection, 1.0)).xyz,
                normal
            );
        }
    `;

    static gpuCodeGetOutputValue(variable: 'color' | 'normal' | 'ao'): string {
        switch (variable) {
            case 'color': {
                return /* wgsl */`
                    var color = vec4<f32>(0.0);

                    //let rayOriginLocalSpace = (${this.variableName}[0].modelMatrixInverse * vec4<f32>(ray.origin, 1.0)).xyz;
                    //let rayDirectionLocalSpace = normalize(${this.variableName}[0].modelMatrixInverse * vec4<f32>(ray.direction, 0.0)).xyz;
                    // The volume object is normalized and situated at origin so no need to transform ray
                    let rayOriginLocalSpace = (vec4<f32>(ray.origin, 1.0)).xyz;
                    let rayDirectionLocalSpace = normalize(vec4<f32>(ray.direction, 0.0)).xyz;

                    let rayLocalSpace = Ray(rayOriginLocalSpace, rayDirectionLocalSpace);

                    var t_interval = rayUnitBoxIntersection(rayLocalSpace);
                    if (t_interval.x > t_interval.y) {
                        discard;
                    }
                    t_interval.x = max(t_interval.x, 0.0);

                    // Previous t
                    let previousDepth: f32 = textureLoad(depthTexture, vec2<u32>(vertexOuput.Position.xy), 0);

                    // Step 3: Compute the step size to march through the volume grid
                    let dt_vec = 1.0 / (vec3(${VolumeTextureSize}) * abs(rayDirectionLocalSpace));
                    let dt = min(dt_vec.x, min(dt_vec.y, dt_vec.z));

                    // Step 4: Starting from the entry point, march the ray through the volume
                    // and sample it
                    var p = rayOriginLocalSpace + t_interval.x * rayDirectionLocalSpace;
                    var t = t_interval.x;
                    var intersectionWorldSpace = vec3(0.0);
                    var depth = 0.0;
                    for (; t < t_interval.y; t += dt) {
                        // Step 4.1: Sample the volume, and color it by the transfer function.
                        // Note that here we don't use the opacity from the transfer function,
                        // and just use the sample value as the opacity
                        let p = rayOriginLocalSpace + t * rayDirectionLocalSpace;
                        var p_tex = 0.5 * p + vec3(0.5);
                        //var p_tex = vec3<u32>(floor((0.5 * p + vec3(0.5)) * ${VolumeTextureSize}));
                        //var pp_tex = 0.5 * p + vec3(0.5);

                        p_tex.z = p_tex.z / f32(arrayLength(&${this.variableName}));

                        var value = 0.0;
                        for(var i: u32 = 0; i < arrayLength(&${this.variableName}); i++) {
                            var texValue = 0.0;
                            if (${this.variableName}[0].func == 0) {
                                //texValue = textureLoad(${this.variableName}Texture, p_tex + vec3<u32>(0, 0, i * ${VolumeTextureSize}), 0).g;
                                texValue = textureSampleLevel(${this.variableName}Texture, linearSampler, p_tex + vec3<f32>(0.0, 0.0, f32(i) / f32(arrayLength(&${this.variableName}))), 0.0).g;
                            } else {
                                //texValue = textureLoad(${this.variableName}Texture, p_tex + vec3<u32>(0, 0, i * ${VolumeTextureSize}), 0).b;
                                texValue = textureSampleLevel(${this.variableName}Texture, linearSampler, p_tex + vec3<f32>(0.0, 0.0, f32(i) / f32(arrayLength(&${this.variableName}))), 0.0).b;
                            }
                            value += texValue;
                        }

                        //value = textureSampleLevel(${this.variableName}Texture, linearSampler, pp_tex, 0.0).g;
                        // let value = textureSampleLevel(${this.variableName}Texture, linearSampler, 0.5 * p + vec3(0.5), 0.0).r;
                        // let lastTimestep = textureSampleLevel(${this.variableName}Texture, linearSampler, 0.5 * p + vec3(0.5), 0.0).g;
                        // let stepsCount = textureSampleLevel(${this.variableName}Texture, linearSampler, 0.5 * p + vec3(0.5), 0.0).b;

                        // Version simple based on last timestep
                        let tf = textureSampleLevel(colormap, linearSampler, vec2<f32>(value, 0.5), 0.0).rgb;
                        let val_color = vec4(tf, ${this.variableName}[0].transparency * value);

                        // Version Threshold
                        // let tf = textureSampleLevel(colormap, linearSampler, vec2<f32>(lastTimestep, 0.5), 0.0).rgb;
                        // var val_color = vec4(tf, lastTimestep);

                        // if (stepsCount > 100) {
                        //     val_color = vec4(0.0);
                        //     // val_color.a = 0.0;
                        // }

                        // Version Combination
                        // let tf = textureSampleLevel(colormap, linearSampler, vec2<f32>(lastTimestep, 0.5), 0.0).rgb;
                        // let val_color = vec4(mix(tf, vec3(1.0), stepsCount), 0.5 * stepsCount);

                        // Step 4.2: Accumulate the color and opacity using the front-to-back
                        // compositing equation
                        color.r = color.r + (1.0 - color.a) * val_color.a * val_color.r;
                        color.g += (1.0 - color.a) * val_color.a * val_color.g;
                        color.b += (1.0 - color.a) * val_color.a * val_color.b;
                        color.a += (1.0 - color.a) * val_color.a;

                        //intersection.t = t;
                        intersectionWorldSpace = camera.position.xyz + t * ray.direction.xyz;
                        var depthVec = camera.projectionView * vec4<f32>(intersectionWorldSpace.xyz, 1.0);
                        depthVec = depthVec * (1.0 / depthVec.w);
                        depth = depthVec.z;

                        // Optimization: break out of the loop when the color is near opaque
                        if (color.a >= 0.95 || depth < previousDepth) {
                            break;
                        }                        
                    }                    

                    // Temporary solution to a larger problem
                    if (color.a < 0.05) {
                        discard;
                    }
                    // if (depth < previousDepth) {
                    //     color = vec4(1.0, 1.0 - color.a, 0.0, 1.0 - color.a);
                    // } else {
                    //     let depthDifference = 50.0 * abs(depth - previousDepth);
                    //     color = vec4(depthDifference, depthDifference, depthDifference, 1.0);
                    // }
                `;
            }
            case 'normal': {
                return /* wgsl */`
                    let normal = intersection.normal;
                `;
            }
            case 'ao': {
                return /* wgsl */`
                    let ao = vec2(0.0, 0.0);
                `;
            }
        }
    }

    static gpuCodeGetBoundingRectangleVertex = `
        let begin = ${this.variableName}[0].modelMatrix * vec4<f32>(-1.0, -1.0, -1.0, 1.0);
        let end = ${this.variableName}[0].modelMatrix * vec4<f32>(1.0);

        let center = 0.5 * (begin.xyz + end.xyz);
        let radius = distance(center, begin.xyz);

        let boundingRectangleVertex = sphereToBoundingRectangleVertex(center.xyz, radius, vertexIndex);
    `;
    //#endregion GPU Code

    public rayIntersection(ray: Ray): number | null {
        return null;
    };

    public toBoundingBoxes(): BoundingBox[] {
        return [];
    }

    private _textureSize: number = VolumeTextureSize;
    private _texture: GPUTexture | null = null;
    private _colorMap: GPUTexture | null = null;

    constructor(id: number, graphicsLibrary: GraphicsLibrary, allocator: Allocator, instances: number = 1) {
        super(id, graphicsLibrary, allocator);

        this._pipelines = Pipelines.getInstance(graphicsLibrary);

        this._allocation = allocator.allocate(VolumeUniformSize * instances);

        this.properties = new r.Array(VolumeUniformSize, instances);
        for (let i = 0; i < instances; i++){
            this.properties[i] = VolumeStruct.fromBuffer(new Uint8Array(VolumeUniformSize));
            this.properties[i].modelMatrix = mat4.create();
            this.properties[i].modelMatrixInverse = mat4.invert(mat4.create(), this.properties[i].modelMatrix);
            this.properties[i].color = vec4.fromValues(1.0, 1.0, 1.0, 1.0);
            this.properties[i].translate = vec4.fromValues(0.0, 0.0, 0.0, 0.0);
            this.properties[i].scale = vec4.fromValues(1.0, 1.0, 1.0, 1.0);
            this.properties[i].func = 0;
            this.properties[i].transparency = 1.0;
        }
        this.onAllocationMoved();
    }

    public fromCPUGrid(grid: Uint8Array, size: number) {
        this._textureSize = size;

        this._texture = this._graphicsLibrary.device.createTexture({
            size: {
                width: this._textureSize,
                height: this._textureSize,
                depthOrArrayLayers: this._textureSize,
            },
            mipLevelCount: 1,
            dimension: "3d",
            format: "r8unorm",
            usage: GPUTextureUsage.TEXTURE_BINDING | GPUTextureUsage.COPY_DST,
        });

        let paddedGrid = grid;
        if (size % 256 != 0) {
            paddedGrid = padVolume(grid, [size, size, size]);
        }

        this._graphicsLibrary.device.queue.writeTexture(
            { texture: this._texture },
            paddedGrid.buffer,
            {
                bytesPerRow: 256,
                rowsPerImage: this._textureSize,
            },
            {
                width: this._textureSize,
                height: this._textureSize,
                depthOrArrayLayers: this._textureSize,
            },
        );

        this.setDirtyCPU();
        this.onAllocationMoved();
    }

    public fromPointArrays(device: GPUDevice, points: vec3[][][], radius: number = 0.05) {
        const pipeline = this._pipelines.computePipelines.get('volumeFromPathlines');
        const bgl = this._pipelines.bindGroupLayouts.get('volumeFromPathlines');

        if (!pipeline || !bgl) return;

        this._textureSize = VolumeTextureSize;

        this._texture = this._graphicsLibrary.device.createTexture({
            size: {
                width: this._textureSize,
                height: this._textureSize,
                depthOrArrayLayers: this._textureSize * points.length,
            },
            mipLevelCount: 1,
            dimension: "3d",
            format: "rgba8unorm",
            usage: GPUTextureUsage.STORAGE_BINDING | GPUTextureUsage.TEXTURE_BINDING | GPUTextureUsage.COPY_DST,
        });

        const delimitersCPUBuffer = new Uint32Array(points.length);
        const timestepCountCPUBuffer = new Uint32Array(points.length);
        const pointsCountCPUBuffer = new Uint32Array(points.length);

        let totalPoints = 0;
        for(let i = 0; i < points.length; i++) {
            delimitersCPUBuffer.set([totalPoints], i);
            totalPoints += points[i].length * points[i][0].length;
            timestepCountCPUBuffer.set([points[i].length], i);
            pointsCountCPUBuffer.set([points[i][0].length], i);
        }
        
        let pointsFlat = points.flat().flat();
        const pointsCPUBuffer = new Float32Array(pointsFlat.length * 4);
        for (let i = 0; i < pointsFlat.length; i++) {
            pointsCPUBuffer.set(pointsFlat[i], 4 * i);
        }

        const globalsCPUBuffer = new ArrayBuffer(64);
        const globalsCPUBufferF32 = new Float32Array(globalsCPUBuffer);
        //const globalsCPUBufferU32 = new Uint32Array(globalsCPUBuffer);
        globalsCPUBufferF32[0] = radius;
        //globalsCPUBufferU32[1] = points.length;
        //globalsCPUBufferU32[2] = points[0].length;

        const globalsBuffer = device.createBuffer({ size: 64, usage: GPUBufferUsage.COPY_DST | GPUBufferUsage.UNIFORM });
        const pointsBuffer = device.createBuffer({ size: pointsFlat.length * 4 * 4, usage: GPUBufferUsage.COPY_DST | GPUBufferUsage.STORAGE });
        const delimitersBuffer = device.createBuffer({ size: points.length * 4, usage: GPUBufferUsage.COPY_DST | GPUBufferUsage.STORAGE });
        const timestepCountsBuffer = device.createBuffer({ size: points.length * 4, usage: GPUBufferUsage.COPY_DST | GPUBufferUsage.STORAGE });
        const pointsCountBuffer = device.createBuffer({ size: points.length * 4, usage: GPUBufferUsage.COPY_DST | GPUBufferUsage.STORAGE });
        const bindGroup = device.createBindGroup({
            layout: bgl,
            entries: [{
                binding: 0,
                resource: { buffer: globalsBuffer }
            }, {
                binding: 1,
                resource: { buffer: pointsBuffer }
            },  {
                binding: 2,
                resource: { buffer: delimitersBuffer }
            }, {
                binding: 3,
                resource: { buffer: timestepCountsBuffer }
            }, {
                binding: 4,
                resource: { buffer: pointsCountBuffer }
            }, {
                binding: 5,
                resource: this._texture.createView()
            }]
        });

        device.queue.writeBuffer(globalsBuffer, 0, globalsCPUBuffer, 0);
        device.queue.writeBuffer(pointsBuffer, 0, pointsCPUBuffer, 0);
        device.queue.writeBuffer(delimitersBuffer, 0, delimitersCPUBuffer, 0);
        device.queue.writeBuffer(timestepCountsBuffer, 0, timestepCountCPUBuffer, 0);
        device.queue.writeBuffer(pointsCountBuffer, 0, pointsCountCPUBuffer, 0);
        const commandEncoder = device.createCommandEncoder();
        const computePass = commandEncoder.beginComputePass();
        computePass.setPipeline(pipeline);
        computePass.setBindGroup(0, bindGroup);
        computePass.dispatchWorkgroups(16, 16, 16 * points.length);
        computePass.end();

        device.queue.submit([commandEncoder.finish()]);

        this.onAllocationMoved();
    }

    public fromPoints(device: GPUDevice, points: vec3[][], radius: number = 0.05) {
        this.fromPointArrays(device, [points], radius);
    }

    public async setColorMapFromBitmap(bitmap: ImageBitmap) {
        let texture = this._graphicsLibrary.device.createTexture({
            size: [bitmap.width, bitmap.height, 1],
            format: "rgba8unorm",
            usage: GPUTextureUsage.TEXTURE_BINDING | GPUTextureUsage.COPY_DST | GPUTextureUsage.RENDER_ATTACHMENT
        });

        let src = { source: bitmap };
        let dst = { texture: texture };

        this._graphicsLibrary.device.queue.copyExternalImageToTexture(src, dst, [bitmap.width, bitmap.height]);

        this._colorMap = texture;

        this.setDirtyCPU();
        this.onAllocationMoved();
    }

    public set transparency(a: number) {
        for (let i = 0; i < this.properties.length; i++) {
            this.properties[i].transparency = a;
        }
    }

    public set func(f: number) {
        for (let i = 0; i < this.properties.length; i++) {
            this.properties[i].func = f;
        }
    }

    public set translate(t: vec3) {
        this.translateIndex(t, 0);
    }

    public translateIndex(t: vec3, index: number) {
        this.properties[index].translate = [t[0], t[1], t[2], 1.0];
        this.properties[index].modelMatrix = mat4.create();

        mat4.scale(this.properties[index].modelMatrix, this.properties[index].modelMatrix, vec3.fromValues(this.properties[index].scale[0], this.properties[index].scale[1], this.properties[index].scale[2]));

        this.properties[index].modelMatrix[12] = this.properties[index].translate[0];
        this.properties[index].modelMatrix[13] = this.properties[index].translate[1];
        this.properties[index].modelMatrix[14] = this.properties[index].translate[2];
        this.properties[index].modelMatrix[15] = 1.0;

        this.properties[index].modelMatrixInverse = mat4.invert(mat4.create(), this.properties[index].modelMatrix);

        this._dirtyCPU = true;
        this._dirtyGPU = true;
    }

    public set scale(s: number) {
        this.scaleIndex(s, 0);
    }

    public scaleIndex(s: number, index: number) {
        this.properties[index].scale = [s, s, s, 1.0];
        this.properties[index].modelMatrix = mat4.create();
        mat4.scale(this.properties[index].modelMatrix, this.properties[index].modelMatrix, vec3.fromValues(s, s, s));

        this.properties[index].modelMatrix[12] = this.properties[index].translate[0];
        this.properties[index].modelMatrix[13] = this.properties[index].translate[1];
        this.properties[index].modelMatrix[14] = this.properties[index].translate[2];
        this.properties[index].modelMatrix[15] = 1.0;
        this.properties[index].modelMatrixInverse = mat4.invert(mat4.create(), this.properties[index].modelMatrix);

        this._dirtyCPU = true;
        this._dirtyGPU = true;
    }

    public static resize(graphicsLibrary: GraphicsLibrary, width: number, height: number) {
        Volume.accumulationTextures = [
            graphicsLibrary.device.createTexture({
                size: [width, height, 1],
                format: "rgba32float",
                usage: GPUTextureUsage.TEXTURE_BINDING | GPUTextureUsage.STORAGE_BINDING
            }),
            graphicsLibrary.device.createTexture({
                size: [width, height, 1],
                format: "rgba32float",
                usage: GPUTextureUsage.TEXTURE_BINDING | GPUTextureUsage.STORAGE_BINDING
            }),
        ];
    }

    public onAllocationMoved(): void {
        if (!this._allocation || !Volume.bindGroupLayouts[0] || !this._texture || !this._colorMap) {
            return;
        }

        // this._bindGroup = this._graphicsLibrary.device.createBindGroup({
        //     layout: Volume.bindGroupLayouts[0],
        //     entries: [
        //         {
        //             binding: 0, resource: {
        //                 buffer: this._allocation.gpuBuffer.inner,
        //                 offset: this._allocation.allocationRange.offset,
        //                 size: this._allocation.allocationRange.size,
        //             },
        //         },
        //         {
        //             binding: 1, resource: this._texture.createView()
        //         },
        //         {
        //             binding: 2, resource: this._graphicsLibrary.linearSampler
        //         },
        //         {
        //             binding: 3, resource: this._colorMap.createView()
        //         }
        //     ]
        // });

        this.toBuffer(this._allocation.cpuBuffer.inner, this._allocation.allocationRange.offset);
    }

    public record(encoder: GPURenderPassEncoder, bindGroupLayoutsOffset = 1, frameID: number): void {
        if (!this._allocation || !this._texture || !this._colorMap || !Volume.accumulationTextures) {
            return;
        }

        if (this.hidden) {
            return;
        }

        for (let i = 0; i < this.properties.length; i++) {
            this.properties[i].frameID = frameID;
        }
        this._dirtyCPU = true;

        const bindGroup = this._graphicsLibrary.device.createBindGroup({
            layout: Volume.bindGroupLayouts[0],
            entries: [
                {
                    binding: 0, resource: {
                        buffer: this._allocation.gpuBuffer.inner,
                        offset: this._allocation.allocationRange.offset,
                        size: this._allocation.allocationRange.size,
                    },
                },
                {
                    binding: 1, resource: this._texture.createView()
                },
                {
                    binding: 2, resource: this._graphicsLibrary.linearSampler
                },
                {
                    binding: 3, resource: this._colorMap.createView()
                },
                {
                    binding: 4, resource: Volume.accumulationTextures[frameID % 2].createView(),
                },
                {
                    binding: 5, resource: Volume.accumulationTextures[(frameID + 1) % 2].createView(),
                }
            ]
        });

        // Set bind group
        encoder.setBindGroup(bindGroupLayoutsOffset + 0, bindGroup);

        // Draw
        encoder.draw(4, 1, 0, 0);
    }

    public toBuffer(buffer: ArrayBuffer, offset: number): void {
        const u8View = new Uint8Array(buffer, offset);
        for (let i = 0; i < this.properties.length; i++) {
            u8View.set(VolumeStruct.toBuffer(this.properties[i]), i * VolumeStruct);
        }
    }
}