import { Allocator, GraphicsLibrary } from "../../..";
import type { BoundingBox, Ray } from "../../../shared";
import { IParametricObject } from "./shared";
import * as r from "restructure";

export interface SplineProperties {
    p0: [number, number, number, number],
    p1: [number, number, number, number],
    p2: [number, number, number, number],
    color: [number, number, number, number],
}


export class Spline extends IParametricObject {
    public static variableName = "spline";
    public static typeName = "Spline";

    public getVariableName(): string { return Spline.variableName }
    public getTypeName(): string { return Spline.typeName }

    static bindGroupLayouts: Array<GPUBindGroupLayout> = [];
    static createBindGroupLayouts(device: GPUDevice): void {
        Spline.bindGroupLayouts = [device.createBindGroupLayout({
            label: this.typeName,
            entries: [{
                binding: 0,
                visibility: GPUShaderStage.VERTEX | GPUShaderStage.FRAGMENT,
                buffer: { type: "read-only-storage" },
            }]
        })];
    }

    private splineInstancedStruct;

    private instances: number;
    public properties: SplineProperties[];

    //#region GPU Code
    public static gpuCodeGlobals = /* wgsl */`
        struct ${this.typeName} {
            p0: vec4<f32>,
            p1: vec4<f32>,
            p2: vec4<f32>,
            color: vec4<f32>,
        };
        
        @group(1) @binding(0) var<storage> ${this.variableName}Storage: array<${this.typeName}>;
    `;

    public static gpuCodeGetObject = `let ${this.variableName}: ${this.typeName} = ${this.variableName}Storage[instanceIndex];`;
    public static gpuCodeGetObjectUntypedArray = "";

