
import { GridTextureSize } from "./signedDistanceGrid";

export const signedDistanceGridFromPoints = () => {
    return /* wgsl */`

fn opSmoothUnion(d1: f32, d2: f32, k: f32) -> f32 {
    let h = clamp( 0.5 + 0.5*(d2-d1)/k, 0.0, 1.0 );

    return mix( d2, d1, h ) - k*h*(1.0-h); 
}

fn sdCapsule(p: vec3<f32>, a: vec3<f32>, b: vec3<f32>, r: f32 ) -> f32
{
  let pa = p - a;
  let ba = b - a;

  let h = clamp( dot(pa,ba) / dot(ba,ba), 0.0, 1.0 );

  return length( pa - ba*h ) - r;
}

fn sdSphere(p: vec3<f32>, c: vec3<f32>, s: f32 ) -> f32
{
  return distance(p, c) - s;
}

// @group(0) @binding(0) var<uniform> globals: GlobalsStruct;
@group(0) @binding(0) var<storage, read> points: array<vec4<f32>>;
@group(0) @binding(1) var grid: texture_storage_3d<r32float, write>;
@group(0) @binding(2) var<storage, read> delimiters: array<u32>;

@compute @workgroup_size(4, 4, 4) fn main(@builtin(global_invocation_id) GlobalInvocationID: vec3<u32>) {
    let positionNDC = (1.0 / ${GridTextureSize}) * vec3<f32>(GlobalInvocationID.xyz) + vec3<f32>(1.0 / ${2 * GridTextureSize});
    let p = 2.0 * (positionNDC - vec3<f32>(0.5)); // [-1, 1]

    let radius = points[0].w;
    
    var sdf = sdCapsule(p, points[0].xyz, points[1].xyz, radius);
    let len: u32 = arrayLength(&points);
    for(var i: u32 = delimiters[0]; i < delimiters[1] - 1; i++) {
        let p1 = points[i].xyz;
        let p2 = points[i + 1].xyz;

        let sdf2 = sdCapsule(p, p1, p2, radius);
        sdf = opSmoothUnion(sdf, sdf2, 0.1);
    }

    textureStore(grid, GlobalInvocationID, vec4<f32>(sdf));   
}
`};
