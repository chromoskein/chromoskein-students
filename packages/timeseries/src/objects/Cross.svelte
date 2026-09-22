<script lang="ts">
  import { getContext, onMount } from "svelte";
  import * as Graphics from "@chromoskein/lib-graphics";
  import type { Writable } from "svelte/store";
  import type { Viewport3D } from "@chromoskein/lib-graphics";
  import { vec3 } from "gl-matrix";

  let viewport: Writable<Viewport3D | null> = getContext("viewport");
  const offset = 0.03

  interface CrossProps {
    radius: number,
    length: number,
    points: vec3[],
    color: vec3,
  }

  let {  
      radius = 0.3,
      length = 0.1,
      points = [],
      color = vec3.fromValues(1.0, 1.0, 1.0),
  }: CrossProps = $props();

  let [object, objectID]: [Graphics.RoundedConeInstanced | null, number | null] = [null, null];
  $effect(() => {
    if ($viewport && $viewport.scene) {
        if (objectID != null) {
            $viewport.scene.removeObjectByID(objectID);
        }
        [object, objectID] = $viewport.scene.addObjectInstanced(Graphics.RoundedConeInstanced, points.length * 3);
    }
  })

  $effect(() => { if (object && points) {
    let crossRadius = radius / 4.0
    let length = crossRadius * 5;
    let offset = length * 0.15;
    for (let j = 0; j < points.length - 1; j++) {
      let i = j * 3

      object.properties[i].start = [points[j][0] - length, points[j][1] - offset, points[j][2] - offset];
      object.properties[i].end = [points[j][0] + length, points[j][1] + offset, points[j][2] + offset];
      object.properties[i+1].start = [points[j][0] + offset, points[j][1] - length, points[j][2] + offset];
      object.properties[i+1].end = [points[j][0] - offset, points[j][1] + length, points[j][2] - offset];
      object.properties[i+2].start = [points[j][0] + offset, points[j][1] - offset, points[j][2] - length];
      object.properties[i+2].end = [points[j][0] - offset, points[j][1] + offset, points[j][2] + length];

      for (let k = 0; k < 3; k++) {
        object.properties[i + k].startRadius = crossRadius;
        object.properties[i + k].endRadius = crossRadius;

        object.properties[i + k].startColor = [color[0], color[1], color[2], 1.0];
        object.properties[i + k].endColor = [color[0], color[1], color[2], 1.0];
      }
    }
    object.setDirtyCPU();
  }});

  onMount(() => {
    console.log("Creating crosses object")
    return () => {
      if (viewport && $viewport?.scene && objectID) {
        $viewport.scene.removeObjectByID(objectID);
      }
    };
  });
</script>
