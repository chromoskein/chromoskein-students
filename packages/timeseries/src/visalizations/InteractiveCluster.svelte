<script lang="ts">
    import type { ClusterNode } from "../utils/main";
    import { InteractiveClusters } from "../interactiveClusters/interactiveClusters";
    import type { ClusterComposite } from "../interactiveClusters/clusterComposite";
    import { HedgehogClusterVisualisation, SphereSimplificationClusterVisualisation, PCAClusterVisualisation, SDGClusterVisualisation, PathlineClusterVisualization } from "../interactiveClusters/visualisations/index";
    import { getContext, onMount } from "svelte";
    import type { Writable } from "svelte/store";
    import type { Viewport3D } from "lib-graphics";
    import type { vec3 } from "gl-matrix";
    import * as Graphics from "lib-graphics";
    import { vec2 } from "gl-matrix";
    import { ClusterHighlighter } from "../interactiveClusters/clusterHighlighter";
    import { VolumeClusterVisualisation } from "../interactiveClusters/visualisations/volumeClusterVisualisation";
    import { SplineClusterVisualisation } from "../interactiveClusters/visualisations/splineVisualisation";
    import { SpheresClusterVisualization } from "../interactiveClusters/visualisations/spheresClusterVisualisation";

    let viewport: Writable<Viewport3D | null> = getContext("viewport");
    let device: Writable<GPUDevice> = getContext("device");
    let clusterHighlighter: ClusterHighlighter = new ClusterHighlighter();

    export let dataClustersGivenK: ClusterNode[][] | null = null;
    export let pointsAtTimesteps: vec3[][] = [];
    export let selectedTimestep = 0;
    export let clusterVisualization: string;
    export let showConnections: Boolean = false;
    export let clustersUpdated;
    export let updateClustersUpdated;
    export let action;

    let clusterObjects: InteractiveClusters = null;
    let canvas: HTMLElement | null = null;

    const representations = {
      "Sphere": SphereSimplificationClusterVisualisation,
      "Hedgehog": HedgehogClusterVisualisation,
      "Cone": PCAClusterVisualisation,
      "Default": SDGClusterVisualisation,
      "Pathline": PathlineClusterVisualization,
      "Volume": VolumeClusterVisualisation,
      "Spline": SplineClusterVisualisation,
      "Spherical": SpheresClusterVisualization,
    };

    export function getClusterComposite(cluster) {
      let root = clusterObjects.getRoot();
      let allClusters = root.getInorder();
      for (let i = 0; i < allClusters.length; i++) {
        if (allClusters[i].cluster.k == cluster.k && allClusters[i].cluster.i == cluster.i) {
          return allClusters[i];
        }
      }
    }

    export function splitClusters(hitCluster) {
      hitCluster.split(dataClustersGivenK, pointsAtTimesteps, selectedTimestep);
      updateClustersUpdated(!clustersUpdated);
    }

    export function mergeClusters(hitCluster) {
      hitCluster.merge(dataClustersGivenK, pointsAtTimesteps, selectedTimestep);
      updateClustersUpdated(!clustersUpdated);
    }

    // TODO: fix number of octopi tentacles when any cluster is split
    function onElementLeftButtonClick(event) {
		  let rect = canvas.getBoundingClientRect(); 
      let ray = Graphics.screenSpaceToRay(vec2.fromValues((event.clientX - rect.left) / rect.width, (event.clientY - rect.top) / rect.height), $viewport.camera);

      let hitCluster: ClusterComposite = clusterObjects.rayIntersection(ray);
      if (hitCluster != null) {
        switch(action) {
          case "Change representation":
            let chosenRepresentation = representations[clusterVisualization];
            hitCluster.setVisualisation(chosenRepresentation);
            hitCluster.updatePoints(pointsAtTimesteps, selectedTimestep);
            break;
          case "Split":
            splitClusters(hitCluster);
            break;
          case "Merge":
            mergeClusters(hitCluster);
            break;
        }
      }
	  }

    $: if ($viewport) {
      if (clusterObjects == null) {
        clusterObjects = new InteractiveClusters(dataClustersGivenK, pointsAtTimesteps, selectedTimestep, $viewport, $device);
        canvas = document.getElementById("canvas");
        canvas?.addEventListener("mousedown", event => {
          if (event.button == 0) { // left click for mouse
              onElementLeftButtonClick(event);
          }});
        canvas?.addEventListener("mousemove", function(event) {
          let rect = canvas.getBoundingClientRect(); // abs. size of element    
          let ray = Graphics.screenSpaceToRay(vec2.fromValues((event.clientX - rect.left) / rect.width, (event.clientY - rect.top) / rect.height), $viewport.camera);
          let hitCluster: ClusterComposite = clusterObjects.rayIntersection(ray);
          if (action == "Merge") clusterHighlighter.updateHighlightedClusters(hitCluster, "Merge");
          else clusterHighlighter.updateHighlightedClusters(hitCluster, "Normal");
        });

      }
    }

    $: if (clusterObjects) {
      clusterObjects.setShowConnectors(showConnections);
    }

    $: if ($viewport && pointsAtTimesteps && selectedTimestep) {
      clusterObjects.updatePoints(pointsAtTimesteps, selectedTimestep);
    }

    /*
      This function is here to prevent Svelte seeing *points* as a reactive variable
      in the following reactive statement. This causes the reactive statement to only
      fire in case clustersGivenK is updated
    */
    function updateClusters(dataClustersByK: ClusterNode[][]) {
      if (clusterObjects && pointsAtTimesteps && selectedTimestep) {
        clusterObjects.updateClusters(dataClustersByK);
        clusterObjects.updatePoints(pointsAtTimesteps, selectedTimestep);
      }
    }

    $: if ($viewport && dataClustersGivenK) {
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
  