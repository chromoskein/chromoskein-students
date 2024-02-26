import type { Allocator, GraphicsLibrary, Intersection } from "../../..";
import type { BoundingBox, Ray } from "../../../shared";
import { IParametricObject } from "./shared";
import * as r from "restructure";
import { mat4, vec3, vec4 } from "gl-matrix";
import { signedDistanceGridFromArbitraryPoints, signedDistanceGridFromPoints } from "./signedDistanceGridFromPoints";

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
            label: "SignedDistanceGridFromPoints",
            entries: [{
                binding: 0,
                visibility: GPUShaderStage.COMPUTE,
                buffer: { type: "read-only-storage" },
            }, {
                binding: 1,
                visibility: GPUShaderStage.COMPUTE,
                storageTexture: {
                    format: "r32float",
                    access: "write-only",
                    viewDimension: "3d"
                }
            }, {
                binding: 2,
                visibility: GPUShaderStage.COMPUTE,
                buffer: { type: "read-only-storage" },
            }]
        });

        const gridFromPointsPL = device.createPipelineLayout({
            bindGroupLayouts: [gridFromPointsBGL]
        });

        this.bindGroupLayouts.set("gridFromPoints", gridFromPointsBGL);
        this.pipelineLayouts.set("gridFromPoints", gridFromPointsPL)

        const gridFromPointsModule = device.createShaderModule({
            code: signedDistanceGridFromPoints(),
        });

        const gridFromArbitraryPointsModule = device.createShaderModule({
            code: signedDistanceGridFromArbitraryPoints(),
        });
        this.shaderModules.set("gridFromPoints", gridFromPointsModule);
        this.shaderModules.set("gridFromArbitraryPoints", gridFromArbitraryPointsModule);

        this.computePipelines.set("gridFromPoints", device.createComputePipeline({
            layout: gridFromPointsPL,
            compute: {
                module: gridFromPointsModule,
                entryPoint: "main",
            }
        }));

        this.computePipelines.set("gridFromArbitraryPoints", device.createComputePipeline({
            layout: gridFromPointsPL,
            compute: {
                module: gridFromArbitraryPointsModule,
                entryPoint: "main",
            }
        }));

        Pipelines._lastDeviceUsed = graphicsLibrary.device;
    }

    public static getInstance(graphicsLibrary: GraphicsLibrary): Pipelines {
        if (this._instance && Pipelines._lastDeviceUsed === graphicsLibrary.device) {
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
const SignedDistanceGridStructUniformSize: number = 176;

export const SignedDistanceGridStruct = new r.Struct({
    modelMatrix: new r.Array(r.floatle, 16),
    modelMatrixInverse: new r.Array(r.floatle, 16),
    color: new r.Array(r.floatle, 4),
    translate: new r.Array(r.floatle, 4),
    scale: new r.Array(r.floatle, 4),
});

export const GridTextureSize: number = 64;

export class SignedDistanceGrid extends IParametricObject {
    private _pipelines: Pipelines;

    public static variableName = "signedDistanceGrid";
    public static typeName = "SignedDistanceGrid";

    public getVariableName(): string { return SignedDistanceGrid.variableName }
    public getTypeName(): string { return SignedDistanceGrid.typeName }

    static bindGroupLayouts: Array<GPUBindGroupLayout> = [];
    static createBindGroupLayouts(device: GPUDevice): void {
        SignedDistanceGrid.bindGroupLayouts = [device.createBindGroupLayout({
            label: this.typeName,
            entries: [{
                binding: 0,
                visibility: GPUShaderStage.VERTEX | GPUShaderStage.FRAGMENT,
                buffer: { type: "read-only-storage" },
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
                    type: "filtering"
                }
            }]
        })
        ];
    }

    public properties: SignedDistanceGridProperties[];

    //#region GPU Code
    public static gpuCodeGlobals: string = /* wgsl */`
        struct ${this.typeName} {
            modelMatrix: mat4x4<f32>,
            modelMatrixInverse: mat4x4<f32>,
            color: vec4<f32>,
            translate: vec4<f32>,
            scale: vec3<f32>,
        };
        
        struct ObjectIntersection {
            t: f32,
            position: vec3<f32>,
            normal: vec3<f32>,
            index: i32,
        };

        @group(1) @binding(0) var<storage, read> ${this.variableName}: array<${this.typeName}>;
        @group(1) @binding(1) var ${this.variableName}Texture: texture_3d<f32>;
        @group(1) @binding(2) var linearSampler: sampler;
        `;

        public static gpuCodeGetObject = "";
        public static gpuCodeGetObjectUntypedArray = "";

        static gpuCodeIntersectionTest = /* wgsl */`
        fn calcNormal(p: vec3<f32>, i: u32) -> vec3<f32> // for function f(p)
        {
            let h = 0.1;
            let k = vec2<f32>(1.0, -1.0);

            return normalize( k.xyy*sampleGrid( p + k.xyy*h , i ) + 
                              k.yyx*sampleGrid( p + k.yyx*h , i ) + 
                              k.yxy*sampleGrid( p + k.yxy*h , i ) + 
                              k.xxx*sampleGrid( p + k.xxx*h , i ) );
        }

        fn sampleGrid(p: vec3<f32>, i: u32) -> f32 {
            var coords = 0.5 * p + vec3<f32>(0.5);
            coords = ${GridTextureSize} * coords;
            let coordsU32 = vec3<u32>(floor(coords));
            let coordsFract = fract(coords);
            let tx = coordsFract.x;
            let ty = coordsFract.y;       
            let tz = coordsFract.z;

            let c000 = textureLoad(${this.variableName}Texture, clamp(coordsU32 + vec3<u32>(0, 0, 0 + i * ${GridTextureSize}), vec3<u32>(0, 0, i * ${GridTextureSize}), vec3<u32>(${GridTextureSize - 1}, ${GridTextureSize - 1}, i * ${GridTextureSize} + ${GridTextureSize - 1})), 0).x;
            let c100 = textureLoad(${this.variableName}Texture, clamp(coordsU32 + vec3<u32>(1, 0, 0 + i * ${GridTextureSize}), vec3<u32>(0, 0, i * ${GridTextureSize}), vec3<u32>(${GridTextureSize - 1}, ${GridTextureSize - 1}, i * ${GridTextureSize} + ${GridTextureSize - 1})), 0).x;
            let c010 = textureLoad(${this.variableName}Texture, clamp(coordsU32 + vec3<u32>(0, 1, 0 + i * ${GridTextureSize}), vec3<u32>(0, 0, i * ${GridTextureSize}), vec3<u32>(${GridTextureSize - 1}, ${GridTextureSize - 1}, i * ${GridTextureSize} + ${GridTextureSize - 1})), 0).x;
            let c110 = textureLoad(${this.variableName}Texture, clamp(coordsU32 + vec3<u32>(1, 1, 0 + i * ${GridTextureSize}), vec3<u32>(0, 0, i * ${GridTextureSize}), vec3<u32>(${GridTextureSize - 1}, ${GridTextureSize - 1}, i * ${GridTextureSize} + ${GridTextureSize - 1})), 0).x;
            let c001 = textureLoad(${this.variableName}Texture, clamp(coordsU32 + vec3<u32>(0, 0, 1 + i * ${GridTextureSize}), vec3<u32>(0, 0, i * ${GridTextureSize}), vec3<u32>(${GridTextureSize - 1}, ${GridTextureSize - 1}, i * ${GridTextureSize} + ${GridTextureSize - 1})), 0).x;
            let c101 = textureLoad(${this.variableName}Texture, clamp(coordsU32 + vec3<u32>(1, 0, 1 + i * ${GridTextureSize}), vec3<u32>(0, 0, i * ${GridTextureSize}), vec3<u32>(${GridTextureSize - 1}, ${GridTextureSize - 1}, i * ${GridTextureSize} + ${GridTextureSize - 1})), 0).x;
            let c011 = textureLoad(${this.variableName}Texture, clamp(coordsU32 + vec3<u32>(0, 1, 1 + i * ${GridTextureSize}), vec3<u32>(0, 0, i * ${GridTextureSize}), vec3<u32>(${GridTextureSize - 1}, ${GridTextureSize - 1}, i * ${GridTextureSize} + ${GridTextureSize - 1})), 0).x;
            let c111 = textureLoad(${this.variableName}Texture, clamp(coordsU32 + vec3<u32>(1, 1, 1 + i * ${GridTextureSize}), vec3<u32>(0, 0, i * ${GridTextureSize}), vec3<u32>(${GridTextureSize - 1}, ${GridTextureSize - 1}, i * ${GridTextureSize} + ${GridTextureSize - 1})), 0).x;

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

        fn ray${this.typeName}Intersection(ray: Ray, ${this.variableName}: ${this.typeName}, index: u32) -> Intersection {
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
            for(var i = 0; i < ${GridTextureSize}; i++) {
                intersection = rayOriginLocalSpace + t * rayDirectionLocalSpace;
                distance = sampleGrid(intersection, index);

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
                calcNormal(intersection, index)
            );
        }


        fn findClosestIntersection(ray: Ray, index: i32) -> ObjectIntersection {
            var bestDistance: f32 = 10000.0;
            var found = false;
            var bestIntersection: Intersection = ray${this.typeName}Intersection(ray, ${this.variableName}[0], 0);
            var foundIndex: i32 = 0;

            for(var i: u32 = 0; i < arrayLength(&${this.variableName}); i++) {
                var intersection = ray${this.typeName}Intersection(ray, ${this.variableName}[i], i);
                var dist = distance(ray.origin, intersection.position);
                if (intersection.t > 0.0 && !(dist < 0.001 && index == i32(i)) && dist < bestDistance) {
                    found = true;
                    bestIntersection = intersection;
                    bestDistance = dist;
                    foundIndex = i32(i);
                }
            }

            if (!found) {
                return ObjectIntersection(
                    -1.0,
                    vec3<f32>(0.0),
                    vec3<f32>(0.0),
                    -1
                );
            } else {
                return ObjectIntersection(
                    bestIntersection.t,
                    bestIntersection.position,
                    bestIntersection.normal,
                    foundIndex
                );
            }
        }

        fn TraceRay(ray: Ray) -> vec3<f32> {
            var r = ray;
            var intersection = findClosestIntersection(r, -1);
            var color = vec3<f32>(0.0, 0.0, 0.0);
            var alphaCoef = 1.0;
            while (intersection.t >= 0.0) {
                var alpha = ${this.variableName}[intersection.index].color.a;
                color = color + alphaCoef * alpha * ${this.variableName}[intersection.index].color.rgb;
                alphaCoef = alphaCoef * (1 - alpha);

                r = Ray(intersection.position, r.direction);
                intersection = findClosestIntersection(r, intersection.index);
            }
            return color;
        }
    `;

    public static gpuCodeGetIntersection(name: string, typeName: string): string {
        return /* wgsl */`      
        var color = vec4<f32>(TraceRay(ray), 1.0);  
        var objectIntersection = findClosestIntersection(ray, -1);
        var intersection = Intersection(objectIntersection.t, objectIntersection.position, objectIntersection.normal);     
    `}

    static gpuCodeGetOutputValue(variable: "color" | "normal" | "ao"): string {
        switch (variable) {
            case "color": {
                return /* wgsl */`
                `;
            }
            case "normal": {
                return /* wgsl */`
                    let normal = intersection.normal;
                `;
            }
            case "ao": {
                return /* wgsl */`
                    let ao = vec2(1.0, 1.0);
                `;
            }
        }
    }

    static gpuCodeGetBoundingRectangleVertex = /*wgsl*/`
        var begin = ${this.variableName}[0].modelMatrix * vec4<f32>(-1.0, -1.0, -1.0, 1.0);
        var end = ${this.variableName}[0].modelMatrix * vec4<f32>(1.0);
        for(var i: u32 = 1; i < arrayLength(&${this.variableName}); i++) {
            begin = min(${this.variableName}[i].modelMatrix * vec4<f32>(-1.0, -1.0, -1.0, 1.0), begin);
            end = max(${this.variableName}[i].modelMatrix * vec4<f32>(1.0), end);
        }

        let center = 0.5 * (begin.xyz + end.xyz);
        let radius = distance(center, begin.xyz);

        let boundingRectangleVertex = sphereToBoundingRectangleVertex(center.xyz, radius, vertexIndex);
    `;
    //#endregion GPU Code

    private opSmoothUnion(d1: number, d2: number, k: number): number {
        let h = Math.min(Math.max(0.5 + 0.5 * (d2 - d1) / k, 0.0), 1.0);
        return (d2 * (1.0 - h) + d1 * h) - k*h*(1.0-h);
    }
    
    private sdCapsule(p: vec3, a: vec3, b: vec3, r: number ): number
    {
      let pa = vec3.sub(vec3.fromValues(0, 0, 0), p, a); // p - a;
      let ba = vec3.sub(vec3.fromValues(0, 0, 0), b, a);// b - a;
      
      let h = Math.min(Math.max(vec3.dot(pa,ba) / vec3.dot(ba,ba), 0.0), 1.0);
    
      let temp = vec3.fromValues(pa[0] - ba[0] * h, pa[1] - ba[1] * h, pa[2] - ba[2] * h);
      return vec3.length(temp) - r;
    }

    private calculateSDFValue(p: vec3): number {
        let sdf = this.sdCapsule(p, this._normalizedPoints[0], this._normalizedPoints[1], this._radius);
        for(let i = 1; i < this._normalizedPoints.length - 1; i++) {
            let p1 = this._normalizedPoints[i];
            let p2 = this._normalizedPoints[i + 1];
    
            let sdf2 = this.sdCapsule(p, p1, p2, this._radius);
            sdf = this.opSmoothUnion(sdf, sdf2, 0.1);
        }

        return sdf;
    }

    public rayIntersection(ray: Ray): Intersection | null {
        const invModelMatrix = this.properties[0].modelMatrixInverse;

        let rayOriginLocalSpace = vec3.fromValues(
            invModelMatrix[0] * ray.origin[0] + invModelMatrix[1] * ray.origin[1] + invModelMatrix[2]  * ray.origin[2] + invModelMatrix[3],
            invModelMatrix[4] * ray.origin[0] + invModelMatrix[5] * ray.origin[1] + invModelMatrix[6]  * ray.origin[2] + invModelMatrix[7],
            invModelMatrix[8] * ray.origin[0] + invModelMatrix[9] * ray.origin[1] + invModelMatrix[10] * ray.origin[2] + invModelMatrix[11]
        );
        
        let rayDirectionLocalSpace = vec3.fromValues(
            invModelMatrix[0]  * ray.direction[0] + invModelMatrix[1]  * ray.direction[1] + invModelMatrix[2]  * ray.direction[2],
            invModelMatrix[4]  * ray.direction[0] + invModelMatrix[5]  * ray.direction[1] + invModelMatrix[6]  * ray.direction[2],
            invModelMatrix[8]  * ray.direction[0] + invModelMatrix[9]  * ray.direction[1] + invModelMatrix[10] * ray.direction[2]
        );

        let tMin = vec3.div(vec3.fromValues(0, 0, 0), vec3.sub(vec3.fromValues(0, 0, 0), vec3.fromValues(-1, -1, -1), rayOriginLocalSpace), rayDirectionLocalSpace);
        let tMax = vec3.div(vec3.fromValues(0, 0, 0), vec3.sub(vec3.fromValues(0, 0, 0), vec3.fromValues( 1,  1,  1), rayOriginLocalSpace), rayDirectionLocalSpace);

        let t1 = vec3.min(vec3.fromValues(0, 0, 0), tMin, tMax);
        let t2 = vec3.max(vec3.fromValues(0, 0, 0), tMin, tMax);

        let tN = Math.max(Math.max(t1[0], t1[1]), t1[2]);
        let tF = Math.min(Math.min(t2[0], t2[1]), t2[2]);

        if (tN > tF) {
            return null;
        }

        var intersection = vec3.fromValues(0, 0, 0);
        var t = Math.max(tN, 0.0);
        var distance = 0.0;
        for (let i = 0; i < GridTextureSize; i++) {
            intersection = vec3.scaleAndAdd(vec3.fromValues(0, 0, 0), rayOriginLocalSpace, rayDirectionLocalSpace, t);
            distance = this.calculateSDFValue(intersection);

            if (Math.abs(distance) <= 0.001) {
                break;
            } 

            if (t > tF) {
                return null;
            }

            t = t + Math.abs(distance);
        }

        // Hopefully this transformation is correct here
        // This also assumes that the scale is uniform in all dimensions else 
        // this calculation completely wrong
        let tWorldSpace = t * this.properties[0].scale[0];
        return {bin: 0, t: tWorldSpace, object: this};
    }

    public toBoundingBoxes(): BoundingBox[] {
        return [];
    }
    
    private _bindGroup: GPUBindGroup | null = null;
    private _texture: GPUTexture | null = null;
    private _normalizedPoints: Array<vec3> = [];
    private _radius: number = 0;

    constructor(id: number, graphicsLibrary: GraphicsLibrary, allocator: Allocator, instances: number = 1) {
        super(id, graphicsLibrary, allocator);

        this._pipelines = Pipelines.getInstance(graphicsLibrary);

        this._allocation = allocator.allocate(SignedDistanceGridStructUniformSize * instances);

        this.properties = new r.Array(SignedDistanceGridStruct, instances);
        for (let i = 0; i < instances; i++){
            this.properties[i] = SignedDistanceGridStruct.fromBuffer(new Uint8Array(SignedDistanceGridStructUniformSize));
            this.properties[i].modelMatrix = mat4.create();
            this.properties[i].modelMatrixInverse = mat4.invert(mat4.create(), this.properties[i].modelMatrix);
            this.properties[i].color = vec4.fromValues(1.0, 1.0, 1.0, 1.0);
            this.properties[i].translate = vec4.fromValues(0.0, 0.0, 0.0, 0.0);
            this.properties[i].scale = vec4.fromValues(1.0, 1.0, 1.0, 1.0);
        }
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

    public fromPoints(device: GPUDevice, points: Array<Array<vec3>>, radius: Array<number> = [0.05]) {
        const pipeline = this._pipelines.computePipelines.get("gridFromPoints");
        const bgl = this._pipelines.bindGroupLayouts.get("gridFromPoints");

        if (!pipeline || !bgl) {
            return;
        }


        if (!this._texture) {
            this._texture = this._graphicsLibrary.device.createTexture({
                size: {
                    width: GridTextureSize,
                    height: GridTextureSize,
                    depthOrArrayLayers: Math.max(points.length * GridTextureSize, 1),
                },
                mipLevelCount: 1,
                dimension: "3d",
                format: "r32float",
                usage: GPUTextureUsage.STORAGE_BINDING | GPUTextureUsage.TEXTURE_BINDING | GPUTextureUsage.COPY_DST,
            });
        }

        
        const delimitersCPUBuffer = new Uint32Array(points.length + 1);
        const delimiters = [0];
        let len = 0;
        delimitersCPUBuffer.set([0], 0);
        for(let i = 0; i < points.length; i++) {
            len += points[i].length;
            delimiters.push(len);
            delimitersCPUBuffer.set([len], i + 1);
        }
        
        const pointsCPUBuffer = new Float32Array(len * 4);
        
        let offset = 0;
        for (let j = 0; j < points.length; j++) {
            const writeRadius = radius[j] * (1.0 / this.properties[j].scale[0]);
            for(let i = 0; i < points[j].length; i++) {
                pointsCPUBuffer.set(points[j][i], 4 * i + 4 * offset);
                pointsCPUBuffer.set([writeRadius], 4 * i + 3 + 4 * offset);
            }
            offset += points[j].length;
        }

        const pointsBuffer = device.createBuffer({ size: Math.max(len * 4 * 4, 1), usage: GPUBufferUsage.COPY_DST | GPUBufferUsage.STORAGE });
        const delmitersBuffer = device.createBuffer( { size: delimiters.length * 4, usage: GPUBufferUsage.COPY_DST | GPUBufferUsage.STORAGE })
        const bindGroup = device.createBindGroup({
            layout: bgl,
            entries: [{
                binding: 0,
                resource: { buffer: pointsBuffer }
            }, {
                binding: 1,
                resource: this._texture.createView()
            }, {
                binding: 2,
                resource: { buffer: delmitersBuffer }
            }]
        });

        device.queue.writeBuffer(pointsBuffer, 0, pointsCPUBuffer, 0);
        device.queue.writeBuffer(delmitersBuffer, 0, delimitersCPUBuffer, 0);
        const commandEncoder = device.createCommandEncoder();
        const computePass = commandEncoder.beginComputePass();
        computePass.setPipeline(pipeline);
        computePass.setBindGroup(0, bindGroup);
        const workgroupSize: number = GridTextureSize / 4;
        computePass.dispatchWorkgroups(workgroupSize, workgroupSize, points.length * workgroupSize);
        computePass.end();

        device.queue.submit([commandEncoder.finish()]);

        this.onAllocationMoved();
        this._normalizedPoints = points[0];
        this._radius = radius[0];
        //this.createCPUGrid(points[0], radius[0]);
    }

    public fromArbitraryPoints(device: GPUDevice, points: Array<vec3>, delimiters: Array<number>, radius: number = 0.05) {
        const pipeline = this._pipelines.computePipelines.get("gridFromArbitraryPoints");
        const bgl = this._pipelines.bindGroupLayouts.get("gridFromPoints");

        if (!pipeline || !bgl) {
            return;
        }

        if (!this._texture) {
            this._texture = this._graphicsLibrary.device.createTexture({
                size: {
                    width: GridTextureSize,
                    height: GridTextureSize,
                    depthOrArrayLayers: GridTextureSize,
                },
                mipLevelCount: 1,
                dimension: "3d",
                format: "r32float",
                usage: GPUTextureUsage.STORAGE_BINDING | GPUTextureUsage.TEXTURE_BINDING | GPUTextureUsage.COPY_DST,
            });
        }
        
        const delimitersCPUBuffer = new Uint32Array(delimiters.length);
        for(let i = 0; i < delimiters.length; i++) {
            delimitersCPUBuffer.set([delimiters[i]], i);
        }
        
        const pointsCPUBuffer = new Float32Array(points.length * 4);
        
        const writeRadius = radius * (1.0 / this.properties[0].scale[0]);
        for (let i = 0; i < points.length; i++) {
                pointsCPUBuffer.set(points[i], 4 * i);
                pointsCPUBuffer.set([writeRadius], 4 * i + 3);
        }

        const pointsBuffer = device.createBuffer({ size: points.length * 4 * 4, usage: GPUBufferUsage.COPY_DST | GPUBufferUsage.STORAGE });
        const delmitersBuffer = device.createBuffer({ size: delimiters.length * 4, usage: GPUBufferUsage.COPY_DST | GPUBufferUsage.STORAGE })
        const bindGroup = device.createBindGroup({
            layout: bgl,
            entries: [{
                binding: 0,
                resource: { buffer: pointsBuffer }
            }, {
                binding: 1,
                resource: this._texture.createView()
            }, {
                binding: 2,
                resource: { buffer: delmitersBuffer }
            }]
        });

        device.queue.writeBuffer(pointsBuffer, 0, pointsCPUBuffer, 0);
        device.queue.writeBuffer(delmitersBuffer, 0, delimitersCPUBuffer, 0);
        const commandEncoder = device.createCommandEncoder();
        const computePass = commandEncoder.beginComputePass();
        computePass.setPipeline(pipeline);
        computePass.setBindGroup(0, bindGroup);
        const workgroupSize: number = GridTextureSize / 4;
        computePass.dispatchWorkgroups(workgroupSize, workgroupSize, points.length * workgroupSize);
        computePass.end();

        device.queue.submit([commandEncoder.finish()]);

        this.onAllocationMoved();
    }

    public translate(t: vec3, index: number = 0) {
        this.properties[index].translate = [t[0], t[1], t[2], 1.0];
        this.properties[index].modelMatrix = mat4.create();
        mat4.scale(this.properties[index].modelMatrix, this.properties[index].modelMatrix, vec3.fromValues(this.properties[index].scale[index], this.properties[index].scale[1], this.properties[index].scale[2]));
        mat4.translate(this.properties[index].modelMatrix, this.properties[index].modelMatrix, t);

        this.properties[index].modelMatrixInverse = mat4.invert(mat4.create(), this.properties[index].modelMatrix);

        this._dirtyCPU = true;
        this._dirtyGPU = true;
    }

    public scale(s: number, index: number = 0) {
        this.properties[index].scale = [s, s, s, 1.0];
        this.properties[index].modelMatrix = mat4.create();
        mat4.scale(this.properties[index].modelMatrix, this.properties[index].modelMatrix, vec3.fromValues(s, s, s));  
        // mat4.translate(this.properties.modelMatrix, this.properties.modelMatrix, vec3.fromValues(this.properties.translate[0], this.properties.translate[1], this.properties.translate[2]));      

        this.properties[index].modelMatrix[12] = this.properties[index].translate[0];
        this.properties[index].modelMatrix[13] = this.properties[index].translate[1];
        this.properties[index].modelMatrix[14] = this.properties[index].translate[2];
        this.properties[index].modelMatrix[15] = 1.0;
        this.properties[index].modelMatrixInverse = mat4.invert(mat4.create(), this.properties[index].modelMatrix);

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
        for (let i = 0; i < this.properties.length; i++) {
            u8View.set(SignedDistanceGridStruct.toBuffer(this.properties[i]), i * SignedDistanceGridStructUniformSize);
        }
    }
}