<script lang="ts">
    import { getContext, onMount } from "svelte";
    import type { Writable } from "svelte/store";
    import type { Viewport3D } from "@chromoskein/lib-graphics";
    import { DynamicVolumeUnit } from "@chromoskein/lib-graphics";
    import { vec4, vec3 } from "gl-matrix";
    import { blobFromPoints } from "../utils/main";

    interface TimeVolumeProps {
        radius: number,
        points: vec3[][],
        color: vec3,
        transparency: number, 
        colormap: ImageBitmap | null, 
        func: number,
        abstract: boolean, 
        usecolormap: boolean,
    }

    let {
        radius = 0.05,
        points = [],
        color = vec3.fromValues(1.0, 1.0, 1.0),
        transparency = 1.0,
        colormap = null,
        func= 0,
        abstract = false,
        usecolormap = false,
    }: TimeVolumeProps = $props();

    let device: Writable<GPUDevice> = getContext("device");
    let viewport: Writable<Viewport3D | null> = getContext("viewport");

    let [object, objectID]: [DynamicVolumeUnit | null, number | null] = $derived.by(() => {
        if ($viewport && $viewport.scene) {
            return $viewport.scene.addDynamicVolume(DynamicVolumeUnit);
        }
        return [null, null];
    })
    
    $effect(() => { if (object && points) {
        if (!abstract) {
            const volumeScale = 0.8;
            object.scale = 1.0 / volumeScale;
            object.fromPoints($device, points.map(sequence => sequence.map(point => vec3.fromValues(point[0] * volumeScale, point[1] * volumeScale, point[2] * volumeScale))), radius);
        } else {
            object.scale = 1.0;
            let abstractRadius = points[0].length / 1000.0 * 2 + radius / 2.0;
            object.fromPoints($device, points.map(p => [blobFromPoints(p).center]), abstractRadius);
        }
    }});
    
    $effect(() => object?.setColor(vec4.fromValues(color[0], color[1], color[2], usecolormap ? 0.0 : 1.0)));
    $effect(() => { if (object) { object.transparency = transparency; }});
    $effect(() => { if (object) { object.func = func; }});
    $effect(() => { if (object && colormap) { object.setColorMapFromBitmap(colormap); }});
    
    onMount(() => {
        return () => {
            if ($viewport?.scene && objectID) {
                $viewport.scene.removeDynamicVolumeByID(objectID);
            }
        };
    });
</script>
