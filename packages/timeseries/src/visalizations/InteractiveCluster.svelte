<script lang="ts">
    import { InteractiveClusters, type ClusterNode, ClusterLeaf } from "../utils/main";
    import { getContext, onMount } from "svelte";
    import type { Writable } from "svelte/store";
    import type { Viewport3D } from "lib-graphics";
    import type { vec3 } from "gl-matrix";
    import * as Graphics from "lib-graphics";
    import { vec2 } from "gl-matrix";

    let viewport: Writable<Viewport3D | null> = getContext("viewport");

    export let dataClustersGivenK: ClusterNode[][] | null = null;
    export let points: vec3[] = [];

    let clusterObjects: InteractiveClusters = null;
    let canvas: HTMLElement | null = null;

    function onElementButtonClick(event) {
		  let rect = canvas.getBoundingClientRect(); // abs. size of element    
      let ray = Graphics.screenSpaceToRay(vec2.fromValues((event.clientX - rect.left) / rect.width, (event.clientY - rect.top) / rect.height), $viewport.camera);
      

      let hitCluster: ClusterLeaf = clusterObjects.rayIntersection(ray);
      if (hitCluster != null) hitCluster.split(dataClustersGivenK, points, $viewport);
      clusterObjects.update(points);
	  }
  
    $: if ($viewport) {
      if (clusterObjects == null) {
        clusterObjects = new InteractiveClusters(dataClustersGivenK, points, $viewport);
        canvas = document.getElementById("canvas");
        canvas?.addEventListener("mousedown", onElementButtonClick); 
      }
    }
  
    $: if ($viewport && points) {
      clusterObjects.update(points);
    }

    onMount(() => {
      return () => {
        if (clusterObjects)
          clusterObjects.delete();
        canvas = document.getElementById("canvas");
        canvas?.removeEventListener("mousedown", onElementButtonClick); 
      };
    });
  </script>
  