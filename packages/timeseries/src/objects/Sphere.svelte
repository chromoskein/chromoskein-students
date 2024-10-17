<script lang="ts">
  import { getContext, onMount } from "svelte";
  import * as Graphics from "lib-graphics";
  import type { Writable } from "svelte/store";
  import type { Viewport3D } from "lib-graphics";
  import { vec3 } from "gl-matrix";

  let viewport: Writable<Graphics.Viewport3D | null> = getContext("viewport");

  export let radius = 0.3;
  export let center: vec3 = vec3.fromValues(0.0, 0.0, 0.0);
  export let color: [number, number, number, number] = [1.0, 1.0, 1.0, 1.0];

  let object: Graphics.Sphere | null = null;
  let objectID: number | null = null;

  $: if ($viewport) {
    if (objectID != null) {
      $viewport.scene.removeObjectByID(objectID);
    }

    [object, objectID] = $viewport.scene.addObject(Graphics.Sphere);
    object.setDirtyCPU();
  }

  $: if (object) {
    object.properties.radius = radius;
    object.properties.center = [center[0], center[1], center[2]];
    object.properties.color = color;
    object.setDirtyCPU();
  }

  onMount(() => {
    return () => {
      if (viewport && $viewport?.scene) {
        $viewport.scene.removeObjectByID(objectID);
      }
    };
  });
</script>