    static gpuCodeIntersectionTest = /* wgsl */`
        struct QuadraticBezierCurve {
            p0: vec3<f32>,    
            p1: vec3<f32>,
            p2: vec3<f32>,
            radius: f32,
        };

        fn transformToRayFramePoint(p: vec3<f32>, 
            origin: vec3<f32>,
            u: vec3<f32>,
            v: vec3<f32>,
            w: vec3<f32>) -> vec3<f32> {
            let q: vec3<f32> = p - origin;
            return vec3<f32>(dot(q, u) , dot(q, v) , dot(q, w));
        }

        fn make_orthonormal_basis(n: vec3<f32>) -> array<vec3<f32>, 2>
        {
            var b1: vec3<f32> = vec3<f32>(0.0, 0.0, 0.0);
            var b2: vec3<f32> = vec3<f32>(0.0, 0.0, 0.0);

            if(n.z < 0.0) {
                let a: f32 = 1.0 / (1.0 - n.z);
                let b: f32 = n.x * n.y * a;

                b1 = vec3<f32>(1.0 - n.x * n.x * a, -b, n.x);
                b2 = vec3<f32>(b, n.y * n.y*a - 1.0, -n.y);
            } else {
                let a: f32= 1.0 / (1.0 + n.z);
                let b: f32 = -n.x * n.y * a;

                b1 = vec3<f32>(1.0 - n.x * n.x * a, b, -n.x);
                b2 = vec3<f32>(b, 1.0 - n.y * n.y * a, -n.y);
            }

            return array<vec3<f32>, 2>(b1, b2);
        }

        fn evaluateQuadraticBezier(curve: QuadraticBezierCurve, t: f32) -> vec3<f32> {
            let p0: vec3<f32> = curve.p0.xyz;
            let p1: vec3<f32> = curve.p1.xyz;
            let p2: vec3<f32> = curve.p2.xyz;
            let tinv: f32 = 1.0 - t;
            
            return tinv * tinv * p0 + 2.0 * tinv * t * p1+ t * t * p2;
        }
        
        fn evaluateDifferentialQuadraticBezier(curve: QuadraticBezierCurve, t: f32) -> vec3<f32> {
            let p0: vec3<f32> = curve.p0.xyz;
            let p1: vec3<f32> = curve.p1.xyz;
            let p2: vec3<f32> = curve.p2.xyz;
            let tinv: f32 = 1.0 - t;
        
            return 2.0 * tinv * (p1 - p0) + 2.0 * t * (p2 - p1);
        }

        fn transformToRayFrame(ray: Ray, curve: QuadraticBezierCurve) -> QuadraticBezierCurve {
            let onb: array<vec3<f32>, 2> = make_orthonormal_basis(ray.direction);

            return QuadraticBezierCurve(
                transformToRayFramePoint(curve.p0.xyz, ray.origin, onb[0], onb[1], ray.direction),        
                transformToRayFramePoint(curve.p1.xyz, ray.origin, onb[0], onb[1], ray.direction),
                transformToRayFramePoint(curve.p2.xyz, ray.origin, onb[0], onb[1], ray.direction),
                curve.radius,
            );
        }

        struct RayBezierIntersection
        {
            co: vec3<f32>,
            cd: vec3<f32>,
            s: f32,
            dt: f32,
            dp: f32,
            dc: f32,
            sp: f32,
            phantom: bool,
        };

        fn rayBezierIntersect(intersectionIn: RayBezierIntersection, r: f32) -> RayBezierIntersection {
            let r2: f32  = r * r;
            let drr: f32 = 0.0;
        
            var intersectionOut: RayBezierIntersection = RayBezierIntersection(
                intersectionIn.co,
                intersectionIn.cd,
                intersectionIn.s,
                intersectionIn.dt,
                intersectionIn.dp,
                intersectionIn.dc,
                intersectionIn.sp,
                intersectionIn.phantom
            );
        
            let co: vec3<f32> = intersectionIn.co;
            let cd: vec3<f32> = intersectionIn.cd;
        
            var ddd: f32 = cd.x * cd.x + cd.y * cd.y;
            intersectionOut.dp = co.x * co.x + co.y * co.y;
            let cdd: f32 = co.x * cd.x + co.y * cd.y;
            let cxd: f32 = co.x * cd.y - co.y * cd.x;
        
            let c: f32 = ddd;
            let b: f32 = cd.z * (drr - cdd);
            let cdz2: f32 = cd.z * cd.z;
            ddd = ddd + cdz2;
            let a: f32 = 2.0 * drr * cdd + cxd * cxd - ddd * r2 + intersectionOut.dp * cdz2;
        
            let discr: f32 = b * b - a * c;
            if (discr > 0.0) {
                intersectionOut.s   = (b - sqrt(discr)) / c;
            } else {
                intersectionOut.s   = (b - 0.0) / c;
            }    
            intersectionOut.dt  = (intersectionOut.s * cd.z - cdd) / ddd;
            intersectionOut.dc  = intersectionOut.s * intersectionOut.s + intersectionOut.dp;
            intersectionOut.sp  = cdd / cd.z;
            intersectionOut.dp  = intersectionOut.dp + intersectionOut.sp * intersectionOut.sp;
            intersectionOut.phantom = discr > 0.0;
        
            return intersectionOut;
        }

        struct CurveIntersection {
            t: f32,
            curveT: f32,
            position: vec3<f32>,
            normal: vec3<f32>,
        };

        fn ray${this.typeName}Intersection(ray: Ray, curveWS: ${this.typeName}) -> CurveIntersection {
            let curve: QuadraticBezierCurve = transformToRayFrame(ray, QuadraticBezierCurve(
                curveWS.p0.xyz, curveWS.p1.xyz, curveWS.p2.xyz, curveWS.p0.w
            ));

            var result = CurveIntersection(
                0.0,
                0.0,
                vec3(0.0),
                vec3(0.0)
              );
            var hit: bool = false;
            
            var tstart: f32 = 1.0;
            if (dot(curve.p2.xyz - curve.p0.xyz, ray.direction) > 0.0) {
                tstart = 0.0;
            } 
            
            for(var ep: i32 = 0; ep < 2; ep = ep + 1) {
            var t: f32 = tstart;
        
            var rci: RayBezierIntersection = RayBezierIntersection(
                vec3<f32>(0.0, 0.0, 0.0),
                vec3<f32>(0.0, 0.0, 0.0),
                0.0,
                0.0,
                0.0,
                0.0,
                0.0,
                true
            );
        
            var told: f32 = 0.0;
            var dt1: f32 = 0.0;
            var dt2: f32 = 0.0;
        
            for(var i: i32 = 0; i < 32; i = i + 1) {
                rci.co = evaluateQuadraticBezier(curve, t);
                rci.cd = evaluateDifferentialQuadraticBezier(curve, t);
        
                rci = rayBezierIntersect(rci, curve.radius);
                
                if (rci.phantom && abs(rci.dt) < 0.05) {
                    rci.s = rci.s + rci.co.z;
                    
                    result.t = rci.s;
                    result.curveT = t;
                    hit = true;
            
                    break;
                }
        
                rci.dt = min(rci.dt, 0.5);
                rci.dt = max(rci.dt, -0.5);
        
                dt1 = dt2;
                dt2 = rci.dt;
        
                // Regula falsi
                if (dt1 * dt2 < 0.0) {
                var tnext: f32 = 0.0;
                if((i & 3) == 0) {
                    tnext = 0.5 * (told + t);
                } else {
                    tnext = (dt2 * told - dt1 * t) / (dt2 - dt1);
                }
                told = t;
                t = tnext;
                } else {
                told = t;
                t = t + rci.dt;
                }
        
                if(t < 0.0 || t > 1.0) {
                break;
                }
            }
        
            if (!hit) {
                tstart = 1.0 - tstart;
            } else {
                break;
            }
            }

            if (!hit) {
                result.t = -1.0;
            } else {
                result.position = camera.position.xyz + result.t * ray.direction.xyz;
                let curvePosition = evaluateQuadraticBezier(curve, result.curveT);
                result.normal = normalize(result.position.xyz - curvePosition.xyz);
            }
        
            return result;
        }
    `;

