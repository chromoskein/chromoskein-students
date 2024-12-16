import { vec3, vec4 } from "gl-matrix";

import { CsvDelimiter, parseXyz } from "lib-dataloader";
import { clusterDataSequential } from "./hclust";
import * as Graphics from "@chromoskein/lib-graphics";


export const clamp = (num: number, min: number, max: number) => Math.min(Math.max(num, min), max);
export const mix = (start: number, end: number, amt: number) => (1 - amt) * start + amt * end;

export function distanceSmoothUnion(d1: number, d2: number, k: number): number {
    const h = clamp(0.5 + 0.5 * (d2 - d1) / k, 0.0, 1.0);
    return mix(d2, d1, h) - k * h * (1.0 - h);
}

export function distanceCapsule(p: vec3, a: vec3, b: vec3, r: number): number {
    const pa = vec3.sub(vec3.create(), p, a);
    const ba = vec3.sub(vec3.create(), b, a);
    const h = clamp(vec3.dot(pa, ba) / vec3.dot(ba, ba), 0.0, 1.0);

    const result = vec3.length(vec3.sub(vec3.create(), pa, vec3.scale(vec3.create(), ba, h)));
    return result - r;
}

function loadGrid(
    signedDistanceGrid: Float32Array,
    gridSize: number = 64,
    p: vec3): number {
    let x = clamp(p[0], 0, gridSize - 1);
    let y = clamp(p[1], 0, gridSize - 1);
    let z = clamp(p[2], 0, gridSize - 1);

    let i = z * (gridSize * gridSize) + y * gridSize + x;

    return signedDistanceGrid[i];
}

function sampleGrid(
    signedDistanceGrid: Float32Array,
    gridSize: number = 64,
    p: vec3): number {
    let coords = vec3.clone(p);
    vec3.scale(coords, coords, 0.5);
    vec3.add(coords, coords, vec3.fromValues(0.5, 0.5, 0.5));
    vec3.scale(coords, coords, gridSize);

    let coordsU32 = vec3.fromValues(Math.floor(coords[0]), Math.floor(coords[1]), Math.floor(coords[2]));
    let coordsFract = vec3.fromValues(coords[0] % 1, coords[1] % 1, coords[2] % 1);
    let tx = coordsFract[0];
    let ty = coordsFract[1];
    let tz = coordsFract[2];

    let c000 = loadGrid(signedDistanceGrid, gridSize, vec3.add(vec3.create(), coordsU32, vec3.fromValues(0, 0, 0)));
    let c100 = loadGrid(signedDistanceGrid, gridSize, vec3.add(vec3.create(), coordsU32, vec3.fromValues(1, 0, 0)));
    let c010 = loadGrid(signedDistanceGrid, gridSize, vec3.add(vec3.create(), coordsU32, vec3.fromValues(0, 1, 0)));
    let c110 = loadGrid(signedDistanceGrid, gridSize, vec3.add(vec3.create(), coordsU32, vec3.fromValues(1, 1, 0)));
    let c001 = loadGrid(signedDistanceGrid, gridSize, vec3.add(vec3.create(), coordsU32, vec3.fromValues(0, 0, 1)));
    let c101 = loadGrid(signedDistanceGrid, gridSize, vec3.add(vec3.create(), coordsU32, vec3.fromValues(1, 0, 1)));
    let c011 = loadGrid(signedDistanceGrid, gridSize, vec3.add(vec3.create(), coordsU32, vec3.fromValues(0, 1, 1)));
    let c111 = loadGrid(signedDistanceGrid, gridSize, vec3.add(vec3.create(), coordsU32, vec3.fromValues(1, 1, 1)));

    return (1.0 - tx) * (1.0 - ty) * (1.0 - tz) * c000 +
        tx * (1.0 - ty) * (1.0 - tz) * c100 +
        (1.0 - tx) * ty * (1.0 - tz) * c010 +
        tx * ty * (1.0 - tz) * c110 +
        (1.0 - tx) * (1.0 - ty) * tz * c001 +
        tx * (1.0 - ty) * tz * c101 +
        (1.0 - tx) * ty * tz * c011 +
        tx * ty * tz * c111;
}

