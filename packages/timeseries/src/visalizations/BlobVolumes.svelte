
<script lang="ts">

    import type { vec3, vec4 } from "gl-matrix";
    import type { ClusterBlob, ClusterNode } from "../utils/main";
    import TimeVolume from "../objects/TimeVolume.svelte";

    export let blobs: ClusterBlob[][] = [];
    export let volumeRadius: number;
    export let selectedTimestep: number;
    export let transparency: number;
    export let func: number;
    export let colormap: ImageBitmap;
    export let blobColors: vec4[] = [];

    let blobVolumes: vec3[][][] = [];
    let blobRadii: number[] = [];

    $: if (blobs && blobs[0]) {
        blobVolumes = [];
        for (let i = 0; i < blobs[0].length; i++) {
            blobVolumes.push(blobs.map(p => [p[i].center]));
        }
    }

    $: if (blobs && blobs[0]) {
        blobRadii = [];
        for (let i = 0; i < blobs[0].length; i++) {
            blobRadii.push(blobs[selectedTimestep][i].normalizedPoints.length / 1000.0 * 2 + volumeRadius / 2.0);
        }
    }

</script>

<div>
    <TimeVolume
        visible={true}
        points={blobVolumes}
        transparency={transparency}
        radii={blobRadii}
        colormap={colormap}
        func={func}
        colors={blobColors}
    />
</div>
