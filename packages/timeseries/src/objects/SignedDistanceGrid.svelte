

<script lang="ts">
    import { getContext, onMount } from "svelte";
    import type { Writable } from "svelte/store";
    import type { Viewport3D } from "@chromoskein/lib-graphics";
    import { SignedDistanceGrid } from "@chromoskein/lib-graphics";
    import { vec3, vec4 } from "gl-matrix";

    export let visible = true;
    export let radius = 0.05;
    export let points: vec3[] = [];
    export let color: vec3 = vec3.fromValues(1.0, 1.0, 1.0);
    export let translate: vec3 = vec3.fromValues(0.0, 0.0, 0.0);
    export let scale: number = 1.0;
    export let outline: boolean = false;

    let device: Writable<GPUDevice> = getContext("device");
    let viewport: Writable<Viewport3D | null> = getContext("viewport");

    let object: SignedDistanceGrid | null = null;
    let objectID: number | null = null;


    $: if (viewport) [object, objectID] = $viewport.scene.addObjectInstanced(SignedDistanceGrid, 1);
    $: if (object) object.translate([translate[0], translate[1], translate[2]], 0);
    $: if (object) object.scale(scale, 0);
    $: if (object) { object.properties[0].color = vec4.fromValues(color[0], color[1], color[2], 1.0); object.setDirtyCPU(); };
    $: if (object) object.fromPoints($device, [points], [radius]);
    $: if (object) object.visible = visible;
    $: if (object) object.outline(outline, 0);

    onMount(() => {
        return () => {
            if ($viewport?.scene && objectID) {
                $viewport.scene.removeObjectByID(objectID);
            }
        };
    });
</script>
