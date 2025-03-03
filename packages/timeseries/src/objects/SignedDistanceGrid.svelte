<script lang="ts">
    import { getContext, onMount, untrack } from "svelte";
    import type { Writable } from "svelte/store";
    import type { Viewport3D } from "@chromoskein/lib-graphics";
    import { SignedDistanceGrid } from "@chromoskein/lib-graphics";
    import { vec3, vec4 } from "gl-matrix";

    export interface SignedDistanceGridProps {
        radius: number,
        points: vec3[],
        color: vec3,
        translate: vec3,
        scale: number,
        outline: boolean  
    }

    let {
        radius = 0.05,
        points = [],
        color = vec3.fromValues(1.0, 1.0, 1.0),
        translate = vec3.fromValues(0, 0, 0),
        scale = 1.0,
        outline = false
    } : SignedDistanceGridProps = $props();

    let device: Writable<GPUDevice> = getContext("device");
    let viewport: Writable<Viewport3D | null> = getContext("viewport");

    let [object, objectID] = $derived.by(() => {
        if ($viewport && $viewport.scene) {
            return $viewport.scene.addObjectInstanced(SignedDistanceGrid, 1);
        }
        return [null, null]
    });
    $effect(() => untrack(() => object)?.translate([translate[0], translate[1], translate[2]], 0));
    $effect(() => untrack(() => object)?.scale(scale, 0));
    $effect(() => {if (object) { object.properties[0].color = vec4.fromValues(color[0], color[1], color[2], 1.0); object.setDirtyCPU(); }});
    $effect(() => untrack(() => object)?.fromPoints($device, [points], [radius]));
    $effect(() => untrack(() => object)?.outline(outline, 0.01, 0));

    onMount(() => {
        return () => {
            if ($viewport?.scene && objectID) $viewport.scene.removeObjectByID(objectID);
        };
    });
</script>
