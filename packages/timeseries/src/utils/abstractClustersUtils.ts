import { vec3 } from "gl-matrix";
import PCA from 'pca-js';

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
    return Math.sqrt((b[0] - a[0]) * (b[0] - a[0]) + (b[1] - a[1]) * (b[1] - a[1]) + (b[2] - a[2]) * (b[2] - a[2]));
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

export function findClosestBlobs(blobs, centerPoints, maxDistance) {
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
          coneOrient[i].push(vec3.fromValues(
            closestBlobs[i][j][0] - blobs[i].center[0],
            closestBlobs[i][j][1] - blobs[i].center[1],
            closestBlobs[i][j][2] - blobs[i].center[2]
          ));
        }
      }

      return coneOrient;
}