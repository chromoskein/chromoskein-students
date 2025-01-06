<script lang="ts">
    import {  Select, SelectItem, Checkbox, Slider} from "carbon-components-svelte";
    import { type ClusterNode, loadBitmap, VisualisationType } from "../utils/main";
    import type { VisOptions } from "../utils/data-models";
    import Dendrogram from "./Dendrogram.svelte";
    import * as Graphics from "@chromoskein/lib-graphics";
    import InteractiveCluster from "../visalizations/InteractiveCluster.svelte";
  
    interface VisualizationOptionsProps {
      viewport: Graphics.Viewport3D | null,
      ops: VisOptions,
      dataClustersGivenK: ClusterNode[][],
      size: number,
      interactiveCluster: InteractiveCluster | null
    }

    let {
      viewport,
      ops = $bindable(),
      dataClustersGivenK,
      size,
      interactiveCluster
    }: VisualizationOptionsProps = $props();

    let selectedColormap = $state(ops.volumeColormapChoice);
    let volumeFunction = $state(ops.volumeFunction);
    let visType: VisualisationType = $state(ops.visType);
    let radius = $state(ops.radius);
    let alpha = $state(ops.alpha);
    let blobsAmount = $state(ops.blobsAmount);
    let outlines = $state(ops.outlines);
    let matryoshkaBlobsVisible = $state(ops.matryoshkaBlobsVisible);
    let abstractVolumes = $state(ops.abstractVolumes);
    let hedgehogDistance = $state(ops.hedgehogDistance);
    let hedgehogThreshold = $state(ops.hedgehogThreshold);
    let abstractionMultiplier = $state(ops.abstractionMultiplier);
    let secondaryVis = $state(ops.secondaryVis);


    function onColormapChange(event: Event) {
      ops.volumeColormapChoice = selectedColormap;
      changeColormap(selectedColormap);
    }

    async function changeColormap(volumeColormapChoice: string) {
      let path: string;
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
        default:
          path = "./colormaps/blackwhite.png";
          break;
      }
      let volumeColormap = await loadBitmap(path);

      if (viewport && viewport.scene) {
        viewport.scene.setColorMapFromBitmap(volumeColormap);
      }
  }
</script>


