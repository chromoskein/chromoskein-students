import { vec3 } from "gl-matrix";

export function lineToSpline(points: vec3[]) {
    // Pad the spline with invisible start and end point
    const startPoint = vec3.add(vec3.create(), vec3.sub(vec3.create(), points[0], points[1]), points[0]);
    const endPoint = vec3.add(vec3.create(), vec3.sub(vec3.create(), points[points.length - 1], points[points.length - 2]), points[points.length - 1]);

    const catmullRomPoints = new Array(points.length);
    for (let i = 0; i < points.length; i++) {
        catmullRomPoints[i] = vec3.clone(points[i]);
    }
    catmullRomPoints.unshift(startPoint);
    catmullRomPoints.push(endPoint);

    // N points creates N - 3 catmull rom splines.
    // N - 3 catmull rom splines are approximated by N - 3 cubic beziers
    // N - 3 cubic beziers are approximated by 2 * (N - 3) quadratic beziers
    const cubicBeziersLength = (catmullRomPoints.length - 3)
    const quadraticBeziersLength = 2 * cubicBeziersLength;

    const cubicBezierPoints = new Array(catmullRomPoints.length);
    const quadraticBeziers: vec3[] = new Array();

    for (let i = 0; i < catmullRomPoints.length - 3; i++) {
        let p0 = catmullRomPoints[i + 0];
        let p1 = catmullRomPoints[i + 1];
        let p2 = catmullRomPoints[i + 2];
        let p3 = catmullRomPoints[i + 3];

        const d1 = vec3.length(vec3.sub(vec3.create(), p0, p1));
        const d2 = vec3.length(vec3.sub(vec3.create(), p1, p2));
        const d3 = vec3.length(vec3.sub(vec3.create(), p2, p3));

        const alpha = 0.5;

        const d1_alpha = Math.pow(d1, alpha);
        const d2_alpha = Math.pow(d2, alpha);
        const d3_alpha = Math.pow(d3, alpha);
        const d1_2alpha = Math.pow(d1, 2.0 * alpha);
        const d2_2alpha = Math.pow(d2, 2.0 * alpha);
        const d3_2alpha = Math.pow(d3, 2.0 * alpha);

        cubicBezierPoints[i + 0] = vec3.create();
        cubicBezierPoints[i + 1] = vec3.create();
        cubicBezierPoints[i + 2] = vec3.create();
        cubicBezierPoints[i + 3] = vec3.create();

        cubicBezierPoints[i + 0] = p1;
        cubicBezierPoints[i + 3] = p2;

        cubicBezierPoints[i + 1][0] = (d1_2alpha * p2[0] - d2_2alpha * p0[0] + (2.0 * d1_2alpha + 3.0 * d1_alpha * d2_alpha + d2_2alpha) * p1[0]) / (3.0 * d1_alpha * (d1_alpha + d2_alpha));
        cubicBezierPoints[i + 1][1] = (d1_2alpha * p2[1] - d2_2alpha * p0[1] + (2.0 * d1_2alpha + 3.0 * d1_alpha * d2_alpha + d2_2alpha) * p1[1]) / (3.0 * d1_alpha * (d1_alpha + d2_alpha));
        cubicBezierPoints[i + 1][2] = (d1_2alpha * p2[2] - d2_2alpha * p0[2] + (2.0 * d1_2alpha + 3.0 * d1_alpha * d2_alpha + d2_2alpha) * p1[2]) / (3.0 * d1_alpha * (d1_alpha + d2_alpha));

        cubicBezierPoints[i + 2][0] = (d3_2alpha * p1[0] - d2_2alpha * p3[0] + (2.0 * d3_2alpha + 3.0 * d3_alpha * d2_alpha + d2_2alpha) * p2[0]) / (3.0 * d3_alpha * (d3_alpha + d2_alpha));
        cubicBezierPoints[i + 2][1] = (d3_2alpha * p1[1] - d2_2alpha * p3[1] + (2.0 * d3_2alpha + 3.0 * d3_alpha * d2_alpha + d2_2alpha) * p2[1]) / (3.0 * d3_alpha * (d3_alpha + d2_alpha));
        cubicBezierPoints[i + 2][2] = (d3_2alpha * p1[2] - d2_2alpha * p3[2] + (2.0 * d3_2alpha + 3.0 * d3_alpha * d2_alpha + d2_2alpha) * p2[2]) / (3.0 * d3_alpha * (d3_alpha + d2_alpha));

        p0 = cubicBezierPoints[i + 0];
        p1 = cubicBezierPoints[i + 1];
        p2 = cubicBezierPoints[i + 2];
        p3 = cubicBezierPoints[i + 3];

        const Q0 = vec3.clone(p0);
        const Q4 = vec3.clone(p3);
        const Q1 = vec3.create();
        Q1[0] = p0[0] + 1.5 * 0.5 * (p1[0] - p0[0]);
        Q1[1] = p0[1] + 1.5 * 0.5 * (p1[1] - p0[1]);
        Q1[2] = p0[2] + 1.5 * 0.5 * (p1[2] - p0[2]);
        const Q3 = vec3.create();
        Q3[0] = p3[0] - 1.5 * (1.0 - 0.5) * (p3[0] - p2[0]);
        Q3[1] = p3[1] - 1.5 * (1.0 - 0.5) * (p3[1] - p2[1]);
        Q3[2] = p3[2] - 1.5 * (1.0 - 0.5) * (p3[2] - p2[2]);
        const Q2 = vec3.create();
        Q2[0] = (1.0 - 0.5) * Q1[0] + 0.5 * Q3[0];
        Q2[1] = (1.0 - 0.5) * Q1[1] + 0.5 * Q3[1];
        Q2[2] = (1.0 - 0.5) * Q1[2] + 0.5 * Q3[2];

        quadraticBeziers.push(...[Q0, Q1, Q2]);
        quadraticBeziers.push(...[Q2, Q3, Q4]);
    }

    return quadraticBeziers;
}
