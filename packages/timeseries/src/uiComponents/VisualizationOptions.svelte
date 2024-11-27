
<script lang="ts">

    import {  Select, SelectItem, Checkbox, Slider} from "carbon-components-svelte";
    import { type ClusterNode, loadBitmap, VisualisationType } from "../utils/main";
    import type { VisOptions } from "../utils/data-models";
    import Dendrogram from "./Dendrogram.svelte";
    import * as Graphics from "@chromoskein/lib-graphics";
    import InteractiveCluster from "../visalizations/InteractiveCluster.svelte";
    import ChromatinVisualization from "./ChromatinVisualization.svelte";
  
    //export let selectedVis: ChromatinVisualization;
    export let viewport: Graphics.Viewport3D;
    export let ops: VisOptions;
    export let dataClustersGivenK: ClusterNode[][];
    export let size: number;
    export let visualization: ChromatinVisualization;

    let interactiveCluster: InteractiveCluster | null = null;

    let visType: VisualisationType;

    $: visType = ops.visType;

    $: if (visType == VisualisationType.Composite) {
      interactiveCluster = visualization?.getInteractiveCluster();
    }


    async function changeColormap(volumeColormapChoice) {
      let path;
      switch (volumeColormapChoice) {
        case "White to Black":
          path = "./colormaps/blackwhite.png";
          break;
        case "Rainbow":
          path = "./colormaps/rainbow.png";
          break;
        case "Cool Warm":
          path = "./colormaps/cool-warm-paraview.png";
          break;
        case "Matplotlib Plasma":
          path = "./colormaps/matplotlib-plasma.png";
          break;
        case "Samsel Linear Green":
          path = "./colormaps/samsel-linear-green.png";
          break;
      }
      let volumeColormap = await loadBitmap(path);

      if (viewport && viewport.scene) {
        viewport.scene.setColorMapFromBitmap(volumeColormap);
      }
  }

</script>




<div>
    <Select size="sm" inline labelText="Visualization:" bind:selected={ops.visType}>
      {#each Object.keys(VisualisationType) as key, index}
        <SelectItem value={key}/>  
      {/each}
    </Select>

      {#if visType == VisualisationType.Composite}
        <Select size="sm" selected="Split" inline labelText="Action:" on:change={(event) => {visualization.getInteractiveCluster()?.setAction(event.detail)}}>
          <SelectItem value="Change representation" />
          <SelectItem value="Split" />
          <SelectItem value="Merge" />
        </Select>

        <Select size="sm" inline selected="Pathline" labelText="Visualization type:" on:change={(event) => {visualization.getInteractiveCluster()?.setRepresentation(event.detail)}}>
          {#each Object.keys(VisualisationType) as key, index}
            {#if key != VisualisationType.None && key != VisualisationType.Composite}
              <SelectItem value={key}/>  
            {/if}
          {/each}
          <SelectItem value="AbstractVolume" />
        </Select>

        <Checkbox labelText="Show cluster connections" on:check={(event) => {visualization.getInteractiveCluster()?.setShowConnections(event.detail)}}/>
      {/if} 

      <!-- {#if visType != VisualisationType.Composite && visType != VisualisationType.None && visType != VisualisationType.Volume && visType != VisualisationType.Matryoshka}
      <Checkbox labelText="Colored" bind:checked={blobsColored} />
      {/if} -->

      <!-- {#if visType != VisualisationType.None && visType != VisualisationType.Composite}
      <Checkbox labelText="Cluster at timestep" bind:checked={timestepClustering} />
      {/if} -->

      <!-- {#if visType == VisualisationType.Matryoshka}
      <Checkbox labelText="Experimental colors" bind:checked={experimentalColors} />
      {/if} -->

      {#if ops.visType != VisualisationType.Matryoshka && ops.visType != VisualisationType.Composite && ops.visType != VisualisationType.None}
      <Slider labelText="Cluster amount" fullWidth min={1} max={dataClustersGivenK.length - 1} bind:value={ops.blobsAmount} />
      {/if}
      {#if ops.visType == VisualisationType.Implicit || ops.visType == VisualisationType.Matryoshka || ops.visType == VisualisationType.Pathline || ops.visType == VisualisationType.Spheres || ops.visType == VisualisationType.Spline || ops.visType == VisualisationType.Composite}
        <Slider labelText="Radius" fullWidth min={0.01} max={0.3} step={0.01} bind:value={ops.radius} />
      {/if}
      {#if ops.visType == VisualisationType.Matryoshka || ops.visType == VisualisationType.Volume}
        <Slider labelText="Alpha" fullWidth min={0.05} max={1.0} step={0.05} bind:value={ops.alpha} />
      {/if}
      {#if ops.visType == VisualisationType.Hedgehog || visType == VisualisationType.Composite}
        <Slider labelText="Max distance" fullWidth min={0.0} max={0.5} step={0.01} bind:value={ops.hedgehogDistance} />
        <Checkbox labelText="Precise quills" bind:checked={ops.preciseQuills} />
        {#if ops.preciseQuills}
          <Checkbox labelText="Point to enemy" bind:checked={ops.secondPoint} />
          <Slider labelText="Threshold" fullWidth min={0.0} max={1.0} step={0.01} bind:value={ops.hedgehogThreshold} />
        {/if}  
      {/if}

      {#if ops.visType == VisualisationType.Volume}
        <Checkbox labelText="Abstractize volumes" bind:checked={ops.abstractVolumes} />

        <Slider labelText="Radius" fullWidth min={0.01} max={0.1} step={0.01} bind:value={ops.radius} />

        <!-- <Checkbox labelText="Use colormap" bind:checked={true} /> -->

        <Select labelText="Colormap" bind:selected={ops.volumeColormapChoice} on:change={(event) => changeColormap(event.detail)}>
          <SelectItem value="White to Black" />
          <SelectItem value="Rainbow" />
          <SelectItem value="Cool Warm" />
          <SelectItem value="Matplotlib Plasma" />
          <SelectItem value="Samsel Linear Green" />
        </Select>

        <Select labelText="Math Function" bind:selected={ops.volumeFunction}>
          <SelectItem text="Last Timestep" value={0} />
          <SelectItem text="Number of Timesteps" value={1} />
        </Select>
    {/if}


    {#if dataClustersGivenK && dataClustersGivenK[1]}
      <Dendrogram
        dataClustersGivenK={dataClustersGivenK}
        visualizationSelected={ops.visType}
        bind:blobsAmount={ops.blobsAmount}
        modelSize={size}
        experimental={false}
        action={"Merge"}
        bind:matryoshkaVisibility={ops.matryoshkaBlobsVisible}
        interactiveCluster={interactiveCluster} 
        update={false}
      />
    {/if}
</div>