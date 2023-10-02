<svelte:options immutable />

<script lang="ts">
    import { getContext, onMount } from "svelte";
    import type { Writable } from "svelte/store";
    import type { Viewport3D } from "lib-graphics";
    import { Volume } from "lib-graphics";
    import type { vec3 } from "gl-matrix";

    export let visible = true;
    export let radius = 0.05;
    export let points: vec3[][] | null = null;
    export let transparency: number = 1.0;
    export let colormap: ImageBitmap | null = null;
    export let func: number = 0;

    let device: Writable<GPUDevice> = getContext("device");
    let viewport: Writable<Viewport3D | null> = getContext("viewport");

    let object: Volume | null = null;
    let objectID: number | null = null;

    $: if ($viewport) {
        if (objectID) {
            $viewport.scene.removeObjectByID(objectID);
        }

        [object, objectID] = $viewport.scene.addVolume(Volume);
        object.setDirtyCPU();
    }

    $: if (object && colormap) {
        object.setColorMapFromBitmap(colormap);
        object.setDirtyCPU();
    }

    $: if (object && points) {
        object.fromPoints($device, points, radius);
        object.setDirtyCPU();
    }

    $: if (object) {
        object.visible = visible;
        object.setDirtyCPU();
    }

    $: if (object && transparency) {
        object.properties.transparency = transparency;
        object.setDirtyCPU();
    }

    $: if (object) {
        object.properties.func = func;
        object.setDirtyCPU();
    }

    onMount(() => {
        return () => {
            if ($viewport?.scene && objectID) {
                $viewport.scene.removeObjectByID(objectID);
            }
        };
    });
</script>
