import type { vec3 } from "gl-matrix";
import PCA from 'pca-js';

export interface PCAresult
{
    vectors: vec3[];
    eigenvalues: number[];
}

function transformValues(values) {
    if (values.length == 1) {
      return [1.0];
    }

    let min = Math.min.apply(Math, values);
    let max = Math.max.apply(Math, values);
    for (let i = 0; i < values.length; i++) {
      values[i] = (values[i] - min) / (max - min);
    }
    return values;
  }

export function computePCA(index, blobs, selectedTimestep, computeVectors) {
    let PCAresult: PCAresult = {
        vectors: [],
        eigenvalues: []
    };
    for (let i = 0; i < blobs[selectedTimestep].length; i++) {
        let data =  blobs[selectedTimestep][i].normalizedPoints;
        let result = PCA.getEigenVectors(data);
        if (computeVectors) {
            PCAresult.vectors.push(result[index].vector);
        }
        PCAresult.eigenvalues.push(result[index].eigenvalue);
    }
    PCAresult.eigenvalues = transformValues(PCAresult.eigenvalues);
    return PCAresult;
}

export function getCenterPoints(blobs, selectedTimestep) {
    let centerPoints: vec3[] = [];
    for (let i = 0; i < blobs[selectedTimestep].length; i++) {
        centerPoints.push(blobs[selectedTimestep][i].center);
    }
    return centerPoints;
}