/* import { marchingCubes } from 'marching-cubes-fast';
import { deindexTriangles_meshView } from 'triangles-index';
export function signedDistanceGridToMesh(
    signedDistanceGrid: Float32Array,
    gridSize: number = 64,
    marchinCubesResolution: number = 128): Array<Graphics.Vertex> {
    const vertices: Array<Graphics.Vertex> = [];

    const sdf = function (x: number, y: number, z: number) {
        return sampleGrid(signedDistanceGrid, gridSize, vec3.fromValues(x, y, z));
    };

    const sdfResult = marchingCubes(marchinCubesResolution, sdf, [
        [-1.0, -1.0, -1.0],
        [1.0, 1.0, 1.0]
    ]);

    const sdfResultTriangles = deindexTriangles_meshView(sdfResult);

    for (let i = 0; i < sdfResultTriangles.length; i++) {
        const p0 = sdfResultTriangles[i][0];
        const p1 = sdfResultTriangles[i][1];
        const p2 = sdfResultTriangles[i][2];

        let u = vec3.fromValues(p1[0] - p0[0], p1[1] - p0[1], p1[2] - p0[0]);
        let v = vec3.fromValues(p2[0] - p1[0], p2[1] - p1[1], p2[2] - p1[0]);

        var n = vec3.normalize(vec3.create(), vec3.cross(vec3.create(), u, v));

        vertices.push({
            position: [p0[0], p0[1], p0[2], 1.0],
            normal: [n[0], n[1], n[2], 0.0],
        });
        vertices.push({
            position: [p1[0], p1[1], p1[2], 1.0],
            normal: [n[0], n[1], n[2], 0.0],
        });
        vertices.push({
            position: [p2[0], p2[1], p2[2], 1.0],
            normal: [n[0], n[1], n[2], 0.0],
        });
    }

    return vertices;
} */

export async function loadTimesteps(filenames: string[]): Promise<vec3[][]> {
    const result: vec3[][] = [];

    for (let i = 0; i < filenames.length; i++) {
        const response = await (
            await fetch(filenames[i])
        ).text();

        const bins = parseXyz(
            response,
            {
                delimiter: CsvDelimiter.Space,
                hasHeader: false,
            },
            [1, 2, 3]
        ).positions.map((v) => vec3.fromValues(v.x, v.y, v.z));

        result.push(bins);
    }

    return result;
}

export async function loadBEDfile(filename: string): Promise<string> {
    const result = await ((await (fetch(filename))).text());
    return result;
}

export function normalizePointClouds(pointClouds: vec3[][]): vec3[][] {
    const result: vec3[][] = new Array(pointClouds.length);

    let bbMax = vec3.fromValues(
        Number.MIN_VALUE,
        Number.MIN_VALUE,
        Number.MIN_VALUE
    );
    let bbMin = vec3.fromValues(
        Number.MAX_VALUE,
        Number.MAX_VALUE,
        Number.MAX_VALUE
    );

    for (let i = 0; i < pointClouds.length; i++) {
        const bins = pointClouds[i];
        bbMax = bins.reduce((a, b) => vec3.max(vec3.create(), a, b), bbMax);
        bbMin = bins.reduce((a, b) => vec3.min(vec3.create(), a, b), bbMin);
    }

    let bbCenter = vec3.scale(
        vec3.create(),
        vec3.add(vec3.create(), bbMax, bbMin),
        0.5
    );
    let bbSides = vec3.sub(vec3.create(), bbMax, bbMin);
    bbSides.forEach((v: number) => Math.abs(v));
    const largestSide = 0.5 * Math.max(...bbSides);
    let bbLength = vec3.fromValues(
        1.0 / largestSide,
        1.0 / largestSide,
        1.0 / largestSide
    );

    for (let i = 0; i < pointClouds.length; i++) {
        result[i] = pointClouds[i].map((a) =>
            vec3.mul(vec3.create(), vec3.sub(vec3.create(), a, bbCenter), bbLength)
        );
    }

    return result;
}

export function timestepsToPathlines(timesteps: vec3[][]): vec3[][] {
    const result: vec3[][] = [];

    for (let positionIndex = 0; positionIndex < timesteps[0].length; positionIndex += 1) {
        result[positionIndex] = [];
        for (let timestep = 0; timestep < timesteps.length; timestep++) {
            result[positionIndex].push(timesteps[timestep][positionIndex]);
        }
    }

    return result;
}

/**
 * 
 * @param pathlines 
 * 
 * @returns [clusters][splines][timeseriesPoints]
 */
// export function pathlinesCluster(pathlines: vec3[][]): AbstractCluster<vec3[]> {
//     // Distance function required by all linkage strategies
//     const distFunc = (a: vec3[], b: vec3[]): number => {
//         const distances = Array(a.length);
//         for (let i = 0; i < distances.length; i++) {
//             distances[i] = vec3.distance(a[i], b[i]);
//         }

//         return distances.reduce((a, b) => a + b, 0);
//     };

//     const hc = new HierarchicalClustering<vec3[]>(
//         pathlines,
//         new AverageLinkage(distFunc)
//     );

//     return hc.cluster();
// }

export function centroid(points: vec3[]): vec3 {
    const sum = points.reduce((a, b) => vec3.add(vec3.create(), a, b));

    return vec3.scale(vec3.create(), sum, 1.0 / points.length);
}

