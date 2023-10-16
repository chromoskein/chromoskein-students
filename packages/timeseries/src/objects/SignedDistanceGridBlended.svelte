
<script lang="ts">
    import { getContext, onMount } from "svelte";
    import type { Writable } from "svelte/store";
    import type { Viewport3D } from "lib-graphics";
    import { SignedDistanceGrid } from "lib-graphics";
    import { vec3, vec4 } from "gl-matrix";

    export let visible = true;
    export let radius = 0.05;
    export let colors: vec3[] = [];

    export let blobs: {
        normalizedPoints: vec3[];
        center: vec3;
        scale: number;
    }[];

    let device: Writable<GPUDevice> = getContext("device");
    let viewport: Writable<Viewport3D | null> = getContext("viewport");

    let object: SignedDistanceGrid | null = null;
    let objectID: number | null = null;

    $: if (viewport) [object, objectID] = $viewport.scene.addObjectInstanced(SignedDistanceGrid, blobs.length);
    $: if (object) {
        for (let i = 0; i < blobs.length; i++) {
            object.translate([blobs[i].center[0], blobs[i].center[1], blobs[i].center[2]], i);
        }
    }
    $: if (object) {
        for (let i = 0; i < blobs.length; i++) {
            object.scale(blobs[i].scale, i);
        }
    };
    $: if (object) {
        for (let i = 0; i < blobs.length; i++) {
            object.properties[i].color = vec4.fromValues(colors[i][0], colors[i][1], colors[i][2], 0.5);
        }
        object.setDirtyCPU();
    };
    $: if (object) {
        let pointsArray = [];
        for (let i = 0; i < blobs.length; i++) {
            pointsArray.push(blobs[i].normalizedPoints);
        }
        object.fromPoints($device, pointsArray, radius);
    }
    $: if (object) object.visible = visible;

    onMount(() => {
        return () => {
            if ($viewport?.scene && objectID) {
                $viewport.scene.removeObjectByID(objectID);
            }
        };
    });
</script>
