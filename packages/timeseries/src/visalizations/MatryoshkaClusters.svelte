<script lang="ts">

    import type { vec3 } from "gl-matrix";
    import { staticColors } from "../utils/treecolors";
    import type { ClusterBlob, ClusterNode } from "../utils/main";
    import SignedDistanceGridBlended from "../objects/SignedDistanceGridBlended.svelte";
    import { blobFromPoints } from "../utils/main";

    export let selectedTimestep: number;
    export let dataClustersGivenK: ClusterNode[][] | null = null;
    export let dataTimesteps: vec3[][] = null;
    export let dataPathlines: vec3[][] = null;
    export let blobAlpha: number;
    export let blobsRadius: number;
    export let experimentalColors: boolean;
    export let matryoshkaBlobsVisible: boolean[] = [false, true, false, true, false, false, false, false, false, false, false, false, false, false];

    let matryoshkaColors: vec3[] = [];
    let matryoshkaExperiemntalColors: vec3[] = [];
    let matryoshkaRadius: number[] = [];
    let matryoshkaBlobDepth: number[] = [];
    let matryoshkaBlobs: ClusterBlob[][] = [];

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

        let depth = matryoshkaBlobsVisible.filter(x => x).length;
        let radiusOffset = depth * 0.015;
        let found = [];
        let clusterPoints = [];
        for (let i = 1; i < 15; i++) {
            if (!matryoshkaBlobsVisible[i - 1]) {
                continue;
            }

            let clusters = dataClustersGivenK[i];

            for (const [_, cluster] of clusters.entries()) {
                if (found.filter(x => x[0] == cluster.from && x[1] == cluster.to).length == 0) {
                    clusterPoints.push(dataPathlines.slice(cluster.from, cluster.to + 1));
                    matryoshkaColors.push(cluster.color.rgb);
                    matryoshkaExperiemntalColors.push(staticColors[cluster.i % staticColors.length]);
                    found.push([cluster.from, cluster.to]);
                    matryoshkaRadius.push(radiusOffset);
                    matryoshkaBlobDepth.push(depth);
                }
            }
            depth--;
            radiusOffset -= 0.025;
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
        points={matryoshkaBlobPoints}
        scales={matryoshkaBlobScales}
        translates={matryoshkaBlobCenters}
        colors={(!experimentalColors) ? matryoshkaColors : matryoshkaExperiemntalColors}
        radius={blobsRadius}
        radiusOffsets={matryoshkaRadius}
        alpha={blobAlpha}
        depths={matryoshkaBlobDepth}
    />
</div>
