<script lang="ts">
    import { getContext, onMount } from "svelte";
    import PCA from 'pca-js';

    import { RoundedCone } from "lib-graphics";
    import type { Writable } from "svelte/store";
    import type { Viewport3D } from "lib-graphics";
    import { vec3 } from "gl-matrix";
    import { blobFromPoints } from "../utils/main";

    export let points: vec3[] = [];
    export let color: vec3 = vec3.fromValues(1.0, 1.0, 1.0);
    
    let viewport: Writable<Viewport3D | null> = getContext("viewport");
    let normalizedData;
    let firstPCVec: vec3;
    let firstPCVal: number = 0.0;
    let secondPCVal:number = 0.0;
 
    let coneUp: RoundedCone;
    let coneUpID: number | null = null;
    let coneDown: RoundedCone;
    let coneDownID: number | null = null;

    function keepIfNull(objectID) {
      if (objectID != null) {
        $viewport.scene.removeObjectByID(objectID);
      }
    }
  

    $: if (points) {
        normalizedData = blobFromPoints(points);

        let result = PCA.getEigenVectors(normalizedData.normalizedPoints);
        firstPCVec = result[0].vector;
        firstPCVal =  result[0].eigenvalue / 10.0;
        secondPCVal = result[1].eigenvalue / 10.0;
    } 


    $: if ($viewport) {
      keepIfNull(coneUpID);
      keepIfNull(coneDownID);

      [coneUp, coneUpID] = $viewport.scene.addObject(RoundedCone);
      coneUp.setDirtyCPU();

      [coneDown, coneDownID] = $viewport.scene.addObject(RoundedCone);
      coneDown.setDirtyCPU();
    }
  
    $: if (coneUp && coneDown) {

      coneUp.properties.start = [normalizedData.center[0], normalizedData.center[1], normalizedData.center[2]];
      coneUp.properties.end = [
        normalizedData.center[0] + firstPCVal * firstPCVec[0],
        normalizedData.center[1] + firstPCVal * firstPCVec[1],
        normalizedData.center[2] + firstPCVal * firstPCVec[2],
      ];
      coneUp.properties.startRadius = secondPCVal;
      coneUp.properties.endRadius = 0.0001;
      coneUp.properties.color = [color[0], color[1], color[2], 1.0];
      coneUp.setDirtyCPU();

      coneDown.properties.start = [normalizedData.center[0], normalizedData.center[1], normalizedData.center[2]];
      coneDown.properties.end = [
        normalizedData.center[0] - firstPCVal * firstPCVec[0],
        normalizedData.center[1] - firstPCVal * firstPCVec[1],
        normalizedData.center[2] - firstPCVal * firstPCVec[2],
      ];
      coneDown.properties.startRadius = secondPCVal;
      coneDown.properties.endRadius = 0.0001;
      coneDown.properties.color = [color[0], color[1], color[2], 1.0];
      coneDown.setDirtyCPU();
    }
  
    onMount(() => {
      return () => {
        if (viewport && $viewport?.scene && coneUpID != null && coneDownID != null) {
          $viewport.scene.removeObjectByID(coneUpID);
          $viewport.scene.removeObjectByID(coneDownID);
        }
      };
    });
  </script>
  