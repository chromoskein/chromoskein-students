<script lang="ts">
    import { getContext, onMount } from "svelte";
    import {RoundedCone, Sphere} from "@chromoskein/lib-graphics";
    import type { Writable } from "svelte/store";
    import type { Viewport3D } from "@chromoskein/lib-graphics";
    import { vec3 } from "gl-matrix";
    import type { ClusterBlob } from "../utils/main";
  
    let viewport: Writable<Viewport3D | null> = getContext("viewport");
    
    export let blobID: number = 0.0;
    export let blobs: ClusterBlob[] = [];
    export let minDistance: number = 1.0;
    export let color: vec3 = vec3.fromValues(1.0, 1.0, 1.0);
    export let radius: number = 0.1;
    export let precise: boolean = false;


    let cones: RoundedCone[] = [];
    let coneIDs: number[] = [];
    let sphere: Sphere | null = null;
    let sphereID: number | null = null;
    let quills: vec3[] = [];

    function findClosestPoint(blob1: ClusterBlob, blob2: ClusterBlob, minDistance: number): vec3 | null {
      let foundMinDistance = Infinity;
      let closestPoint: vec3 | null = null;

      for (let i = 0; i < blob1.normalizedPoints.length; i++) {
          for (let j = 0; j < blob2.normalizedPoints.length; j++) {
            let a = vec3.add(vec3.create(), vec3.scale(vec3.create(), blob1.normalizedPoints[i], blob1.scale), blob1.center); 
            let b = vec3.add(vec3.create(), vec3.scale(vec3.create(), blob2.normalizedPoints[j], blob2.scale), blob2.center);
              let distance = vec3.dist(a, b);
              if (distance < foundMinDistance && distance < minDistance) {
                foundMinDistance = distance;
                closestPoint = a;
              }
          } 
      }
    
      return closestPoint;
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
  
    $: if (blobs) {
      quills = [];
      for (let i = 0; i < blobs.length; i++) {
        if (i != blobID) {
          let closestPoint = findClosestPoint(blobs[blobID], blobs[i], minDistance); 
          if (closestPoint != null) {
            if (precise) {
              quills.push(closestPoint);
            }
            else {
              quills.push(vec3.lerp(vec3.create(), blobs[blobID].center, blobs[i].center, 0.5));
            }
          }
        }
      }
    }

    $: if (cones || sphere) {
      for (let i = 0; i < quills.length; i++) {        
        cones[i].properties.start = [blobs[blobID].center[0], blobs[blobID].center[1], blobs[blobID].center[2]];
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
        sphere.properties.center = [blobs[blobID].center[0], blobs[blobID].center[1], blobs[blobID].center[2]];
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
  