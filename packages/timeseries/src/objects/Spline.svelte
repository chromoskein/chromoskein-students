<script lang="ts">
  import { getContext, onMount } from "svelte";
  import * as Graphics from "lib-graphics";
  import type { Writable } from "svelte/store";
  import type { Viewport3D } from "lib-graphics";
  import { vec3 } from "gl-matrix";

  let viewport: Writable<Viewport3D | null> = getContext("viewport");

  export let points: vec3[] = [];
  export let radius = 0.3;
  export let color: vec3 = vec3.fromValues(1.0, 1.0, 1.0);
  export let multicolored: boolean = false;

  let object: Graphics.Spline;
  let objectID: number | null = null;

  $: if ($viewport && points) {
    if (objectID != null) {
      $viewport.scene.removeObjectByID(objectID);
    }

    [object, objectID] = $viewport.scene.addObjectInstanced(Graphics.Spline, points.length);
    for (let i = 0; i < points.length / 3; i++) {
      object.properties[i].p0 = [points[i * 3 + 0][0], points[i * 3 + 0][1], points[i * 3 + 0][2], radius];
      object.properties[i].p1 = [points[i * 3 + 1][0], points[i * 3 + 1][1], points[i * 3 + 1][2], radius];
      object.properties[i].p2 = [points[i * 3 + 2][0], points[i * 3 + 2][1], points[i * 3 + 2][2], radius];

      if (multicolored) {
        color[2] = 0.0;
        color[1] = 0.0 + i * 1.0/points.length;
      } else {
        color[2] = 1.0;
        color[1] = 1.0;
      }

      object.properties[i].color = [color[0], color[1], color[2], 1.0];
    }
    object.setDirtyCPU();
  }

  onMount(() => {
    return () => {
      if (viewport && $viewport?.scene && objectID != null) {
        $viewport.scene.removeObjectByID(objectID);
      }
    };
  });
</script>
