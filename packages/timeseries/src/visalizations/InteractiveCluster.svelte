<script lang="ts">
    import type { ClusterNode } from "../utils/main";
    import { InteractiveClusters, ClusterLeaf, HedgehogClusterVisualisation, SphereClusterVisualisation } from "../utils/interactiveClusters";
    import { getContext, onMount } from "svelte";
    import type { Writable } from "svelte/store";
    import type { Viewport3D } from "lib-graphics";
    import type { vec3 } from "gl-matrix";
    import * as Graphics from "lib-graphics";
    import { vec2 } from "gl-matrix";

    let viewport: Writable<Viewport3D | null> = getContext("viewport");
    let device: Writable<GPUDevice> = getContext("device");

    export let dataClustersGivenK: ClusterNode[][] | null = null;
    export let points: vec3[] = [];
    export let clusterVisualization: string;

    let clusterObjects: InteractiveClusters = null;
    let canvas: HTMLElement | null = null;

    function onElementRightButtonClick(event) {
		  let rect = canvas.getBoundingClientRect(); // abs. size of element    
      let ray = Graphics.screenSpaceToRay(vec2.fromValues((event.clientX - rect.left) / rect.width, (event.clientY - rect.top) / rect.height), $viewport.camera);

      let hitCluster: ClusterLeaf = clusterObjects.rayIntersection(ray);
      if (hitCluster != null) hitCluster.split(dataClustersGivenK, points);
    }

    function onElementLeftButtonClick(event) {
		  let rect = canvas.getBoundingClientRect(); 
      let ray = Graphics.screenSpaceToRay(vec2.fromValues((event.clientX - rect.left) / rect.width, (event.clientY - rect.top) / rect.height), $viewport.camera);

      let hitCluster: ClusterLeaf = clusterObjects.rayIntersection(ray);
      if (hitCluster != null) hitCluster.changeRepresentation(clusterVisualization, points);
	  }
  
    $: if ($viewport) {
      if (clusterObjects == null) {
        clusterObjects = new InteractiveClusters(dataClustersGivenK, points, $viewport, $device);
        canvas = document.getElementById("canvas");
        canvas?.addEventListener("mousedown", event => {
          if (event.button == 0) { // left click for mouse
              onElementLeftButtonClick(event);
          }});
        canvas?.addEventListener("contextmenu", (event) => { // right click for mouse
          event.preventDefault();
          onElementRightButtonClick(event);
        });

        canvas?.addEventListener('auxclick', function(e) {
          if (e.button == 1) {
            clusterObjects.createConnectors();
          }
        });
      }
    }
  
    $: if ($viewport && points) {
      clusterObjects.updatePoints(points);
    }

    /*
      This function is here to prevent Svelte seeing *points* as a reactive variable
      in the following reactive statement. This causes the reactive statement to only
      fire in case clustersGivenK is updated
    */
    function updateClusters(dataClustersByK: ClusterNode[][]) {
      if (clusterObjects && points) {
        clusterObjects.updateClusters(points, dataClustersByK);
        clusterObjects.updatePoints(points);
      }
    }

    $: if ($viewport && dataClustersGivenK) {
      console.log("Update clusters also");
      updateClusters(dataClustersGivenK);
    } 

    onMount(() => {
      return () => {
        if (clusterObjects)
          clusterObjects.delete();
        canvas = document.getElementById("canvas");
        //canvas?.removeEventListener("mousedown", onElementButtonClick); 
      };
    });
  </script>
  