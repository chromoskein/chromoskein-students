<script lang="ts">
  import { getContext, onMount } from "svelte";
  import * as Graphics from "@chromoskein/lib-graphics";
  import type { Writable } from "svelte/store";
  import { vec3 } from "gl-matrix";

  interface SphereProps {
    radius: number,
    center: vec3,
    color: [number, number, number, number]
  }
   
  let {
    radius = 0.3,
    center = vec3.fromValues(0, 0, 0),
    color = [1.0, 1.0, 1.0, 1.0]
  }: SphereProps = $props();
  
  let viewport: Writable<Graphics.Viewport3D | null> = getContext("viewport");
  let [object, objectID]: [Graphics.Sphere | null, number | null] = $derived.by(() => {
    if ($viewport && $viewport.scene) {
      return $viewport.scene.addObject(Graphics.Sphere);
    }
    return [null, null];
  });

  $effect(() => {if (object) {
    object.properties.radius = radius;
    object.properties.center = [center[0], center[1], center[2]];
    object.properties.color = color;
    object.setDirtyCPU();
  }});

  onMount(() => {
    return () => {
      if (viewport && $viewport?.scene && objectID) {
        $viewport.scene.removeObjectByID(objectID);
      }
    };
  });
</script>
