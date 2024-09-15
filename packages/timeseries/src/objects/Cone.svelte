<script lang="ts">
    import { getContext, onMount } from "svelte";
    import * as Graphics from "lib-graphics";
    import type { Writable } from "svelte/store";
    import { vec3 } from "gl-matrix";
  
    let device: Writable<GPUDevice> = getContext("device");
    let viewport: Writable<Graphics.Viewport3D | null> = getContext("viewport");
  
    export let radius = 0.3;
    export let start: vec3 = vec3.fromValues(0.0, 0.0, 0.0);
    export let end: vec3 = vec3.fromValues(0.0, 0.0, 0.0);
    export let color: [number, number, number, number] = [1.0, 1.0, 1.0, 1.0];
  
    let cone: Graphics.RoundedCone | null = null;
    let coneID: number | null = null;


    $: if ($viewport) {
      if (coneID != null) {
        $viewport.scene.removeObjectByID(coneID);
      }
  
      [cone, coneID] = $viewport.scene.addObject(Graphics.RoundedCone);
      cone.setDirtyCPU();
    }
  
    $: if (cone) {
      cone.properties.start = [start[0], start[1], start[2]];
      cone.properties.end = [end[0], end[1], end[2]];
      cone.properties.color = color;
      cone.properties.startRadius = radius;
      cone.properties.endRadius = 0.0001;
      cone.properties.color = [color[0], color[1], color[2], 1.0];
      cone.setDirtyCPU();
    }
  
    onMount(() => {
      return () => {
        if (viewport && $viewport?.scene) {
          $viewport.scene.removeObjectByID(coneID);
        }
      };
    });
  </script>
  