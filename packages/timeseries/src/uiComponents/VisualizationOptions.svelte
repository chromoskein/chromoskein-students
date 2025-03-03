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

    let matryoshkaBlobsVisible = $state(ops.matryoshkaBlobsVisible);

    $effect(() => { if (dataClustersGivenK) {
        let visible = new Array(dataClustersGivenK.length - 1).fill(false);
        visible[0] = true;
        ops.matryoshkaBlobsVisible = visible;
    }});

    async function changeColormap(event: CustomEvent) {
      let path: string;
      switch (event.detail) {
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
    <Select size="sm" inline labelText="Visualization:" selected={ops.visType} on:update={(e) => { ops.visType = VisualisationType[e.detail as keyof typeof VisualisationType]}}>
      {#each Object.keys(VisualisationType) as key, index}
        <SelectItem value={key}/>  
      {/each}
    </Select>
    {#if ops.visType == VisualisationType.Test}
      <Select size="sm" inline labelText="Secondary Vis:" selected={ops.secondaryVis} on:update={(e) => ops.secondaryVis = VisualisationType[e.detail as keyof typeof VisualisationType]}>
        <SelectItem value={VisualisationType.AbstractSpheres}/>  
        <SelectItem value={VisualisationType.Cones}/>  
        <SelectItem value={VisualisationType.Hedgehog}/>  
      </Select>
    {/if}

    {#if ops.visType == VisualisationType.Composite && interactiveCluster}
      <Select size="sm" selected="Split" inline labelText="Action:" on:update={(event) => {interactiveCluster.setAction(event.detail as string)}}>
        <SelectItem value="Change representation" />
        <SelectItem value="Split" />
        <SelectItem value="Merge" />
      </Select>

      <Select size="sm" inline selected="Pathline" labelText="Visualization type:" on:update={(event) => {interactiveCluster.setRepresentation(VisualisationType[event.detail as keyof typeof VisualisationType])}}>
        {#each Object.keys(VisualisationType) as key, index}
          {#if key != VisualisationType.None && key != VisualisationType.Composite}
            <SelectItem value={key}/>  
          {/if}
        {/each}
        <SelectItem value="AbstractVolume" />
      </Select>
    {/if}
      
    {#if ops.visType == VisualisationType.Composite || ops.visType == VisualisationType.Cones || ops.visType == VisualisationType.AbstractSpheres || ops.visType == VisualisationType.Hedgehog}
      <Checkbox labelText="Show cluster connections" checked={ops.showConnectors} on:check={(event) => {interactiveCluster?.setShowConnections(event.detail); ops.showConnectors = event.detail}}/>
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
      <Slider labelText="Cluster amount" fullWidth min={1} max={dataClustersGivenK.length - 1} value={ops.blobsAmount} on:input={(e) => {ops.blobsAmount = e.detail}}/>
    {/if}
    {#if ops.visType == VisualisationType.Test || ops.visType == VisualisationType.Implicit || ops.visType == VisualisationType.Matryoshka || ops.visType == VisualisationType.Pathline || ops.visType == VisualisationType.Spheres || ops.visType == VisualisationType.Spline || ops.visType == VisualisationType.Composite}
      <Slider labelText="Radius" fullWidth min={0.01} max={0.3} step={0.01} value={ops.radius} on:input={(e) => ops.radius = e.detail} />
    {/if}
    {#if ops.visType == VisualisationType.Matryoshka || ops.visType == VisualisationType.Volume}
      <Slider labelText="Alpha" fullWidth min={0.05} max={1.0} step={0.05} value={ops.alpha} on:input={(e) => ops.alpha = e.detail} />
    {/if}
    {#if ops.visType == VisualisationType.Hedgehog || ops.visType == VisualisationType.Composite || (ops.visType == VisualisationType.Test && ops.secondaryVis == VisualisationType.Hedgehog)}
      <Slider labelText="Max distance" fullWidth min={0.0} max={0.5} step={0.01} value={ops.hedgehogDistance} on:input={(e) => ops.hedgehogDistance = e.detail} />
      <Checkbox labelText="Precise quills" checked={ops.preciseQuills} on:check={(e) => ops.preciseQuills = e.detail} />
      {#if ops.preciseQuills}
        <Checkbox labelText="Point to enemy" checked={ops.secondPoint} on:check={(e) => ops.secondPoint = e.detail}/>
        <Slider labelText="Threshold" fullWidth min={0.0} max={1.0} step={0.01} value={ops.hedgehogThreshold} on:input={(e) => ops.hedgehogThreshold = e.detail}/>
      {/if}  
    {/if}

    {#if ops.visType == VisualisationType.Hedgehog || ops.visType == VisualisationType.AbstractSpheres || ops.visType == VisualisationType.Cones || ops.visType == VisualisationType.Composite || ops.visType == VisualisationType.Test}
      <Slider labelText="Size divider" fullWidth min={2} max={25} step={1} value={ops.abstractionMultiplier} on:input={(e) => ops.abstractionMultiplier = e.detail} />
    {/if}

    {#if ops.visType == VisualisationType.Volume}
      <Checkbox labelText="Abstractize volumes" checked={ops.abstractVolumes} on:check={(e) => ops.abstractVolumes = e.detail} />

      <Slider labelText="Radius" fullWidth min={0.01} max={0.1} step={0.01} value={ops.radius} on:input={(e) => ops.radius = e.detail} />

      <!-- <Checkbox labelText="Use colormap" bind:checked={true} /> -->

      <Select labelText="Colormap" selected={ops.volumeColormapChoice} on:update={changeColormap}>
        <SelectItem value="White to Black" />
        <SelectItem value="Rainbow" />
        <SelectItem value="Cool Warm" />
        <SelectItem value="Matplotlib Plasma" />
        <SelectItem value="Samsel Linear Green" />
      </Select>

      <Select labelText="Math Function" selected={ops.volumeFunction} on:update={(e) => ops.volumeFunction = e.detail as number}>
        <SelectItem text="Last Timestep" value={0} />
        <SelectItem text="Number of Timesteps" value={1} />
      </Select>
    {/if}
 
    <Checkbox labelText="Outlines" checked={ops.outlines} on:check={(e) => ops.outlines = e.detail} />
    <!-- <Checkbox labelText="Color Outlines" checked={false} /> -->

    {#if dataClustersGivenK && dataClustersGivenK[1]}
      <Dendrogram
        dataClustersGivenK={dataClustersGivenK}
        visualizationSelected={ops.visType}
        blobsAmount={ops.blobsAmount}
        modelSize={size}
        experimental={false}
        action={"Merge"}
        bind:matryoshkaVisibility={matryoshkaBlobsVisible}
        interactiveCluster={interactiveCluster} 
        update={false}
        onmatryoshkaclick={() => ops.matryoshkaBlobsVisible = matryoshkaBlobsVisible}
        onclick={(amount) => ops.blobsAmount = amount}
      />
    {/if}
</div>