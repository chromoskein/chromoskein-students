<svelte:options immutable />

<script lang="ts">
    import { getContext, onMount } from "svelte";
    import type { Writable } from "svelte/store";
    import type { Viewport3D } from "lib-graphics";
    import { Volume } from "lib-graphics";
    import type { vec3, vec4 } from "gl-matrix";
    import { DynamicVolumeUnit } from "lib-graphics";
    import type { ClusterBlob } from "../utils/main";

    export let visible = true;
    export let radius: number = 0.1;
    export let blobs: ClusterBlob[][] = [];
    export let color: vec4;
    export let transparency: number = 1.0;
    export let colormap: ImageBitmap | null = null;
    export let func: number = 0;

    let device: Writable<GPUDevice> = getContext("device");
    let viewport: Writable<Viewport3D | null> = getContext("viewport");

    let object: DynamicVolumeUnit | null = null;
    let objectID: number | null = null;
    let blobVolumes = [];

    $: if (blobs && blobs[0]) {
        blobVolumes = [];
        for (let i = 0; i < blobs[0].length; i++) {
            blobVolumes.push(blobs.map(p => [p[i].center]));
        }
    }

    $: if ($viewport) {
        if (objectID) {
            $viewport.scene.removeObjectByID(objectID);
        }

        [object, objectID] = $viewport.scene.addDynamicVolume(DynamicVolumeUnit);
        //object.setDirtyCPU();
    }

    $: if (object && colormap) {
        object.setColorMapFromBitmap(colormap);
        //object.setDirtyCPU();
    }

    $: if (object && blobVolumes[0]) {
        object.fromPoints($device, blobVolumes[0], radius);
        //object.setDirtyCPU();
    }

    $: if (object && color) {
        object.setColor(color);
        //object.setDirtyCPU();
    }

    $: if (object) {
        object.visible = visible;
        //object.setDirtyCPU();
    }

    $: if (object && transparency) {
        object.transparency = transparency;
        //object.setDirtyCPU();
    }

    $: if (object) {
        object.func = func;
        //object.setDirtyCPU();
    }

    onMount(() => {
        return () => {
            if ($viewport?.scene && objectID) {
                $viewport.scene.removeDynamicVolumeByID(objectID);
            }
        };
    });
</script>
