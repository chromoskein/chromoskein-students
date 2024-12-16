<script lang="ts">
    import { getContext, onMount } from "svelte";
    import {RoundedConeInstanced, RoundedCone} from "@chromoskein/lib-graphics";
    import type { Writable } from "svelte/store";
    import type { Viewport3D } from "@chromoskein/lib-graphics";
    import { vec3 } from "gl-matrix";
  
    let viewport: Writable<Viewport3D | null> = getContext("viewport");
  
    export let tubeRadius = 0.3;
    export let tubePoints: vec3[] = [];
    export let tubeColor: vec3 = vec3.fromValues(1.0, 1.0, 1.0);
    export let coneStartRadius = 0.0;
    export let coneCenter: vec3 = vec3.fromValues(0.0, 0.0, 0.0);
    export let coneHeight = 0.0;
    export let coneOrientation: vec3 = vec3.fromValues(0.1, 0.2, 0.1);
    export let coneColor: vec3 = vec3.fromValues(1.0, 1.0, 1.0);
    
    let tube: RoundedConeInstanced;
    let tubeID: number | null = null;
    let coneUp: RoundedCone;
    let coneUpID: number | null = null;
    let coneDown: RoundedCone;
    let coneDownID: number | null = null;

    function keepIfNull(objectID: number | null) {
      if ($viewport && $viewport.scene && objectID != null) {
        $viewport.scene?.removeObjectByID(objectID);
      }
    }
  
    $: if ($viewport && $viewport.scene) {
      keepIfNull(tubeID);
      keepIfNull(coneUpID);
      keepIfNull(coneDownID);
  
      [tube, tubeID] = $viewport.scene.addObjectInstanced(
        RoundedConeInstanced,
        tubePoints.length
      );
      tube.setDirtyCPU();

      [coneUp, coneUpID] = $viewport.scene.addObject(RoundedCone);
      coneUp.setDirtyCPU();

      [coneDown, coneDownID] = $viewport.scene.addObject(RoundedCone);
      coneDown.setDirtyCPU();
    }
  
    $: if (tube && tubePoints && coneUp && coneDown) {
      for (let i = 0; i < tubePoints.length - 1; i++) {
        tube.properties[i].start = [tubePoints[i][0], tubePoints[i][1], tubePoints[i][2]];
        tube.properties[i].end = [
          tubePoints[i + 1][0],
          tubePoints[i + 1][1],
          tubePoints[i + 1][2],
        ];
  
        tube.properties[i].startRadius = tubeRadius;
        tube.properties[i].endRadius = tubeRadius;
  
        tubeColor[2] = 1.0;
        tubeColor[1] = 1.0;
  
        tube.properties[i].startColor = [tubeColor[0], tubeColor[1], tubeColor[2], 1.0];
        tube.properties[i].endColor = [tubeColor[0], tubeColor[1], tubeColor[2], 1.0];
      }
      tube.setDirtyCPU();

      coneUp.properties.start = [coneCenter[0], coneCenter[1], coneCenter[2]];
      coneUp.properties.end = [
        coneCenter[0] + coneHeight * coneOrientation[0],
        coneCenter[1] + coneHeight * coneOrientation[1],
        coneCenter[2] + coneHeight * coneOrientation[2],
      ];
      coneUp.properties.startRadius = coneStartRadius;
      coneUp.properties.endRadius = 0.0001;
      coneUp.properties.color = [coneColor[0], coneColor[1], coneColor[2], 1.0];
      coneUp.setDirtyCPU();

      coneDown.properties.start = [coneCenter[0], coneCenter[1], coneCenter[2]];
      coneDown.properties.end = [
        coneCenter[0] - coneHeight * coneOrientation[0],
        coneCenter[1] - coneHeight * coneOrientation[1],
        coneCenter[2] - coneHeight * coneOrientation[2],
      ];
      coneDown.properties.startRadius = coneStartRadius;
      coneDown.properties.endRadius = 0.0001;
      coneDown.properties.color = [coneColor[0], coneColor[1], coneColor[2], 1.0];
      coneDown.setDirtyCPU();
    }
  
    onMount(() => {
      return () => {
        if (viewport && $viewport?.scene && tubeID != null && coneUpID != null && coneDownID != null) {
          $viewport.scene.removeObjectByID(tubeID);
          $viewport.scene.removeObjectByID(coneUpID);
          $viewport.scene.removeObjectByID(coneDownID);
        }
      };
    });
  </script>
  