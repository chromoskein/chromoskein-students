<script lang="ts">
    import { getContext, onMount } from "svelte";
    import {RoundedCone, Sphere} from "@chromoskein/lib-graphics";
    import type { Writable } from "svelte/store";
    import type { Viewport3D } from "@chromoskein/lib-graphics";
    import { vec3 } from "gl-matrix";
    import type { ClusterNode } from "../utils/main";
    import { calculateSphereParameters, findClosestPoints } from "../utils/abstractClustersUtils";
  
    let viewport: Writable<Viewport3D | null> = getContext("viewport");
    
    export let points: vec3[] = [];
    export let clusterID: number = 0.0;
    export let clusters: ClusterNode[] = [];
    export let minDistance: number = 1.0;
    export let threshold: number = 0.5;
    export let color: vec3 = vec3.fromValues(1.0, 1.0, 1.0);
    export let precise: boolean = false;
    export let secondPoint: boolean = false;
    export let radiusMultiplier: number = 8.0;

    let cones: RoundedCone[] = [];
    let coneIDs: number[] = [];
    let sphere: Sphere | null = null;
    let sphereID: number | null = null;
    let quills: vec3[] = [];
    let center: vec3 = vec3.fromValues(0, 0, 0);
    let radius = 0.1;
  
    $: if ($viewport) {
      for (let i = 0; i < coneIDs.length; i++) {
        $viewport.scene.removeObjectByID(coneIDs[i]);
      }
      $viewport.scene.removeObjectByID(sphereID);
  
      for (let i = 0; i < quills.length; i++) {
        [cones[i], coneIDs[i]] = $viewport.scene.addObject(RoundedCone);
        cones[i].setDirtyCPU;
      }
      
      if (quills.length == 0) {
        [sphere, sphereID] = $viewport.scene.addObject(Sphere);
        sphere.setDirtyCPU();
      }
    }
  

    $: if (clusters && clusters[clusterID]) {
      quills = [];
      let clusterPoints = points.slice(clusters[clusterID].from, clusters[clusterID].to + 1);
      let params = calculateSphereParameters(clusterPoints);
      radius = params.radius / radiusMultiplier;
      center = params.center;

      for (let i = 0; i < clusters.length; i++) {
        if (i == clusterID) continue;

        let otherClusterPoints = points.slice(clusters[i].from, clusters[i].to + 1);
        let closestPoints = findClosestPoints(clusterPoints, otherClusterPoints, minDistance, threshold, secondPoint); 
        if (precise) {
          closestPoints.forEach(element => quills.push(element));
        }
        else if (closestPoints.length > 0) {
          quills.push(vec3.lerp(vec3.create(), center, calculateSphereParameters(otherClusterPoints).center, 0.5));
        }
      }
    }

    $: if (cones || sphere) {
      for (let i = 0; i < quills.length; i++) {        
        cones[i].properties.start = [center[0], center[1], center[2]];
        cones[i].properties.end = [
            quills[i][0],
            quills[i][1],
            quills[i][2],
        ]
        
        cones[i].properties.startRadius = radius;
        cones[i].properties.endRadius = 0.001;
        cones[i].properties.color = [color[0], color[1], color[2], 1.0];
        cones[i].setDirtyCPU();
      }

      if (quills.length == 0) {
        sphere.properties.radius = radius;
        sphere.properties.center = [center[0], center[1], center[2]];
        sphere.properties.color = [color[0], color[1], color[2], 1.0];
        sphere.setDirtyCPU();
      }
    }
  
    onMount(() => {
      return () => {
        if (viewport && $viewport?.scene) {
          for (let i = 0; i < coneIDs.length; i++) {
            $viewport.scene.removeObjectByID(coneIDs[i]);
          }
          $viewport.scene.removeObjectByID(sphereID);
        }
      };
    });
  </script>
  