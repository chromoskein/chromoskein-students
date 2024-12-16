<script lang="ts">
  import { getContext, onMount } from "svelte";
  import * as Graphics from "@chromoskein/lib-graphics";
  import type { Writable } from "svelte/store";
  import type { Viewport3D } from "@chromoskein/lib-graphics";
  import { vec3 } from "gl-matrix";
  import { lineToSpline } from "../utils/lineToSpline";

  let viewport: Writable<Viewport3D | null> = getContext("viewport");

  export let points: vec3[] = [];
  export let radius = 0.3;
  export let color: vec3 = vec3.fromValues(1.0, 1.0, 1.0);
  export let multicolored: boolean = false;

  let spline: Graphics.Spline;
  let splineID: number | null = null;
  let length: number = 0;
  let splinePoints: vec3[] = []

  $: if ($viewport && $viewport.scene && points) {
    if (splineID != null) {
      $viewport.scene.removeObjectByID(splineID);
    }

    splinePoints = lineToSpline(points);
    length = splinePoints.length;
    [spline, splineID] = $viewport.scene.addObjectInstanced(
        Graphics.Spline,
        splinePoints.length
    );
    
    for (let i = 0; i < splinePoints.length / 3; i++) {
        spline.properties[i].p0 = [splinePoints[i * 3 + 0][0], splinePoints[i * 3 + 0][1], splinePoints[i * 3 + 0][2], radius];
        spline.properties[i].p1 = [splinePoints[i * 3 + 1][0], splinePoints[i * 3 + 1][1], splinePoints[i * 3 + 1][2], radius];
        spline.properties[i].p2 = [splinePoints[i * 3 + 2][0], splinePoints[i * 3 + 2][1], splinePoints[i * 3 + 2][2], radius];
    }
    spline.setDirtyCPU();
  }

  $: if (spline) {
    for (let i = 0; i < length / 3; i++) {
      spline.properties[i].color = [color[0], color[1], color[2], 1.0];
    }
    spline.setDirtyCPU();
  }

  onMount(() => {
    return () => {
      if (viewport && $viewport?.scene && splineID != null) {
        $viewport.scene.removeObjectByID(splineID);
      }
    };
  });
</script>
