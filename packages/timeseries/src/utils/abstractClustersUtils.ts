import { vec3 } from "gl-matrix";
import PCA from 'pca-js';
import type { ClusterBlob } from "./main";

export interface PCAresult
{
    firstPCVec: vec3[];
    firstPCVal: number[];
    secondPCVal: number[];
}

function transformValues(valuesToTransform, allValues) {
    if (valuesToTransform.length == 1) {
      return [1.0];
    }

    let min = Math.min.apply(Math, allValues);
    let max = Math.max.apply(Math, allValues);
    for (let i = 0; i < valuesToTransform.length; i++) {
      valuesToTransform[i] = (valuesToTransform[i] - min) / (max - min);
    }
    return valuesToTransform;
  }

export function computePCA(blobs, selectedTimestep) {
    let PCAresult: PCAresult = {
        firstPCVec: [],
        firstPCVal: [],
        secondPCVal: []
    };
    for (let i = 0; i < blobs[selectedTimestep].length; i++) {
        let data =  blobs[selectedTimestep][i].normalizedPoints;
        let result = PCA.getEigenVectors(data);
        PCAresult.firstPCVec.push(result[0].vector);
        PCAresult.firstPCVal.push(result[0].eigenvalue);
        PCAresult.secondPCVal.push(result[1].eigenvalue);
    }
    
    // if there is only one blob, it cannot have the same height and radius (sphere)
    if (blobs[selectedTimestep].length == 1) {
        PCAresult.firstPCVal = [1.0];
        PCAresult.secondPCVal = [0.5];
    } else {
        let allValues = PCAresult.firstPCVal.concat(PCAresult.secondPCVal);
        PCAresult.firstPCVal = transformValues(PCAresult.firstPCVal, allValues);
        PCAresult.secondPCVal = transformValues(PCAresult.secondPCVal, allValues)
    }
    return PCAresult;
}

export function getCenterPoints(blobs, selectedTimestep) {
    let centerPoints: vec3[] = [];
    for (let i = 0; i < blobs[selectedTimestep].length; i++) {
        centerPoints.push(blobs[selectedTimestep][i].center);
    }
    return centerPoints;
}

function distance(a, b) {
    const dx = b[0] - a[0];
    const dy = b[1] - a[1];
    const dz = b[2] - a[2];

    const dist = Math.sqrt(dx * dx + dy * dy + dz * dz);

    return dist;
}

function sortedCenters(center, centers, index, maxDistance) {
    let distances = new Map<vec3, number>();

    for (let i = 0; i < centers.length; i++) {
        if (i == index) { continue; }
        distances.set(centers[i], distance(center, centers[i]));
    }

    let sorted = new Map([...distances.entries()].sort((a, b) => a[1] - b[1]));
    let result = [];
    for (let [key, value] of sorted) {
        if (value < maxDistance) {
            result.push(key);
        }
    }

    return result;
}

export function findClosestBlobsByCenters(blobs, centerPoints, maxDistance) {
    let closestBlobs: vec3[][] = [];
    for (let i = 0; i < blobs.length; i++) {
        closestBlobs[i] = [];
        closestBlobs[i] = sortedCenters(blobs[i].center, centerPoints, i, maxDistance);
      }
    return closestBlobs;
}

export function getConeOrientation(blobs, closestBlobs) {
    let coneOrient: vec3[][] = [];

    for (let i = 0; i < blobs.length; i++) {
        coneOrient[i] = [];
        for (let j = 0; j < closestBlobs[i].length; j++) {
            let normalizedVector = normalizeVector(vec3.fromValues(
                closestBlobs[i][j][0] - blobs[i].center[0],
                closestBlobs[i][j][1] - blobs[i].center[1],
                closestBlobs[i][j][2] - blobs[i].center[2]
              ));
            coneOrient[i].push(normalizedVector);
        }
      }

      return coneOrient;
}

function normalizeVector(vector) {
    let xx = vector[0] * vector[0];
    let yy = vector[1] * vector[1];
    let zz = vector[2] * vector[2];

    let length = Math.sqrt(xx + yy + zz);

    let newX = vector[0] / length;
    let newY = vector[1] / length;
    let newZ = vector[2] / length;

    return vec3.fromValues(newX, newY, newZ);
}

function addPoints(a, b) {
    let dx = a[0] + b[0];
    let dy = a[1] + b[1];
    let dz = a[2] + b[2];
    
    return vec3.fromValues(dx,dy,dz);
}

function findClosestPair(blob1: ClusterBlob, blob2: ClusterBlob): pair {
    let minDst = Infinity;
    let closestPair: pair;

    for (let i = 0; i < blob1.normalizedPoints.length; i++) {
        for (let j = 0; j < blob2.normalizedPoints.length; j++) {
            let dst = distance(addPoints(blob1.normalizedPoints[i], blob1.center), addPoints(blob2.normalizedPoints[j], blob2.center));
            if (dst < minDst) {
                closestPair = {
                    minDistance: dst,
                    point1: blob1.normalizedPoints[i],
                    point2: blob2.normalizedPoints[j]
                };
                minDst = dst;
            }
        } 
    }
    
    return closestPair;

}

type pair = {
    minDistance: number;
    point1: vec3;
    point2: vec3;   
}

function findClosestBlobsForOneBlob(blob: ClusterBlob, blobs: ClusterBlob[], maxDistance: number): Map<number, pair> {

    // number in map is the index of the blob
    let result = new Map<number, pair>();

    for (let i = 0; i < blobs.length; i++) {
        if (blobs[i] == blob) continue;
        let closestPair = findClosestPair(blob, blobs[i]);
        if (closestPair.minDistance > maxDistance) continue;
        result.set(i, closestPair);
    }

    return result;

}

export function findClosestBlobsByClosestPoints(blobs: ClusterBlob[], maxDistance: number) {
    let closestBlobs: vec3[][] = [];
    let blobDistance: number[][] = [];
    
    for (let i = 0; i < blobs.length; i++) {
        closestBlobs[i] = [];
        blobDistance[i] = [];
        let newMap = findClosestBlobsForOneBlob(blobs[i], blobs, maxDistance);
    
        for (let [index, pair] of newMap) {
            closestBlobs[i].push(blobs[index].center);
            blobDistance[i].push(pair.minDistance);
        }
      }

    return {closestBlobs, blobDistance};
}