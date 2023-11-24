<script lang="ts">
    import { getContext, onMount } from "svelte";
    import * as Graphics from "lib-graphics";
    import type { Writable } from "svelte/store";
    import type { Viewport3D } from "lib-graphics";
    import { vec3 } from "gl-matrix";
  
    let viewport: Writable<Viewport3D | null> = getContext("viewport");
  
    export let startRadius = 0.0;
    export let center: vec3 = vec3.fromValues(0.0, 0.0, 0.0);
    export let height = 0.0;
    export let orientation: vec3 = vec3.fromValues(0.1, 0.2, 0.1);
    export let color: vec3 = vec3.fromValues(1.0, 1.0, 1.0);
    export let up: boolean = true;

    let object: Graphics.RoundedCone | null = null;
    let objectID: number | null = null;
  
    $: if ($viewport) {
      if (objectID != null) {
        $viewport.scene.removeObjectByID(objectID);
      }
  
      [object, objectID] = $viewport.scene.addObject(Graphics.RoundedCone);
      object.setDirtyCPU();
    }
  
    $: if (object) {
      object.properties.start = [center[0], center[1], center[2]]
      if (up) {
        object.properties.end = [
            center[0] + height * orientation[0],
            center[1] + height * orientation[1],
            center[2] + height * orientation[2],
            ];
      } else {
        object.properties.end = [
            center[0] - height * orientation[0],
            center[1] - height * orientation[1],
            center[2] - height * orientation[2],
            ];
      }
      
      object.properties.startRadius = startRadius;
      object.properties.endRadius = 0.0001;

      object.properties.color = [color[0], color[1], color[2], 1.0];
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
  