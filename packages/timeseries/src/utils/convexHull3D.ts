import { vec3 } from "gl-matrix";
import type { Vertex } from "@chromoskein/lib-graphics";

/**
 * One triangular facet of the hull. Vertices index into the point array handed to convexHull().
 * (nx, ny, nz) is the outward unit normal and offset is the plane offset, so that
 * nx*x + ny*y + nz*z - offset is the signed distance of a point from the facet's plane.
 */
interface Facet {
    a: number;
    b: number;
    c: number;

    nx: number;
    ny: number;
    nz: number;
    offset: number;

    visible: boolean;
}

/** An edge of the horizon: the two vertices plus how many visible facets claim it. */
interface HorizonEdge {
    u: number;
    v: number;
    claims: number;
}

function squaredDistance(a: vec3, b: vec3): number {
    let dx = a[0] - b[0];
    let dy = a[1] - b[1];
    let dz = a[2] - b[2];

    return dx * dx + dy * dy + dz * dz;
}

function squaredDistanceToLine(p: vec3, a: vec3, b: vec3): number {
    let ax = b[0] - a[0];
    let ay = b[1] - a[1];
    let az = b[2] - a[2];

    let length = ax * ax + ay * ay + az * az;
    if (length === 0) {
        return squaredDistance(p, a);
    }

    let t = ((p[0] - a[0]) * ax + (p[1] - a[1]) * ay + (p[2] - a[2]) * az) / length;
    t = Math.max(0, Math.min(1, t));

    return squaredDistance(p, [a[0] + ax * t, a[1] + ay * t, a[2] + az * t] as vec3);
}

function squaredDistanceToPlane(p: vec3, a: vec3, b: vec3, c: vec3): number {
    let nx = (b[1] - a[1]) * (c[2] - a[2]) - (b[2] - a[2]) * (c[1] - a[1]);
    let ny = (b[2] - a[2]) * (c[0] - a[0]) - (b[0] - a[0]) * (c[2] - a[2]);
    let nz = (b[0] - a[0]) * (c[1] - a[1]) - (b[1] - a[1]) * (c[0] - a[0]);

    let length = Math.sqrt(nx * nx + ny * ny + nz * nz);
    if (length === 0) {
        return 0;
    }

    return (nx * (p[0] - a[0]) + ny * (p[1] - a[1]) + nz * (p[2] - a[2])) ** 2 / length ** 2;
}

/** Index of the point that the given distance function is largest for. */
function farthest(points: vec3[], distance: (p: vec3) => number): number {
    let index = 0;
    let best = -Infinity;

    for (let i = 0; i < points.length; i++) {
        let d = distance(points[i]);
        if (d > best) {
            best = d;
            index = i;
        }
    }

    return index;
}

/**
 * Build the facet spanned by three points, oriented so that it faces away from `reference`.
 * Returns null for triples that are degenerate, i.e. that carry no surface at all.
 */
function createFacet(
    points: vec3[],
    i: number,
    j: number,
    k: number,
    reference: vec3,
    minTwiceArea: number
): Facet | null {
    let pi = points[i];
    let pj = points[j];
    let pk = points[k];

    // Unnormalised normal, (pj - pi) x (pk - pi). Its length is twice the area of the triangle.
    let nx = (pj[1] - pi[1]) * (pk[2] - pi[2]) - (pj[2] - pi[2]) * (pk[1] - pi[1]);
    let ny = (pj[2] - pi[2]) * (pk[0] - pi[0]) - (pj[0] - pi[0]) * (pk[2] - pi[2]);
    let nz = (pj[0] - pi[0]) * (pk[1] - pi[1]) - (pj[1] - pi[1]) * (pk[0] - pi[0]);

    let length = Math.sqrt(nx * nx + ny * ny + nz * nz);
    if (!isFinite(length) || length < minTwiceArea) {
        return null;
    }

    // The reference point stays strictly inside the hull, so a facet faces outwards exactly when
    // its normal points away from it. Flipping the winding along with the normal keeps the emitted
    // triangle order consistent with the normals.
    if (nx * (pi[0] - reference[0]) + ny * (pi[1] - reference[1]) + nz * (pi[2] - reference[2]) < 0) {
        nx = -nx;
        ny = -ny;
        nz = -nz;

        let swap = j;
        j = k;
        k = swap;
    }

    nx /= length;
    ny /= length;
    nz /= length;

    return {
        a: i,
        b: j,
        c: k,
        nx: nx,
        ny: ny,
        nz: nz,
        offset: nx * pi[0] + ny * pi[1] + nz * pi[2],
        visible: false,
    };
}

/**
 * Convex hull of a set of 3D points, as a flat list of triangles with a per-face (flat shaded)
 * normal, ready to be assigned to the vertices of a Graphics.Mesh.
 *
 * Facets are grown one point at a time: a point either lies inside the current hull or deletes the
 * facets it can see, replacing the resulting hole with new facets hung off the horizon. Fewer than
 * four points that do not span a volume have no hull, so those yield an empty array.
 */
