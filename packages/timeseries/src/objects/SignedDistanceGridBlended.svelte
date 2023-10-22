
<script lang="ts">
    import { getContext, onMount } from "svelte";
    import type { Writable } from "svelte/store";
    import type { Viewport3D } from "lib-graphics";
    import { SignedDistanceGrid } from "lib-graphics";
    import { vec3, vec4 } from "gl-matrix";

    export let visible = true;
    export let radius: number[] = [];
    export let points: vec3[][] = [];
    export let translates: vec3[] = [];
    export let scales: number[] = [];
    export let colors: vec3[] = [];
    export let alpha = 0.5;

    let device: Writable<GPUDevice> = getContext("device");
    let viewport: Writable<Viewport3D | null> = getContext("viewport");

    let object: SignedDistanceGrid | null = null;
    let objectID: number | null = null;

    $: if (viewport) {
        if (objectID && $viewport?.scene) {
            $viewport.scene.removeObjectByID(objectID);
        }
        [object, objectID] = $viewport.scene.addObjectInstanced(SignedDistanceGrid, points.length);
    }
    $: if (object) {
        for (let i = 0; i < translates.length; i++) {
            object.translate([translates[i][0], translates[i][1], translates[i][2]], i);
        }
    }
    $: if (object) {
        for (let i = 0; i < scales.length; i++) {
            object.scale(scales[i], i);
        }
    };
    $: if (object) {
        for (let i = 0; i < points.length; i++) {
            object.properties[i].color = vec4.fromValues(colors[i][0], colors[i][1], colors[i][2], alpha);
        }
        object.setDirtyCPU();
    };
    $: if (object) {
        let pointsArray = [];
        for (let i = 0; i < points.length; i++) {
            pointsArray.push(points[i]);
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