export function averagePathlines(pathlines: vec3[][]): vec3[] {
    const splinesLength = pathlines.length;
    const averagedSplineLength = pathlines[0].length;
    const averagedSpline: vec3[] = new Array(averagedSplineLength);

    for (let j = 0; j < averagedSplineLength; j++) {
        averagedSpline[j] = vec3.create();
    }

    for (let splineIndex = 0; splineIndex < splinesLength; splineIndex++) {
        for (
            let timestepIndex = 0;
            timestepIndex < averagedSplineLength;
            timestepIndex++
        ) {
            vec3.add(
                averagedSpline[timestepIndex],
                averagedSpline[timestepIndex],
                pathlines[splineIndex][timestepIndex]
            );
        }
    }

    for (let j = 0; j < averagedSplineLength; j++) {
        vec3.scale(
            averagedSpline[j],
            averagedSpline[j],
            1.0 / splinesLength
        );
    }

    return averagedSpline;
}

export async function loadBitmap(source: string): Promise<ImageBitmap> {  
    let image = new Image();
    image.src = source;

    await image.decode();

    let bitmap = await createImageBitmap(image);

    return bitmap;
}

export type ClusterNode = {
    k: number;
    i: number;
    
    from: number;    
    to: number;
    
    color: vec3;
    
    children: number[];
}


export function clusterPathlines(pathlines: vec3[][]): ClusterNode[][] {
    const distFunc = (a: vec3[], b: vec3[]): number => {
        const distances = Array(a.length);
        for (let i = 0; i < distances.length; i++) {
            distances[i] = vec3.distance(a[i], b[i]);
        }
        
        return distances.reduce((a, b) => a + b, 0);
    };
    
    const { clusters, distances, order, clustersGivenK } = clusterDataSequential(pathlines, distFunc);
    
    const kClustersRanges: ClusterNode[][] = new Array(clustersGivenK.length);
    for (const [k, kClusters] of clustersGivenK.entries()) {
        kClustersRanges[k] = [];
        for (let i = 0; i < kClusters.length; i++) {
            let min = Math.min(...kClusters[i]);
            let max = Math.max(...kClusters[i])
            
            kClustersRanges[k][i] = {
                k, i,
                from: min,
                to: max,
                color: [0.0, 0.0, 0.0],
                children: [],
            };
        }
        // This is unnecessary because cluters remain sorted when clustering sequentially
        //kClustersRanges[k].sort((a, b) => a.from - b.from);
        //kClustersRanges[k].forEach((c, i) => c.i = i);
    }
    
    // Retain only the top 50 levels of hierarchy
    kClustersRanges.splice(50, kClustersRanges.length);
    for (const [k, kClusters] of kClustersRanges.entries()) {
        if (k >= kClustersRanges.length - 1) break;
        for (const [i, cluster] of kClusters.entries()) {
            cluster.children = kClustersRanges[k + 1].filter(r => cluster.from <= r.from && r.to <= cluster.to).map(c => c.i);
        }
    }
    
    return flattenClusters(kClustersRanges);
}

export function clusterTimestep(timestep: vec3[]): ClusterNode[][] {
    const distFunc = (a: vec3, b: vec3): number => {
        return vec3.distance(a, b);
    };
    
    const { clusters, distances, order, clustersGivenK } = clusterDataSequential(timestep, distFunc);
    
    const kClustersRanges: ClusterNode[][] = new Array(clustersGivenK.length);
    for (const [k, kClusters] of clustersGivenK.entries()) {
        kClustersRanges[k] = [];
        
        for (let i = 0; i < kClusters.length; i++) {
            let min = Math.min(...kClusters[i]);
            let max = Math.max(...kClusters[i])

            kClustersRanges[k][i] = {
                k, i,
                from: min,
                to: max,
                color: [0.0, 0.0, 0.0],
                children: [],
            };
        }
        // This is unnecessary because cluters remain sorted when clustering sequentially
        kClustersRanges[k].sort((a, b) => a.from - b.from);
        kClustersRanges[k].forEach((c, i) => c.i = i);
    }
    
    // Retain only the top 50 levels of hierarchy
    kClustersRanges.splice(50, kClustersRanges.length);
    for (const [k, kClusters] of kClustersRanges.entries()) {
        if (k >= kClustersRanges.length - 1) break;
        for (const [i, cluster] of kClusters.entries()) {
            cluster.children = kClustersRanges[k + 1].filter(r => cluster.from <= r.from && r.to <= cluster.to).map(c => c.i);
        }
    }
    
    return flattenClusters(kClustersRanges);
}

export async function clusterTimestepAsync(timestep: vec3[]): Promise<ClusterNode[][]> {
    return clusterTimestep(timestep);
}

