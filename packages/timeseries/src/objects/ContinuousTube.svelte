<script lang="ts">
  import { getContext, onMount } from "svelte";
  import * as Graphics from "lib-graphics";
  import type { Writable } from "svelte/store";
  import type { Viewport3D } from "lib-graphics";
  import { vec3 } from "gl-matrix";

  let viewport: Writable<Viewport3D | null> = getContext("viewport");

  export let radius = 0.3;
  export let points: vec3[] = [];
  export let color: vec3 = vec3.fromValues(1.0, 1.0, 1.0);
  export let multicolored: boolean = false;

  let object: Graphics.RoundedConeInstanced;
  let objectID: number | null = null;

  $: if ($viewport) {
    if (objectID != null) {
      $viewport.scene.removeObjectByID(objectID);
    }

    [object, objectID] = $viewport.scene.addObjectInstanced(
      Graphics.RoundedConeInstanced,
      points.length
    );
    object.setDirtyCPU();
  }

  $: if (object && points) {
    for (let i = 0; i < points.length - 1; i++) {
      object.properties[i].start = [points[i][0], points[i][1], points[i][2]];
      object.properties[i].end = [
        points[i + 1][0],
        points[i + 1][1],
        points[i + 1][2],
      ];

      object.properties[i].startRadius = radius;
      object.properties[i].endRadius = radius;

      if (multicolored) {
        color[2] = 0.0;
        color[1] = 0.0 + i * 1.0/points.length;
      }
      object.properties[i].startColor = [color[0], color[1], color[2], 1.0];
      object.properties[i].endColor = [color[0], color[1], color[2], 1.0];
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