<div>
    <Select size="sm" inline labelText="Visualization:" bind:selected={visType} on:change={() =>ops.visType = visType}>
      {#each Object.keys(VisualisationType) as key, index}
        <SelectItem value={key}/>  
      {/each}
    </Select>
    {#if visType == VisualisationType.Test}
      <Select size="sm" inline labelText="Secondary Vis:" bind:selected={secondaryVis} on:change={() => ops.secondaryVis = secondaryVis}>
        <SelectItem value={VisualisationType.AbstractSpheres}/>  
        <SelectItem value={VisualisationType.Cones}/>  
        <SelectItem value={VisualisationType.Hedgehog}/>  
      </Select>
    {/if}

    {#if visType == VisualisationType.Composite && interactiveCluster}
      <Select size="sm" selected="Split" inline labelText="Action:" on:change={(event) => {interactiveCluster.setAction(event.detail)}}>
        <SelectItem value="Change representation" />
        <SelectItem value="Split" />
        <SelectItem value="Merge" />
      </Select>

      <Select size="sm" inline selected="Pathline" labelText="Visualization type:" on:change={(event) => {interactiveCluster.setRepresentation(event.detail)}}>
        {#each Object.keys(VisualisationType) as key, index}
          {#if key != VisualisationType.None && key != VisualisationType.Composite}
            <SelectItem value={key}/>  
          {/if}
        {/each}
        <SelectItem value="AbstractVolume" />
      </Select>
    {/if}
      
    {#if visType == VisualisationType.Composite || visType == VisualisationType.Cones || visType == VisualisationType.AbstractSpheres || visType == VisualisationType.Hedgehog}
      <Checkbox labelText="Show cluster connections" bind:checked={ops.showConnectors} on:check={(event) => {interactiveCluster?.setShowConnections(event.detail)}}/>
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
      <Slider labelText="Cluster amount" fullWidth min={1} max={dataClustersGivenK.length - 1} bind:value={blobsAmount} on:input={() => ops.blobsAmount = blobsAmount}/>
    {/if}
    {#if ops.visType == VisualisationType.Test || ops.visType == VisualisationType.Implicit || ops.visType == VisualisationType.Matryoshka || ops.visType == VisualisationType.Pathline || ops.visType == VisualisationType.Spheres || ops.visType == VisualisationType.Spline || ops.visType == VisualisationType.Composite}
      <Slider labelText="Radius" fullWidth min={0.01} max={0.3} step={0.01} bind:value={radius} on:input={() => ops.radius = radius} />
    {/if}
    {#if ops.visType == VisualisationType.Matryoshka || ops.visType == VisualisationType.Volume}
      <Slider labelText="Alpha" fullWidth min={0.05} max={1.0} step={0.05} bind:value={alpha} on:input={() => ops.alpha = alpha} />
    {/if}
    {#if ops.visType == VisualisationType.Hedgehog || visType == VisualisationType.Composite || (visType == VisualisationType.Test && ops.secondaryVis == VisualisationType.Hedgehog)}
      <Slider labelText="Max distance" fullWidth min={0.0} max={0.5} step={0.01} bind:value={hedgehogDistance} on:input={() => ops.hedgehogDistance = hedgehogDistance} />
      <Checkbox labelText="Precise quills" bind:checked={ops.preciseQuills} />
      {#if ops.preciseQuills}
        <Checkbox labelText="Point to enemy" bind:checked={ops.secondPoint} />
        <Slider labelText="Threshold" fullWidth min={0.0} max={1.0} step={0.01} bind:value={hedgehogThreshold} on:input={() => ops.hedgehogThreshold = hedgehogThreshold}/>
      {/if}  
    {/if}

    {#if visType == VisualisationType.Hedgehog || visType == VisualisationType.AbstractSpheres || visType == VisualisationType.Cones || visType == VisualisationType.Composite || visType == VisualisationType.Test}
      <Slider labelText="Size divider" fullWidth min={2} max={25} step={1} bind:value={abstractionMultiplier} on:input={() => ops.abstractionMultiplier = abstractionMultiplier} />
    {/if}

    {#if ops.visType == VisualisationType.Volume}
      <Checkbox labelText="Abstractize volumes" bind:checked={abstractVolumes} on:change={() => ops.abstractVolumes = abstractVolumes} />

      <Slider labelText="Radius" fullWidth min={0.01} max={0.1} step={0.01} bind:value={radius} on:input={() => ops.radius = radius} />

      <!-- <Checkbox labelText="Use colormap" bind:checked={true} /> -->

      <Select labelText="Colormap" bind:selected={selectedColormap} on:change={onColormapChange}>
        <SelectItem value="White to Black" />
        <SelectItem value="Rainbow" />
        <SelectItem value="Cool Warm" />
        <SelectItem value="Matplotlib Plasma" />
        <SelectItem value="Samsel Linear Green" />
      </Select>

      <Select labelText="Math Function" bind:selected={volumeFunction} on:change={() => ops.volumeFunction = volumeFunction}>
        <SelectItem text="Last Timestep" value={0} />
        <SelectItem text="Number of Timesteps" value={1} />
      </Select>
    {/if}

    <Checkbox labelText="Outlines" bind:checked={outlines} on:change={() => ops.outlines = outlines} />
    <Checkbox labelText="Color Outlines" checked={false} />

    {#if dataClustersGivenK && dataClustersGivenK[1]}
      <Dendrogram
        dataClustersGivenK={dataClustersGivenK}
        visualizationSelected={visType}
        bind:blobsAmount={blobsAmount}
        modelSize={size}
        experimental={false}
        action={"Merge"}
        bind:matryoshkaVisibility={matryoshkaBlobsVisible}
        interactiveCluster={interactiveCluster} 
        update={false}
      />
    {/if}
</div>