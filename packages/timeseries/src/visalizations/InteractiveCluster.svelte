<script lang="ts">
    import type { ClusterNode } from "../utils/main";
    import { CompositeClusters } from "../interactiveClusters/compositeClusters";
    import type { ClusterCompositeNode } from "../interactiveClusters/clusterCompositeNode";
    import { HedgehogClusterVisualisation, SphereSimplificationClusterVisualisation, PCAClusterVisualisation, SDGClusterVisualisation, PathlineClusterVisualization, SplineClusterVisualisation, SpheresClusterVisualization, AbstractVolumeClusterVisualisation, VolumeClusterVisualisation } from "../interactiveClusters/visualisations/index";
    import { getContext, onMount } from "svelte";
    import type { Writable } from "svelte/store";
    import type { Viewport3D } from "@chromoskein/lib-graphics";
    import type { vec3 } from "gl-matrix";
    import * as Graphics from "@chromoskein/lib-graphics";
    import { vec2 } from "gl-matrix";
    import { ClusterHighlighter } from "../interactiveClusters/clusterHighlighter";

    let viewport: Writable<Viewport3D | null> = getContext("viewport");
    let device: Writable<GPUDevice> = getContext("device");
    let clusterHighlighter: ClusterHighlighter = new ClusterHighlighter();

    export let dataClustersGivenK: ClusterNode[][] | null = null;
    export let pointsAtTimesteps: vec3[][] = [];
    export let selectedTimestep = 0;
    export let clustersUpdated;
    export let updateClustersUpdated;
    
    let showConnections: Boolean = false;
    let clusterVisualization: string = "Pathline";
    let action: string = "Split";

    let clusterObjects: CompositeClusters = null;
    let canvas: HTMLElement | null = null;

    const representations = {
      "AbstractSphere": SphereSimplificationClusterVisualisation,
      "Hedgehog": HedgehogClusterVisualisation,
      "Cone": PCAClusterVisualisation,
      "Implicit": SDGClusterVisualisation,
      "Pathline": PathlineClusterVisualization,
      "AbstractVolume": AbstractVolumeClusterVisualisation,
      "Volume": VolumeClusterVisualisation,
      "Spline": SplineClusterVisualisation,
      "Spheres": SpheresClusterVisualization,
    };

    export function setShowConnections(show: boolean) {
      showConnections = show;
    }

    export function setAction(newAction) {
      action = newAction;
    }

    export function setRepresentation(newRepresentation) {
      clusterVisualization = newRepresentation;
    }

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
      if (event.button != 0) return;
		  let rect = canvas.getBoundingClientRect(); 
      let ray = Graphics.screenSpaceToRay(vec2.fromValues((event.clientX - rect.left) / rect.width, (event.clientY - rect.top) / rect.height), $viewport.camera);

      let hitCluster: ClusterCompositeNode = clusterObjects.rayIntersection(ray);
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

    function onMouseMoveEvent(event) {
      let rect = canvas.getBoundingClientRect(); // abs. size of element    
      let ray = Graphics.screenSpaceToRay(vec2.fromValues((event.clientX - rect.left) / rect.width, (event.clientY - rect.top) / rect.height), $viewport.camera);
      let hitCluster: ClusterCompositeNode = clusterObjects.rayIntersection(ray);
      if (action == "Merge") clusterHighlighter.updateHighlightedClusters(hitCluster, "Merge");
      else clusterHighlighter.updateHighlightedClusters(hitCluster, "Normal");
    }

    $: if ($viewport) {
      if (clusterObjects == null) {
        clusterObjects = new CompositeClusters(dataClustersGivenK, pointsAtTimesteps, selectedTimestep, $viewport, $device);
        canvas = document.getElementById("canvas");
        canvas?.addEventListener("mousedown", onElementLeftButtonClick);
        canvas?.addEventListener("mousemove", onMouseMoveEvent);
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
        canvas?.removeEventListener("mousedown", onElementLeftButtonClick);
        canvas?.removeEventListener("mousemove", onMouseMoveEvent) 
      };
    });
  </script>
  