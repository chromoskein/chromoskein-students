<script lang="ts">
    import {  Select, SelectItem, Checkbox, Slider} from "carbon-components-svelte";
    import { type ClusterNode, loadBitmap } from "../utils/main";
    import Dendrogram from "./Dendrogram.svelte";
    import { VisualisationType, type AllOptions } from "../types";

  
    interface VisualizationOptionsProps {
      options: AllOptions,
      clusterTree: ClusterNode[][],
      size: number,
    }

    let {
      options = $bindable(),
      clusterTree,
      size,
    }: VisualizationOptionsProps = $props();

    $effect(() => { if (clusterTree) {
        let visible = new Array(clusterTree.length - 1).fill(false);
        visible[0] = true;
        options.matryoshkaBlobsVisible = visible;
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

      options.volumeColormap = await loadBitmap(path);
      options.volumeColormapChoice = event.detail;
  }
</script>


<div>
    <Select size="sm" inline labelText="Visualization:" selected={options.type} on:update={(e) => { options.type = VisualisationType[e.detail as keyof typeof VisualisationType]}}>
      {#each Object.keys(VisualisationType) as key, index}
        <SelectItem value={key}/>  
      {/each}
    </Select>

    {#if options.type == VisualisationType.Test}
      <Select size="sm" inline labelText="Secondary Vis:" selected={options.secondaryVisualisation} on:update={(e) => options.secondaryVisualisation = VisualisationType[e.detail as keyof typeof VisualisationType]}>
        <SelectItem value={VisualisationType.AbstractSpheres}/>  
        <SelectItem value={VisualisationType.Cones}/>  
        <SelectItem value={VisualisationType.Hedgehog}/>  
      </Select>
    {/if}

    {#if options.type == VisualisationType.Composite && options.interactiveCluster}
      <Select size="sm" selected="Split" inline labelText="Action:" on:update={(event) => {options.interactiveCluster!.setAction(event.detail as string)}}>
        <SelectItem value="Change representation" />
        <SelectItem value="Split" />
        <SelectItem value="Merge" />
      </Select>

      <Select size="sm" inline selected="Pathline" labelText="Visualization type:" on:update={(event) => {options.interactiveCluster!.setRepresentation(VisualisationType[event.detail as keyof typeof VisualisationType])}}>
        {#each Object.keys(VisualisationType) as key, index}
          {#if key != VisualisationType.None && key != VisualisationType.Composite}
            <SelectItem value={key}/>  
          {/if}
        {/each}
        <SelectItem value="AbstractVolume" />
      </Select>
    {/if}
    
    {#if options.type == VisualisationType.Composite}
      <Checkbox labelText="Show cluster connections" checked={options.showConnectors} on:check={(event) => {options.interactiveCluster?.setShowConnections(event.detail)}}/>
    {/if}
      
    {#if options.type == VisualisationType.Cones || options.type == VisualisationType.AbstractSpheres || options.type == VisualisationType.Hedgehog}
      <Checkbox labelText="Show cluster connections" checked={options.showConnectors} on:check={(event) => {options.showConnectors = event.detail}}/>
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

    {#if options.type != VisualisationType.Matryoshka && options.type != VisualisationType.Composite && options.type != VisualisationType.None}
      <Slider labelText="Cluster amount" fullWidth min={1} max={clusterTree.length - 1} value={options.blobsAmount} on:input={(e) => {options.blobsAmount = e.detail}}/>
    {/if}
    {#if options.type == VisualisationType.Test || options.type == VisualisationType.Implicit || options.type == VisualisationType.Matryoshka || options.type == VisualisationType.Pathline || options.type == VisualisationType.Spheres || options.type == VisualisationType.Spline || options.type == VisualisationType.Composite}
      <Slider labelText="Radius" fullWidth min={0.01} max={0.3} step={0.01} value={options.radius} on:input={(e) => options.radius = e.detail} />
    {/if}
    {#if options.type == VisualisationType.Matryoshka || options.type == VisualisationType.Volume}
      <Slider labelText="Alpha" fullWidth min={0.05} max={1.0} step={0.05} value={options.alpha} on:input={(e) => options.alpha = e.detail} />
    {/if}
    {#if options.type == VisualisationType.Hedgehog || options.type == VisualisationType.Composite || (options.type == VisualisationType.Test && options.secondaryVisualisation == VisualisationType.Hedgehog)}
      <Slider labelText="Max distance" fullWidth min={0.0} max={0.5} step={0.01} value={options.hedgehogDistance} on:input={(e) => options.hedgehogDistance = e.detail} />
      <Checkbox labelText="Precise quills" checked={options.preciseQuills} on:check={(e) => options.preciseQuills = e.detail} />
      {#if options.preciseQuills}
        <Checkbox labelText="Point to enemy" checked={options.secondPoint} on:check={(e) => options.secondPoint = e.detail}/>
        <Slider labelText="Threshold" fullWidth min={0.0} max={1.0} step={0.01} value={options.hedgehogThreshold} on:input={(e) => options.hedgehogThreshold = e.detail}/>
      {/if}  
    {/if}

    {#if options.type == VisualisationType.Hedgehog || options.type == VisualisationType.AbstractSpheres || options.type == VisualisationType.Cones || options.type == VisualisationType.Composite || options.type == VisualisationType.Test}
      <Slider labelText="Size divider" fullWidth min={2} max={25} step={1} value={options.abstractionMultiplier} on:input={(e) => options.abstractionMultiplier = e.detail} />
    {/if}

    {#if options.type == VisualisationType.Volume}
      <Checkbox labelText="Abstractize volumes" checked={options.abstractVolumes} on:check={(e) => options.abstractVolumes = e.detail} />

      <Slider labelText="Radius" fullWidth min={0.01} max={0.1} step={0.01} value={options.radius} on:input={(e) => options.radius = e.detail} />

      <!-- <Checkbox labelText="Use colormap" bind:checked={true} /> -->

      <Select labelText="Colormap" selected={options.volumeColormapChoice} on:update={changeColormap}>
        <SelectItem value="White to Black" />
        <SelectItem value="Rainbow" />
        <SelectItem value="Cool Warm" />
        <SelectItem value="Matplotlib Plasma" />
        <SelectItem value="Samsel Linear Green" />
      </Select>

      <Select labelText="Math Function" selected={options.volumeFunction} on:update={(e) => options.volumeFunction = e.detail as number}>
        <SelectItem text="Last Timestep" value={0} />
        <SelectItem text="Number of Timesteps" value={1} />
      </Select>
    {/if}

    <Checkbox labelText="Outlines" checked={options.outline} on:check={(e) => options.outline = e.detail} />
    <Checkbox labelText="Color Outlines" checked={false} />

    {#if clusterTree && clusterTree[1]}
      <Dendrogram
        bind:options
        {clusterTree}
        modelSize={size}
        action={"Merge"}
        experimental={false}
        update={false}
        onmatryoshkaclick={() => {}}
        onclick={(amount) => options.blobsAmount = amount}
      />
    {/if}
</div>