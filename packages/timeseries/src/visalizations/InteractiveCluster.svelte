<script lang="ts">
    import { type AbstractClusterComposite, type ClusterNode, ClusterLeaf } from "../utils/main";
    import { getContext, onMount } from "svelte";
    import type { Writable } from "svelte/store";
    import type { Viewport3D } from "lib-graphics";
    import type { vec3 } from "gl-matrix";
    import * as Graphics from "lib-graphics";
    import { vec2 } from "gl-matrix";

    let viewport: Writable<Viewport3D | null> = getContext("viewport");

    export let dataClustersGivenK: ClusterNode[][] | null = null;
    export let points: vec3[] = [];

    let clusterComponent: AbstractClusterComposite = null;
    let canvas: HTMLElement | null = null;

    function onElementButtonClick(event) {
		  let rect = canvas.getBoundingClientRect(); // abs. size of element    
      let ray = Graphics.screenSpaceToRay(vec2.fromValues((event.clientX - rect.left) / rect.width, (event.clientY - rect.top) / rect.height), $viewport.camera);
      

      clusterComponent.rayIntersection(ray, dataClustersGivenK, points, $viewport);
      clusterComponent.updatePoints($viewport, points);
	  }
  
    $: if ($viewport) {
      if (clusterComponent == null) {
        clusterComponent = new ClusterLeaf(1, 0, dataClustersGivenK, null);
        canvas = document.getElementById("canvas");
        canvas?.addEventListener("mousedown", onElementButtonClick); 
      }

      
    }
  
    $: if ($viewport && points) {
      clusterComponent.updatePoints($viewport, points);
    }

    onMount(() => {
      return () => {
        // Add deletion code eventually
      };
    });
  </script>

<div on:click={onElementButtonClick} />
  