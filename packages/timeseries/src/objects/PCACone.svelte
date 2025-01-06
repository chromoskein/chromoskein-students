<script lang="ts">
    import { getContext, onMount } from "svelte";
    import PCA from 'pca-js';
    import { RoundedCone } from "@chromoskein/lib-graphics";
    import type { Writable } from "svelte/store";
    import type { Viewport3D } from "@chromoskein/lib-graphics";
    import { vec3 } from "gl-matrix";
    import { blobFromPoints, type ClusterBlob } from "../utils/main";
    import { calculateSphereParameters } from "../utils/abstractClustersUtils";

    interface PCAConeProps {
      points: vec3[],
      color: vec3,
      radiusMultiplier: number
    }

    let {
      points = [],
      color = vec3.fromValues(1.0, 1.0, 1.0),
      radiusMultiplier = 2.0,
    }: PCAConeProps = $props();

    let pcaResult: {
      eigenvalue: number;
      vector: vec3;
    }[] = $derived(PCA.getEigenVectors(blobFromPoints(points).normalizedPoints))
    
    let firstPCVec: vec3 = $derived(pcaResult[0].vector);
    let firstPCVal: number = $derived(pcaResult[0].eigenvalue);
    let secondPCVal: number = $derived(pcaResult[1].eigenvalue);
    let center: vec3 = $derived(calculateSphereParameters(points).center);
    
    let viewport: Writable<Viewport3D | null> = getContext("viewport");
    let [coneUp, coneUpID] = $derived.by(() => {
        if ($viewport && $viewport.scene) {
            return $viewport.scene.addObjectInstanced(RoundedCone);
        }
        return [null, null]
    });

    let [coneDown, coneDownID] = $derived.by(() => {
        if ($viewport && $viewport.scene) {
            return $viewport.scene.addObjectInstanced(RoundedCone);
        }
        return [null, null]
    });
  
    $effect(() => {
      if (coneUp && coneDown) {
        coneUp.properties.start = [center[0], center[1], center[2]];
        coneUp.properties.end = [
          center[0] + firstPCVal / radiusMultiplier * firstPCVec[0],
          center[1] + firstPCVal / radiusMultiplier * firstPCVec[1],
          center[2] + firstPCVal / radiusMultiplier * firstPCVec[2],
        ];
        coneUp.properties.startRadius = secondPCVal / radiusMultiplier;
        coneUp.properties.endRadius = 0.0001;
        coneUp.properties.color = [color[0], color[1], color[2], 1.0];
        coneUp.setDirtyCPU();

        coneDown.properties.start = [center[0], center[1], center[2]];
        coneDown.properties.end = [
          center[0] - firstPCVal / radiusMultiplier * firstPCVec[0],
          center[1] - firstPCVal / radiusMultiplier * firstPCVec[1],
          center[2] - firstPCVal / radiusMultiplier * firstPCVec[2],
        ];
        coneDown.properties.startRadius = secondPCVal / radiusMultiplier;
        coneDown.properties.endRadius = 0.0001;
        coneDown.properties.color = [color[0], color[1], color[2], 1.0];
        coneDown.setDirtyCPU();
      }
    });
  
    onMount(() => {
      return () => {
        if (viewport && $viewport?.scene && coneUpID != null && coneDownID != null) {
          $viewport.scene.removeObjectByID(coneUpID);
          $viewport.scene.removeObjectByID(coneDownID);
        }
      };
    });
  </script>
  