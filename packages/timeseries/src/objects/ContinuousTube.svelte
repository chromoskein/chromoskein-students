<script lang="ts">
  import { getContext, onMount } from "svelte";
  import * as Graphics from "@chromoskein/lib-graphics";
  import type { Writable } from "svelte/store";
  import type { Viewport3D } from "@chromoskein/lib-graphics";
  import { vec3 } from "gl-matrix";

  let viewport: Writable<Viewport3D | null> = getContext("viewport");

  interface ContinuousTubeProps {
    radius: number,
    points: vec3[],
    color: vec3,
    multicolored: boolean,
  }

  let {  
      radius = 0.3,
      points = [],
      color = vec3.fromValues(1.0, 1.0, 1.0),
      multicolored = false,
  }: ContinuousTubeProps = $props();

  let [object, objectID]: [Graphics.RoundedConeInstanced | null, number | null] = [null, null];
  $effect(() => {
    if ($viewport && $viewport.scene) {
        if (objectID != null) {
            $viewport.scene.removeObjectByID(objectID);
        }
        [object, objectID] = $viewport.scene.addObjectInstanced(Graphics.RoundedConeInstanced, points.length);
    }
  })

  $effect(() => { if (object && points) {
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
  }});

  onMount(() => {
    return () => {
      if (viewport && $viewport?.scene && objectID) {
        $viewport.scene.removeObjectByID(objectID);
      }
    };
  });
</script>
