<svelte:options immutable />

<script lang="ts">
    import { getContext, onMount } from "svelte";
    import type { Writable } from "svelte/store";
    import type { Viewport3D } from "@chromoskein/lib-graphics";
    import { DynamicVolumeUnit } from "@chromoskein/lib-graphics";
    import { vec4, vec3 } from "gl-matrix";
    import { blobFromPoints } from "../utils/main";

    export let radius: number = 0.05;
    export let points: vec3[][] | null = null;
    export let color: vec3;
    export let transparency: number = 1.0;
    export let colormap: ImageBitmap | null = null;
    export let func: number = 0;
    export let abstract: boolean = false;
    export let usecolormap: boolean = false;

    let device: Writable<GPUDevice> = getContext("device");
    let viewport: Writable<Viewport3D | null> = getContext("viewport");

    let object: DynamicVolumeUnit | null = null;
    let objectID: number | null = null;

    $: if ($viewport && $viewport.scene) {
        if (objectID) {
            $viewport.scene.removeObjectByID(objectID);
        }

        [object, objectID] = $viewport.scene.addDynamicVolume(DynamicVolumeUnit);
    }

    $: if (object && colormap) {
        object.setColorMapFromBitmap(colormap);
    }

    $: if (object && points) {
        if (!abstract) {
            const volumeScale = 0.8;
            object.scale = 1.0 / volumeScale;
            object.fromPoints($device, points.map(sequence => sequence.map(point => vec3.fromValues(point[0] * volumeScale, point[1] * volumeScale, point[2] * volumeScale))), radius);
        } else {
            object.scale = 1.0;
            let abstractRadius = points[0].length / 1000.0 * 2 + radius / 2.0;
            object.fromPoints($device, points.map(p => [blobFromPoints(p).center]), abstractRadius);
        }
    }

    $: if (object) {
        object.setColor(vec4.fromValues(color[0], color[1], color[2], usecolormap ? 0.0 : 1.0));
    }

    $: if (object && transparency) {
        object.transparency = transparency;
    }

    $: if (object) {
        object.func = func;
    }

    onMount(() => {
        return () => {
            if ($viewport?.scene && objectID) {
                $viewport.scene.removeDynamicVolumeByID(objectID);
            }
        };
    });
</script>