    static gpuCodeGetOutputValue(variable: "color" | "normal" | "ao"): string {
        switch (variable) {
            case "color": {
                return `
                    let color = ${this.variableName}.color;
                `;
            }
            case "normal": {
                return `
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

    static gpuCodeGetBoundingRectangleVertex = /* wgsl */`
        let thickness: f32 = ${this.variableName}.p0.w;
    
        let aabb_min: vec3<f32> = min(${this.variableName}.p0.xyz, min(${this.variableName}.p1.xyz, ${this.variableName}.p2.xyz));
        let aabb_max: vec3<f32> = max(${this.variableName}.p0.xyz, max(${this.variableName}.p1.xyz, ${this.variableName}.p2.xyz));
          
        let center: vec3<f32> = 0.5 * (aabb_max + aabb_min);
        let radius: f32 = 0.5 * length(aabb_max - aabb_min) + thickness;

        let boundingRectangleVertex = sphereToBoundingRectangleVertex(center, radius, vertexIndex);
    `;
    //#endregion GPU Code

    public rayIntersection(ray: Ray): number | null {
        return null;
    }

    public toBoundingBoxes(): BoundingBox[] {
        return [];
    }

    private _bindGroup: GPUBindGroup | null = null;

    constructor(id: number, graphicsLibrary: GraphicsLibrary, allocator: Allocator, instances = 1) {
        super(id, graphicsLibrary, allocator);

        this._allocation = allocator.allocate(instances * 48);

        this.instances = instances;
        this.splineInstancedStruct = new r.Array(new r.Struct({
            p0: new r.Array(r.floatle, 4),
            p1: new r.Array(r.floatle, 4),
            p2: new r.Array(r.floatle, 4),
            color: new r.Array(r.floatle, 4)
        }), instances);
        this.properties = this.splineInstancedStruct.fromBuffer(new Uint8Array(this._allocation.cpuBuffer.inner.byteLength));

        this.onAllocationMoved();
    }

    public onAllocationMoved(): void {
        if (!this._allocation || !Spline.bindGroupLayouts[0]) {
            return;
        }

        this._bindGroup = this._graphicsLibrary.device.createBindGroup({
            layout: Spline.bindGroupLayouts[0],
            entries: [
                {
                    binding: 0, resource: {
                        buffer: this._allocation.gpuBuffer.inner,
                        offset: this._allocation.allocationRange.offset,
                        size: this._allocation.allocationRange.size,
                    }
                }
            ]
        });
    }

    public record(encoder: GPURenderPassEncoder, bindGroupLayoutsOffset = 1): void {
        if (!this._bindGroup) {
            return;
        }

        // Set bind group
        encoder.setBindGroup(bindGroupLayoutsOffset + 0, this._bindGroup);

        // Draw
        encoder.draw(4, this.instances, 0, 0);
    }

    public toBuffer(buffer: ArrayBuffer, offset: number): void {
        const u8View = new Uint8Array(buffer, offset);
        u8View.set(this.splineInstancedStruct.toBuffer(this.properties), 0);
    }
}