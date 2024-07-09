<script lang="ts">

    import type { vec3 } from "gl-matrix";
    import { staticColors } from "../utils/treecolors";
    import type { ClusterBlob, ClusterNode } from "../utils/main";
    import SignedDistanceGridBlended from "../objects/SignedDistanceGridBlended.svelte";
    import SignedDistanceGrid from "../objects/SignedDistanceGrid.svelte";
    import { blobFromPoints } from "../utils/main";

    export let selectedTimestep: number;
    export let dataClustersGivenK: ClusterNode[][] | null = null;
    export let dataTimesteps: vec3[][] = null;
    export let dataPathlines: vec3[][] = null;
    export let blobAlpha: number;
    export let blobsRadius: number;
    export let experimentalColors: boolean;
    export let matryoshkaBlobsVisible: boolean[] = [false, true, false, true, false, false, false, false, false, false, false, false, false, false, false];

    let matryoshkaColors: vec3[] = [];
    let matryoshkaExperiemntalColors: vec3[] = [];
    let matryoshkaRadius: number[] = [];
    let matryoshkaBlobDepth: number[] = [];
    let matryoshkaBlobs: ClusterBlob[][] = [];
    let matryoshkaOutline: boolean[] = []


    let blendedBlobIndices: number[] = [];
    let outlineBlobIndices: number[] = [];
    let matryoshkaBlobPoints: vec3[][] = [];
    let matryoshkaBlobCenters: vec3[] = [];
    let matryoshkaBlobScales: number[] = [];

    $: if (matryoshkaBlobs[selectedTimestep]) {
        matryoshkaBlobPoints.length = 0;
        matryoshkaBlobCenters.length = 0;
        matryoshkaBlobScales.length = 0;
        for (let i = 0; i < matryoshkaBlobs[selectedTimestep].length; i++) {
            matryoshkaBlobPoints.push(matryoshkaBlobs[selectedTimestep][i].normalizedPoints);
            matryoshkaBlobCenters.push(matryoshkaBlobs[selectedTimestep][i].center);
            matryoshkaBlobScales.push(matryoshkaBlobs[selectedTimestep][i].scale);
        }
    }

    $: if (dataClustersGivenK && dataPathlines) {
        matryoshkaBlobs = [];
        matryoshkaColors = [];
        matryoshkaExperiemntalColors = [];
        matryoshkaRadius = [];
        matryoshkaOutline = [];

        let lowest = true;
        let depth = 0.0;
        let radiusOffset = 0.0;
        let clusterPoints = [];
        for (let i = matryoshkaBlobsVisible.length; i > 0; i--) {
            if (!matryoshkaBlobsVisible[i - 1]) {
                continue;
            }

            let clusters = dataClustersGivenK[i];

            for (const [_, cluster] of clusters.entries()) {
                    clusterPoints.push(dataPathlines.slice(cluster.from, cluster.to + 1));
                    matryoshkaColors.push(cluster.color.rgb);
                    matryoshkaExperiemntalColors.push(staticColors[cluster.i % staticColors.length]);
                    matryoshkaRadius.push(radiusOffset);
                    matryoshkaBlobDepth.push(depth);
                    matryoshkaOutline.push(lowest)
            }
            lowest = false;
            depth++;
            radiusOffset += 0.03;
        }

        for (let timestep = 0; timestep < dataTimesteps.length; timestep++) {
            let blobsPointsAtTimestep: ClusterBlob[] = [];
            for (const [index, clusteredPathline] of clusterPoints.entries()) {
                const points = clusteredPathline.map((pathline) => pathline[timestep]);
                blobsPointsAtTimestep.push(blobFromPoints(points));
            }
            matryoshkaBlobs.push(blobsPointsAtTimestep);
        }
    }
</script>

<div>
    <SignedDistanceGridBlended
        points={matryoshkaBlobs[selectedTimestep].filter((_, index) => matryoshkaOutline[index]).map(blob => blob.normalizedPoints)}
        scales={matryoshkaBlobs[selectedTimestep].filter((_, index) => matryoshkaOutline[index]).map(blob => blob.scale)}
        translates={matryoshkaBlobs[selectedTimestep].filter((_, index) => matryoshkaOutline[index]).map(blob => blob.center)}
        colors={(!experimentalColors) ? matryoshkaColors.filter((_, index) => matryoshkaOutline[index])  : matryoshkaExperiemntalColors.filter((_, index) => matryoshkaOutline[index])}
        radius={blobsRadius}
        radiusOffsets={matryoshkaRadius.filter((_, index) => matryoshkaOutline[index])}
        alpha={blobAlpha}
        depths={matryoshkaBlobDepth.filter((_, index) => matryoshkaOutline[index])}
    />

    {#each matryoshkaBlobs[selectedTimestep] as blob, i}
        {#if !matryoshkaOutline[i]}
              <SignedDistanceGrid
                points={blob.normalizedPoints}
                translate={blob.center}
                scale={blob.scale}
                radius={blobsRadius + matryoshkaRadius[i]}
                visible={true}
                color={(!experimentalColors) ? matryoshkaColors[i] : matryoshkaExperiemntalColors[i]}
                outline={true}
              />
        {/if}
    {/each}

</div>
