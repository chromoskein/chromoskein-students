import type { vec3 } from "gl-matrix";
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