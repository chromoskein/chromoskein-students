<svelte:options immutable />

<script lang="ts">
    import { getContext } from "svelte";
    import type { Writable } from "svelte/store";
    import type { DistanceViewport } from "lib-graphics";
    import type { vec3 } from "gl-matrix";

    let viewport: Writable<DistanceViewport | null> = getContext("viewport");       
    export let points: vec3[] | null = null;

    /*
    $: if ($viewport) {
        if (objectID) {
            $viewport.scene.removeObjectByID(objectID);
        }

        [object, objectID] = $viewport.scene.addVolume(Volume);
        object.setDirtyCPU();
    }
    */

    $: if (points && $viewport) {
        $viewport.setPositions(points);
    }

</script>
