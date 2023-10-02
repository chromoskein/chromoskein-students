import { vec3, vec4 } from "gl-matrix";

export type Tree = {
    sphere: vec4;

    volumeLeftScore: number;
    volumeRightScore: number;
    splitScore: number;

    left: Tree | null;
    right: Tree | null;
}

function minimumBoundingSphereOfSpheres(spheres: vec4[], wasmModule): vec4 {
    const atomsFloatArray = new wasmModule.VectorFloat();
    for (let i = 0; i < spheres.length; i++) {
        atomsFloatArray.push_back(spheres[i][0]);
        atomsFloatArray.push_back(spheres[i][1]);
        atomsFloatArray.push_back(spheres[i][2]);
        atomsFloatArray.push_back(spheres[i][3]);
    }

    const result = wasmModule["minimumBoundingSpheres"](atomsFloatArray);
    const reusltVec4 = vec4.fromValues(
        result.get(0),
        result.get(1),
        result.get(2),
        result.get(3)
    );

    atomsFloatArray.delete();
    result.delete();

    return reusltVec4;
}

const sphereVolume = (radius: number) => {
    return (4.0 / 3.0) * Math.PI * radius * radius * radius;
};

const sphereH = (d: number, r1: number, r2: number) => {
    return (1.0 / (2.0 * d)) *
        Math.sqrt(4.0 * d * d * r1 * r1 - (d * d - r2 * r2 + r1 * r1) * (d * d - r2 * r2 + r1 * r1));
}

export function buildTree(spheres: vec4[], wasmModule): Tree | null {
    if (spheres.length == 1) {
        return {
            sphere: spheres[0],
            right: null,
            left: null,
            volumeLeftScore: 0,
            volumeRightScore: 0,
            splitScore: 0,
        }
    }

    if (spheres.length == 0) {
        return null;
    }

    let tree = {
        sphere: minimumBoundingSphereOfSpheres(spheres, wasmModule),
        left: null,
        right: null,
        volumeLeftScore: 0,
        volumeRightScore: 0,
        splitScore: 0,
    };
    
    // console.time("findMinimumSplit");
    let minimumSplit = 1;
    let minimumSplitRatio = 0.0;
    for (let split = 1; split < spheres.length - 1; split++) {
        const leftArray = spheres.slice(0, split);
        const rightArray = spheres.slice(split);

        const mbsLeft = minimumBoundingSphereOfSpheres(leftArray, wasmModule);
        const mbsRight = minimumBoundingSphereOfSpheres(rightArray, wasmModule);

        const totalVolumeLeft = leftArray.reduce(
            (acc, sphere) => acc + sphereVolume(sphere[3]),
            0
        );
        const totalVolumeRight = rightArray.reduce(
            (acc, sphere) => acc + sphereVolume(sphere[3]),
            0
        );

        const volumeRatioLeft = totalVolumeLeft / sphereVolume(mbsLeft[3]);
        const volumeRatioRight = totalVolumeRight / sphereVolume(mbsRight[3]);

        const d = vec3.distance(vec3.fromValues(mbsLeft[0], mbsLeft[1], mbsLeft[2]), vec3.fromValues(mbsRight[0], mbsRight[1], mbsRight[2]));
        const r1 = mbsLeft[3];
        const r2 = mbsRight[3];

        let splitScore = 0.0;
        if (d > r1 + r2) {
            splitScore = 1;
        } else if (d + Math.min(r1, r2) < Math.max(r1, r2)) {
            splitScore = -1.0;
        } else {
            splitScore = 0.3 * (sphereH(d, r1, r2) / Math.min(r1, r2));
        }

        if (volumeRatioLeft + volumeRatioRight + splitScore > minimumSplitRatio) {
            minimumSplit = split;
            minimumSplitRatio = volumeRatioLeft + volumeRatioRight + splitScore;

            tree.volumeLeftScore = volumeRatioLeft;
            tree.volumeRightScore = volumeRatioRight;
            tree.splitScore = splitScore;
        }
    }
    // console.timeEnd("findMinimumSplit");

    const leftArray = spheres.slice(0, minimumSplit);
    const rightArray = spheres.slice(minimumSplit);

    tree.left = buildTree(leftArray, wasmModule);
    tree.right = buildTree(rightArray, wasmModule);

    return tree;
}