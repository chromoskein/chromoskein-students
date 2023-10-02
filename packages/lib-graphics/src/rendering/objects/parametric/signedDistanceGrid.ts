import type { Allocator, GraphicsLibrary } from "../../..";
import type { BoundingBox, Ray } from "../../../shared";
import { IParametricObject } from "./shared";
import * as r from 'restructure';
import { mat4, vec3, vec4 } from "gl-matrix";
import { signedDistanceGridFromPoints } from "./signedDistanceGridFromPoints";

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

        const gridFromPointsBGL = device.createBindGroupLayout({
            label: `SignedDistanceGridFromPoints`,
            entries: [{
                binding: 0,
                visibility: GPUShaderStage.COMPUTE,
                buffer: { type: 'read-only-storage' },
            }, {
                binding: 1,
                visibility: GPUShaderStage.COMPUTE,
                storageTexture: {
                    format: 'r32float',
                    access: 'write-only',
                    viewDimension: "3d"
                }
            }]
        });

        const gridFromPointsPL = device.createPipelineLayout({
            bindGroupLayouts: [gridFromPointsBGL]
        });

        this.bindGroupLayouts.set('gridFromPoints', gridFromPointsBGL);
        this.pipelineLayouts.set('gridFromPoints', gridFromPointsPL)

        const gridFromPointsModule = device.createShaderModule({
            code: signedDistanceGridFromPoints(),
        });
        this.shaderModules.set('gridFromPoints', gridFromPointsModule);

        this.computePipelines.set('gridFromPoints', device.createComputePipeline({
            layout: gridFromPointsPL,
            compute: {
                module: gridFromPointsModule,
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

export interface SignedDistanceGridProperties {
    modelMatrix: mat4,
    modelMatrixInverse: mat4,
    color: vec4,
    translate: vec4,
    scale: vec4,
}

export const SignedDistanceGridStruct = new r.Struct({
    modelMatrix: new r.Array(r.floatle, 16),
    modelMatrixInverse: new r.Array(r.floatle, 16),
    color: new r.Array(r.floatle, 4),
    translate: new r.Array(r.floatle, 4),
    scale: new r.Array(r.floatle, 4),
});

export class SignedDistanceGrid extends IParametricObject {
    private _pipelines: Pipelines;

    public static variableName = 'signedDistanceGrid';
    public static typeName = 'SignedDistanceGrid';

    public getVariableName(): string { return SignedDistanceGrid.variableName };
    public getTypeName(): string { return SignedDistanceGrid.typeName };

    static bindGroupLayouts: Array<GPUBindGroupLayout> = [];
    static createBindGroupLayouts(device: GPUDevice): void {
        SignedDistanceGrid.bindGroupLayouts = [device.createBindGroupLayout({
            label: this.typeName,
            entries: [{
                binding: 0,
                visibility: GPUShaderStage.VERTEX | GPUShaderStage.FRAGMENT,
                buffer: { type: 'uniform' },
            }, {
                binding: 1,
                visibility: GPUShaderStage.FRAGMENT,
                texture: {
                    sampleType: "unfilterable-float",
                    viewDimension: "3d"
                }
            }, {
                binding: 2,
                visibility: GPUShaderStage.FRAGMENT,
                sampler: {
                    type: 'filtering'
                }
            }]
        })
        ];
    }

    public properties: SignedDistanceGridProperties;

    //#region GPU Code
    public static gpuCodeGlobals = /* wgsl */`
        struct ${this.typeName} {
            modelMatrix: mat4x4<f32>,
            modelMatrixInverse: mat4x4<f32>,
            color: vec4<f32>,
            translate: vec4<f32>,
            scale: vec3<f32>,
        };
        
        @group(1) @binding(0) var<uniform> ${this.variableName}: ${this.typeName};
        @group(1) @binding(1) var ${this.variableName}Texture: texture_3d<f32>;
        @group(1) @binding(2) var linearSampler: sampler;
    `;

    public static gpuCodeGetObject = ``;
    public static gpuCodeGetObjectUntypedArray = ``;

    static gpuCodeIntersectionTest = /* wgsl */`
        fn calcNormal(p: vec3<f32>) -> vec3<f32> // for function f(p)
        {
            let h = 0.1;
            let k = vec2<f32>(1.0, -1.0);

            return normalize( k.xyy*sampleGrid( p + k.xyy*h ) + 
                              k.yyx*sampleGrid( p + k.yyx*h ) + 
                              k.yxy*sampleGrid( p + k.yxy*h ) + 
                              k.xxx*sampleGrid( p + k.xxx*h ) );
        }

        fn sampleGrid(p: vec3<f32>) -> f32 {
            var coords = 0.5 * p + vec3<f32>(0.5);
            // coords.y = 1.0 - coords.y;
            // coords.z = 1.0 - coords.z;
            coords = 64 * coords;
            let coordsU32 = vec3<u32>(floor(coords));
            let coordsFract = fract(coords);
            let tx = coordsFract.x;
            let ty = coordsFract.y;
            let tz = coordsFract.z;

            let c000 = textureLoad(${this.variableName}Texture, clamp(coordsU32 + vec3<u32>(0, 0, 0), vec3<u32>(0), vec3<u32>(63)), 0).x;
            let c100 = textureLoad(${this.variableName}Texture, clamp(coordsU32 + vec3<u32>(1, 0, 0), vec3<u32>(0), vec3<u32>(63)), 0).x;
            let c010 = textureLoad(${this.variableName}Texture, clamp(coordsU32 + vec3<u32>(0, 1, 0), vec3<u32>(0), vec3<u32>(63)), 0).x;
            let c110 = textureLoad(${this.variableName}Texture, clamp(coordsU32 + vec3<u32>(1, 1, 0), vec3<u32>(0), vec3<u32>(63)), 0).x;
            let c001 = textureLoad(${this.variableName}Texture, clamp(coordsU32 + vec3<u32>(0, 0, 1), vec3<u32>(0), vec3<u32>(63)), 0).x;
            let c101 = textureLoad(${this.variableName}Texture, clamp(coordsU32 + vec3<u32>(1, 0, 1), vec3<u32>(0), vec3<u32>(63)), 0).x;
            let c011 = textureLoad(${this.variableName}Texture, clamp(coordsU32 + vec3<u32>(0, 1, 1), vec3<u32>(0), vec3<u32>(63)), 0).x;
            let c111 = textureLoad(${this.variableName}Texture, clamp(coordsU32 + vec3<u32>(1, 1, 1), vec3<u32>(0), vec3<u32>(63)), 0).x;

            return 
                (1.0 - tx) * (1.0 - ty) * (1.0 - tz) * c000 + 
                tx * (1.0 - ty) * (1.0 - tz) * c100 + 
                (1.0 - tx) * ty * (1.0 - tz) * c010 + 
                tx * ty * (1.0 - tz) * c110 + 
                (1.0 - tx) * (1.0 - ty) * tz * c001 + 
                tx * (1.0 - ty) * tz * c101 + 
                (1.0 - tx) * ty * tz * c011 + 
                tx * ty * tz * c111; 
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
            
            var intersection = vec3<f32>(0.0);
            var t = max(tN, 0.0);
            var distance = 0.0;
            for(var i = 0; i < 64; i++) {
                intersection = rayOriginLocalSpace + t * rayDirectionLocalSpace;
                distance = sampleGrid(intersection);

                if (abs(distance) <= 0.0005) {
                    break;
                } 

                if (t > tF) {
                    t = -1.0;
                    break;
                }

                t = t + abs(distance);
            }

            return Intersection(
                t,
                (${this.variableName}.modelMatrix * vec4<f32>(intersection, 1.0)).xyz,
                calcNormal(intersection)
            );
        }
    `;

    static gpuCodeGetOutputValue(variable: 'color' | 'normal' | 'ao'): string {
        switch (variable) {
            case 'color': {
                return /* wgsl */`
                    var color = vec4<f32>(0.0, 0.0, 0.0, 1.0);

                    color = vec4(${this.variableName}.color.rgb, 1.0);
                `;
            }
            case 'normal': {
                return /* wgsl */`
                    let normal = intersection.normal;
                `;
            }
            case 'ao': {
                return /* wgsl */`
                    let ao = vec2(1.0, 1.0);
                `;
            }
        }
    }

    static gpuCodeGetBoundingRectangleVertex = `
        let begin = ${this.variableName}.modelMatrix * vec4<f32>(-1.0, -1.0, -1.0, 1.0);
        let end = ${this.variableName}.modelMatrix * vec4<f32>(1.0);

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

    private _bindGroup: GPUBindGroup | null = null;
    private _textureSize: number = 64;
    private _texture: GPUTexture | null = null;

    constructor(id: number, graphicsLibrary: GraphicsLibrary, allocator: Allocator) {
        super(id, graphicsLibrary, allocator);

        this._pipelines = Pipelines.getInstance(graphicsLibrary);

        this._allocation = allocator.allocate(256);

        this.properties = SignedDistanceGridStruct.fromBuffer(new Uint8Array(256));
        this.properties.modelMatrix = mat4.create();
        this.properties.modelMatrixInverse = mat4.invert(mat4.create(), this.properties.modelMatrix);
        this.properties.color = vec4.fromValues(1.0, 1.0, 1.0, 1.0);
        this.properties.translate = vec4.fromValues(0.0, 0.0, 0.0, 0.0);
        this.properties.scale = vec4.fromValues(1.0, 1.0, 1.0, 1.0);
        this.onAllocationMoved();
    }

    // public fromCPUGrid(grid: Float32Array, size: number) {
    //     this._textureSize = size;

    //     this._texture = this._graphicsLibrary.device.createTexture({
    //         size: {
    //             width: this._textureSize,
    //             height: this._textureSize,
    //             depthOrArrayLayers: this._textureSize,
    //         },
    //         mipLevelCount: 1,
    //         dimension: "3d",
    //         format: "r32float",
    //         usage: GPUTextureUsage.TEXTURE_BINDING | GPUTextureUsage.COPY_DST,
    //     });
        
    //     this._graphicsLibrary.device.queue.writeTexture(
    //         { texture: this._texture },
    //         grid.buffer,
    //         {
    //             bytesPerRow: this._textureSize * 4,
    //             rowsPerImage: this._textureSize,
    //         },
    //         {
    //             width: this._textureSize,
    //             height: this._textureSize,
    //             depthOrArrayLayers: this._textureSize,
    //         },
    //     );

    //     this.onAllocationMoved();
    // }

    public fromPoints(device: GPUDevice, points: Array<vec3>, radius: number = 0.05) {
        const pipeline = this._pipelines.computePipelines.get('gridFromPoints');
        const bgl = this._pipelines.bindGroupLayouts.get('gridFromPoints');

        if (!pipeline || !bgl) return;

        this._textureSize = 64;

        if (!this._texture) {
            this._texture = this._graphicsLibrary.device.createTexture({
                size: {
                    width: this._textureSize,
                    height: this._textureSize,
                    depthOrArrayLayers: this._textureSize,
                },
                mipLevelCount: 1,
                dimension: "3d",
                format: "r32float",
                usage: GPUTextureUsage.STORAGE_BINDING | GPUTextureUsage.TEXTURE_BINDING | GPUTextureUsage.COPY_DST,
            });
        }

        const writeRadius = radius * (1.0 / this.properties.scale[0]);

        const pointsCPUBuffer = new Float32Array(points.length * 4);
        for(let i = 0; i < points.length; i++) {
            pointsCPUBuffer.set(points[i], 4 * i);
            pointsCPUBuffer.set([writeRadius], 4 * i + 3);
        }

        const pointsBuffer = device.createBuffer({ size: points.length * 4 * 4, usage: GPUBufferUsage.COPY_DST | GPUBufferUsage.STORAGE });
        const bindGroup = device.createBindGroup({
            layout: bgl,
            entries: [{
                binding: 0,
                resource: { buffer: pointsBuffer }
            }, {
                binding: 1,
                resource: this._texture.createView()
            }]
        });

        device.queue.writeBuffer(pointsBuffer, 0, pointsCPUBuffer, 0);
        const commandEncoder = device.createCommandEncoder();
        const computePass = commandEncoder.beginComputePass();
        computePass.setPipeline(pipeline);
        computePass.setBindGroup(0, bindGroup);
        computePass.dispatchWorkgroups(16, 16, 16);
        computePass.end();

        device.queue.submit([commandEncoder.finish()]);

        this.onAllocationMoved();
    }

    public set translate(t: vec3) {
        this.properties.translate = [t[0], t[1], t[2], 1.0];
        this.properties.modelMatrix = mat4.create();
        mat4.scale(this.properties.modelMatrix, this.properties.modelMatrix, vec3.fromValues(this.properties.scale[0], this.properties.scale[1], this.properties.scale[2]));
        mat4.translate(this.properties.modelMatrix, this.properties.modelMatrix, t);

        this.properties.modelMatrixInverse = mat4.invert(mat4.create(), this.properties.modelMatrix);

        this._dirtyCPU = true;
        this._dirtyGPU = true;
    }

    public set scale(s: number) {
        this.properties.scale = [s, s, s, 1.0];
        this.properties.modelMatrix = mat4.create();
        mat4.scale(this.properties.modelMatrix, this.properties.modelMatrix, vec3.fromValues(s, s, s));  
        // mat4.translate(this.properties.modelMatrix, this.properties.modelMatrix, vec3.fromValues(this.properties.translate[0], this.properties.translate[1], this.properties.translate[2]));      

        this.properties.modelMatrix[12] = this.properties.translate[0];
        this.properties.modelMatrix[13] = this.properties.translate[1];
        this.properties.modelMatrix[14] = this.properties.translate[2];
        this.properties.modelMatrix[15] = 1.0;
        this.properties.modelMatrixInverse = mat4.invert(mat4.create(), this.properties.modelMatrix);

        this._dirtyCPU = true;
        this._dirtyGPU = true;
    }

    public onAllocationMoved(): void {
        if (!this._allocation || !SignedDistanceGrid.bindGroupLayouts[0] || !this._texture) {
            return;
        }

        this._bindGroup = this._graphicsLibrary.device.createBindGroup({
            layout: SignedDistanceGrid.bindGroupLayouts[0],
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
                }
            ]
        });

        this.toBuffer(this._allocation.cpuBuffer.inner, this._allocation.allocationRange.offset);
    }

    public record(encoder: GPURenderPassEncoder, bindGroupLayoutsOffset = 1): void {
        if (!this._bindGroup || this.hidden) {
            return;
        }

        // Set bind group
        encoder.setBindGroup(bindGroupLayoutsOffset + 0, this._bindGroup);

        // Draw
        encoder.draw(4, 1, 0, 0);
    }

    public toBuffer(buffer: ArrayBuffer, offset: number): void {
        const u8View = new Uint8Array(buffer, offset);
        u8View.set(SignedDistanceGridStruct.toBuffer(this.properties), 0);
    }
}