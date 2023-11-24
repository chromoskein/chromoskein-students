<script lang="ts">
    import { getContext, onMount } from "svelte";
    import {RoundedConeInstanced, Sphere} from "lib-graphics";
    import type { Writable } from "svelte/store";
    import type { Viewport3D } from "lib-graphics";
    import { vec3 } from "gl-matrix";
  
    let viewport: Writable<Viewport3D | null> = getContext("viewport");
  
    export let tubeRadius = 0.3;
    export let tubePoints: vec3[] = [];
    export let tubeColor: vec3 = vec3.fromValues(1.0, 1.0, 1.0);
    export let tubeMulticolored: boolean = false;
    export let sphereRadius = 0.3
    export let sphereCenter: vec3 = vec3.fromValues(0.0, 0.0, 0.0);
    export let sphereColor: [number, number, number, number] = [1.0, 1.0, 1.0, 1.0];
  
    let tube: RoundedConeInstanced;
    let tubeID: number | null = null;
    let sphere: Sphere;
    let sphereID: number | null = null;
  
    $: if ($viewport) {
      if (tubeID != null) {
        $viewport.scene.removeObjectByID(tubeID);
      }
      if (sphereID != null) {
        $viewport.scene.removeObjectByID(sphereID);
      }
  
      [tube, tubeID] = $viewport.scene.addObjectInstanced(
        RoundedConeInstanced,
        tubePoints.length
      );
      tube.setDirtyCPU();
      [sphere, sphereID] = $viewport.scene.addObject(Sphere);
      sphere.setDirtyCPU();
    }
  
    $: if (tube && tubePoints && sphere) {
      for (let i = 0; i < tubePoints.length - 1; i++) {
        tube.properties[i].start = [tubePoints[i][0], tubePoints[i][1], tubePoints[i][2]];
        tube.properties[i].end = [
          tubePoints[i + 1][0],
          tubePoints[i + 1][1],
          tubePoints[i + 1][2],
        ];
  
        tube.properties[i].startRadius = tubeRadius;
        tube.properties[i].endRadius = tubeRadius;
  
        if (tubeMulticolored) {
          tubeColor[2] = 0.0;
          tubeColor[1] = 0.0 + i * 1.0/tubePoints.length;
        } else {
          tubeColor[2] = 1.0;
          tubeColor[1] = 1.0;
        }
  
        tube.properties[i].color = [tubeColor[0], tubeColor[1], tubeColor[2], 1.0];
      }
      tube.setDirtyCPU();

      sphere.properties.radius = sphereRadius;
      sphere.properties.center = [sphereCenter[0], sphereCenter[1], sphereCenter[2]];
      sphere.properties.color = sphereColor;
      sphere.setDirtyCPU();
    }
  
    onMount(() => {
      return () => {
        if (viewport && $viewport?.scene && tubeID != null && sphereID != null) {
          $viewport.scene.removeObjectByID(tubeID);
          $viewport.scene.removeObjectByID(sphereID);        
        }
      };
    });
  </script>
  