export function convexHull(points: vec3[]): Vertex[] {
    // Non-finite coordinates would poison every distance test, so drop them up front.
    let source = points.filter((p) => isFinite(p[0]) && isFinite(p[1]) && isFinite(p[2]));
    if (source.length < 4) {
        return [];
    }

    // All tolerances are relative to the extent of the data, so that they mean the same thing
    // whatever scale the points happen to be expressed in.
    let min = [Infinity, Infinity, Infinity];
    let max = [-Infinity, -Infinity, -Infinity];
    for (const p of source) {
        for (let axis = 0; axis < 3; axis++) {
            min[axis] = Math.min(min[axis], p[axis]);
            max[axis] = Math.max(max[axis], p[axis]);
        }
    }

    let diagonal = Math.sqrt(
        (max[0] - min[0]) ** 2 + (max[1] - min[1]) ** 2 + (max[2] - min[2]) ** 2
    );
    if (!(diagonal > 0)) {
        return [];
    }

    let tolerance = diagonal * 1e-9;
    let minTwiceArea = diagonal * diagonal * 1e-18;

    // Seed the hull with a tetrahedron of well separated points, each stage picking the point
    // farthest from what the previous stages span. Any stage coming up short means the points are
    // coincident, collinear or coplanar, and enclose nothing.
    let i0 = 0;
    let a = source[i0];

    let i1 = farthest(source, (p) => squaredDistance(p, a));
    let b = source[i1];
    if (squaredDistance(a, b) <= tolerance * tolerance) {
        return [];
    }

    let i2 = farthest(source, (p) => squaredDistanceToLine(p, a, b));
    let c = source[i2];
    if (squaredDistanceToLine(c, a, b) <= tolerance * tolerance) {
        return [];
    }

    let i3 = farthest(source, (p) => squaredDistanceToPlane(p, a, b, c));
    let d = source[i3];
    if (squaredDistanceToPlane(d, a, b, c) <= tolerance * tolerance) {
        return [];
    }

    // The seed tetrahedron is contained in the hull of every subset of points processed below, so
    // its centroid stays strictly interior throughout and can orient every facet we ever create.
    let reference = vec3.fromValues(
        (a[0] + b[0] + c[0] + d[0]) / 4,
        (a[1] + b[1] + c[1] + d[1]) / 4,
        (a[2] + b[2] + c[2] + d[2]) / 4
    );

    let facets: Facet[] = [];
    let seed: [number, number, number][] = [
        [i0, i1, i2],
        [i0, i1, i3],
        [i0, i2, i3],
        [i1, i2, i3],
    ];
    for (const [i, j, k] of seed) {
        let facet = createFacet(source, i, j, k, reference, minTwiceArea);
        if (facet) {
            facets.push(facet);
        }
    }

    if (facets.length < 4) {
        return [];
    }

    let spread = source.length;

    for (let i = 0; i < source.length; i++) {
        if (i === i0 || i === i1 || i === i2 || i === i3) {
            continue;
        }

        let p = source[i];

        let visible = 0;
        for (const facet of facets) {
            facet.visible = facet.nx * p[0] + facet.ny * p[1] + facet.nz * p[2] - facet.offset > tolerance;
            if (facet.visible) {
                visible++;
            }
        }

        // Nothing in sight means the point is inside the hull already. Seeing literally everything
        // cannot happen for a closed hull and can only be numerical trouble, so leave the hull alone
        // rather than dissolve it.
        if (visible === 0 || visible === facets.length) {
            continue;
        }

        // Every edge of a closed hull belongs to exactly two facets, so an edge claimed by a single
        // visible facet borders the invisible rest of the surface: it is on the horizon.
        let horizon = new Map<number, HorizonEdge>();
        for (const facet of facets) {
            if (!facet.visible) {
                continue;
            }

            let edges: [number, number][] = [
                [facet.a, facet.b],
                [facet.b, facet.c],
                [facet.c, facet.a],
            ];
            for (const [u, v] of edges) {
                let key = u < v ? u * spread + v : v * spread + u;
                let edge = horizon.get(key);

                if (edge) {
                    edge.claims++;
                } else {
                    horizon.set(key, { u: u, v: v, claims: 1 });
                }
            }
        }

        let grown: Facet[] = facets.filter((facet) => !facet.visible);
        for (const edge of horizon.values()) {
            if (edge.claims !== 1) {
                continue;
            }

            let facet = createFacet(source, i, edge.u, edge.v, reference, minTwiceArea);
            if (facet) {
                grown.push(facet);
            }
        }

        facets = grown;
    }

    let vertices: Vertex[] = [];
    for (const facet of facets) {
        // Facets never end up degenerate here: their normal is only ever read back, never renormalised.
        let triangle: number[] = [facet.a, facet.b, facet.c];

        for (const index of triangle) {
            let p = source[index];
            vertices.push({
                position: [p[0], p[1], p[2], 1],
                normal: [facet.nx, facet.ny, facet.nz, 0],
            });
        }
    }

    return vertices;
}
