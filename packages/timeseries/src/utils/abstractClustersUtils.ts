import { vec3 } from "gl-matrix";

export function calculateSphereParameters(points: vec3[]) {
    let center: vec3 = vec3.fromValues(0, 0, 0);
    points.forEach(point => { vec3.add(center, center, point) });
    vec3.div(center, center, vec3.fromValues(points.length, points.length, points.length));

    let maxDist = 0;
    points.forEach(point => {
        const dist = vec3.dist(point, center); 
        if (dist > maxDist) maxDist = dist;
    });

    return {
        center: center,
        radius: maxDist,
    };
}