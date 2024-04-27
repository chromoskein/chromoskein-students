<script lang="ts">
    import { getContext, onMount } from "svelte";
    import {RoundedConeInstanced, RoundedCone} from "lib-graphics";
    import type { Writable } from "svelte/store";
    import type { Viewport3D } from "lib-graphics";
    import { vec3 } from "gl-matrix";
  
    let viewport: Writable<Viewport3D | null> = getContext("viewport");
  
    export let tubeRadius = 0.3;
    export let tubePoints: vec3[] = [];
    export let tubeColor: vec3 = vec3.fromValues(1.0, 1.0, 1.0);
    export let coneStartRadius = 0.0;
    export let coneCenter: vec3 = vec3.fromValues(0.0, 0.0, 0.0);
    export let coneHeight: number[] = [];
    export let coneOrientation: vec3[] = [];
    export let coneColor: vec3 = vec3.fromValues(1.0, 1.0, 1.0);
    
    let tube: RoundedConeInstanced;
    let tubeID: number | null = null;
    let cones: RoundedCone[] = [];
    let conesIDs: number[] = [];
    
    function keepIfNull(objectID) {
      if (objectID != null) {
        $viewport.scene.removeObjectByID(objectID);
      }
    }
  
    $: if ($viewport) {
      keepIfNull(tubeID);
      for (let i = 0; i < conesIDs.length; i++) {
        keepIfNull(conesIDs[i]);
      }
  
      [tube, tubeID] = $viewport.scene.addObjectInstanced(
        RoundedConeInstanced,
        tubePoints.length
      );
      tube.setDirtyCPU();

      for (let i = 0; i < coneOrientation.length; i++) {
        [cones[i], conesIDs[i]] = $viewport.scene.addObject(RoundedCone);
        cones[i].setDirtyCPU;
      }
    }
  
    $: if (tube && tubePoints && cones) {
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

      for (let i = 0; i < coneOrientation.length; i++) {        
        cones[i].properties.start = [coneCenter[0], coneCenter[1], coneCenter[2]];
        cones[i].properties.end = [
            coneCenter[0] + coneHeight[i] * coneOrientation[i][0],
            coneCenter[1] + coneHeight[i] * coneOrientation[i][1],
            coneCenter[2] + coneHeight[i] * coneOrientation[i][2],
        ]
        
        cones[i].properties.startRadius = coneStartRadius;
        cones[i].properties.endRadius = 0.0001;
        cones[i].properties.color = [coneColor[0], coneColor[1], coneColor[2], 1.0];
        cones[i].setDirtyCPU();
      }
    }
  
    onMount(() => {
      return () => {
        if (viewport && $viewport?.scene && tubeID != null) {
          $viewport.scene.removeObjectByID(tubeID);
          for (let i = 0; i < conesIDs.length; i++) {
            $viewport.scene.removeObjectByID(conesIDs[i]);
          }
        }
      };
    });
  </script>
  