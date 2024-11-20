<script lang="ts">
    import { getContext, onMount } from "svelte";
    import {RoundedCone, Sphere} from "@chromoskein/lib-graphics";
    import type { Writable } from "svelte/store";
    import type { Viewport3D } from "@chromoskein/lib-graphics";
    import { vec3 } from "gl-matrix";
    import type { ClusterNode } from "../utils/main";
    import { calculateSphereParameters } from "../utils/abstractClustersUtils";
  
    let viewport: Writable<Viewport3D | null> = getContext("viewport");
    
    export let points: vec3[] = [];
    export let clusterID: number = 0.0;
    export let clusters: ClusterNode[] = [];
    export let minDistance: number = 1.0;
    export let threshold: number = 0.5;
    export let color: vec3 = vec3.fromValues(1.0, 1.0, 1.0);
    export let precise: boolean = false;


    let cones: RoundedCone[] = [];
    let coneIDs: number[] = [];
    let sphere: Sphere | null = null;
    let sphereID: number | null = null;
    let quills: vec3[] = [];
    let center: vec3 = vec3.fromValues(0, 0, 0);
    let radius = 0.1;


    function findClosestPoint(cluster1: vec3[], cluster2: vec3[], minDistance: number, threshold: number): vec3[] {
      let closestPoints: {
        point: vec3,
        dist: number
      }[] = [];

      for (let i = 0; i < cluster1.length; i++) {
          for (let j = 0; j < cluster2.length; j++) {
              let distance = vec3.dist(cluster1[i], cluster2[j]);

              if (distance < minDistance) {
                closestPoints.push({
                  point: vec3.lerp(vec3.create(), cluster1[i], cluster2[j], 0.25),
                  dist: distance,
                });
              }
          } 
      }

      // Sorts the found points in descending order
      closestPoints.sort((a, b) => { return a.dist - b.dist });
      let result: vec3[] = [];
      
      for (let candidate of closestPoints) {
        if (result.filter(a => vec3.dist(candidate.point, a) < threshold).length == 0) {
          result.push(candidate.point);
        }
      }

      return result;
    }

  
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
      radius = params.radius / 6.0;
      center = params.center;

      for (let i = 0; i < clusters.length; i++) {
        if (i == clusterID) continue;

        let otherClusterPoints = points.slice(clusters[i].from, clusters[i].to + 1);
        let closestPoints = findClosestPoint(clusterPoints, otherClusterPoints, minDistance, threshold); 
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
  