function flattenClusters(clusters: ClusterNode[][]) {
    const minSize = (clusters[1][0].to - clusters[1][0].from) / 12.0;
    let hierarchy: ClusterNode[][] = [[]];

    flattenHierarchyRecursive(clusters, hierarchy, clusters[1][0], 1, 0, minSize);

    for (let k = 1; k < hierarchy.length - 1; k++) {
        hierarchy[k].forEach(cluster => {
            if (cluster.children.length < 2) {
                let i = hierarchy[k + 1].length;
                hierarchy[k + 1].push({k: k + 1, i: i, from: cluster.from, to: cluster.to, color: [0, 0, 0], children: []})
                cluster.children.push(i);
            }
        });
    }

    hierarchy.forEach(level => {
        level.sort((a, b) => a.from - b.from);
    });

    return hierarchy;
}

function flattenHierarchyRecursive(clusters: ClusterNode[][], hierarchy: ClusterNode[][], currentCluster: ClusterNode, k: number, i: number, minSize: number) {
    // Create a new level of hierarchy in case it is needed
    if (hierarchy.length - 1 < k) {
        hierarchy.push([]);
    }

    // Push yourself into the hierarchy
    const newCluster: ClusterNode = {k: k, i: i, from: currentCluster.from, to: currentCluster.to, color: [0, 0, 0], children: []};
    hierarchy[k].push(newCluster);

    // Break loop if clusters get too small
    if (newCluster.to - newCluster.from + 1 < minSize) return;

    if (currentCluster.children.length == 0)  return;

    // Flattening is needed if there is only a single child
    let k_i = currentCluster.k;
    let i_i = currentCluster.i;
    if (currentCluster.children.length == 1) {
        while (clusters[k_i][i_i] && clusters[k_i][i_i].children.length == 1) {
            if (clusters[k_i][i_i] == null || clusters[k_i][i_i].children.length == 0) {
                return;
            }

            i_i = clusters[k_i][i_i].children[0];
            k_i++;
        }
    } 

    // End recursion if there are no more levels in the hierarchy
    if (k_i + 1 > clusters.length - 1) {
        return;
    }
    
    let child_idx = (hierarchy.length - 1 < k + 1) ? 0 : hierarchy[k + 1].length;
    for (let child = 0; child < clusters[k_i][i_i].children.length; child++) {
        flattenHierarchyRecursive(clusters, hierarchy, clusters[k_i + 1][clusters[k_i][i_i].children[child]], k + 1, child_idx, minSize);
        newCluster.children.push(child_idx);
        child_idx++;
    } 
}

export type ClusterBlob = {
    normalizedPoints: vec3[];
    center: vec3;
    scale: number;   
}

export function blobFromPoints(points: vec3[]): ClusterBlob {
    let bb = Graphics.boundingBoxFromPoints(points);
    Graphics.boundingBoxCalculateCenter(bb);
    
    let bbSizeLengthsVec3 = vec3.sub(vec3.create(), bb.max, bb.min);
    let bbSizeLengths = [Math.abs(bbSizeLengthsVec3[0]), Math.abs(bbSizeLengthsVec3[1]), Math.abs(bbSizeLengthsVec3[2])];
    let maxLength = Math.max(...bbSizeLengths) * 0.25;
    
    bb.min = vec3.add(vec3.create(), bb.min, vec3.fromValues(-maxLength, -maxLength, -maxLength));
    bb.max = vec3.add(vec3.create(), bb.max, vec3.fromValues(maxLength, maxLength, maxLength));
    
    const normalizedPoints: Array<vec3> = Graphics.normalizePointsByBoundingBox(bb, points);
    
    bbSizeLengthsVec3 = vec3.sub(vec3.create(), bb.max, bb.min);
    bbSizeLengths = [Math.abs(bbSizeLengthsVec3[0]), Math.abs(bbSizeLengthsVec3[1]), Math.abs(bbSizeLengthsVec3[2])];
    maxLength = Math.max(...bbSizeLengths);
    
    return {
        normalizedPoints,
        center: vec3.clone(bb.center),
        scale: 0.5 * maxLength,
    };
}


export enum VisualisationType {
    None = "None",
    Implicit = "Implicit",
    Pathline = "Pathline",
    Spheres = "Spheres",
    Spline = "Spline",
    Volume = "Volume",
    Matryoshka = "Matryoshka",
    AbstractSpheres = "AbstractSpheres",
    Cones = "Cones",
    Hedgehog = "Hedgehog",
    Composite = "Composite",
    Test = "Test"
  }
    // const bytes = new TextEncoder().encode(JSON.stringify(clustersGivenK));
    // const blob = new Blob([bytes], {
    //   type: "application/json;charset=utf-8",
    // });
    // saveAs(blob, `clusters.json`);