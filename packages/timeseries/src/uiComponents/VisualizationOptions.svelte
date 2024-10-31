
<script lang="ts">

    import {  Select, SelectItem, Checkbox, Slider} from "carbon-components-svelte";
    import ChromatinVisualization from "./ChromatinVisualization.svelte";
    import { VisualisationType } from "../utils/main";
    import type { VisOptions, StandardOptions, VolumeOptions } from "../utils/data-models";
    import Dendrogram from "./Dendrogram.svelte";
  
    //export let selectedVis: ChromatinVisualization;
    export let ops: VisOptions;
    export let dataClustersGivenK;
    export let size: number;

    let interactiveCluster;
    $: console.log("Changed vis type to:" + ops.visType)

</script>




<div>
    <Select size="sm" inline labelText="Visualization:" bind:selected={ops.visType}>
      {#each Object.keys(VisualisationType) as key, index}
        <SelectItem value={key}/>  
      {/each}
    </Select>

      <!-- {#if selectedVis.VisualisationType == VisualisationType.Composite}
      <Select size="sm" inline labelText="Action:" bind:selected={action}>
        <SelectItem value="Change representation" />
        <SelectItem value="Split" />
        <SelectItem value="Merge" />
      </Select>
      {/if}

      {#if visualizationSelected == VisualisationType.Composite && action == "Change representation"}
        <Select size="sm" inline labelText="Visualization type:" bind:selected={clusterVisualization}>
        {#each Object.keys(VisualisationType) as key, index}
          {#if key != VisualisationType.None}
            <SelectItem value={key}/>  
          {/if}
        {/each}
        </Select>
      {/if}

      {#if visualizationSelected == VisualisationType.Composite}
      <Checkbox labelText="Show cluster connections" bind:checked={showConnectors} />
      {/if} -->

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
      {#if ops.visType == VisualisationType.Implicit || ops.visType == VisualisationType.Matryoshka || ops.visType == VisualisationType.Pathline || ops.visType == VisualisationType.Spheres || ops.visType == VisualisationType.Spline}
        <Slider labelText="Radius" fullWidth min={0.01} max={0.3} step={0.01} bind:value={ops.radius} />
      {/if}
      {#if ops.visType == VisualisationType.Matryoshka || ops.visType == VisualisationType.Volume}
        <Slider labelText="Alpha" fullWidth min={0.05} max={1.0} step={0.05} bind:value={ops.alpha} />
      {/if}
      {#if ops.visType == VisualisationType.Hedgehog}
        <Slider labelText="Max distance" fullWidth min={0.0} max={0.5} step={0.01} bind:value={ops.hedgehogDistance} />
        <Checkbox labelText="Precise quills" bind:checked={ops.preciseQuills} />
      {/if}

      {#if ops.visType == VisualisationType.Volume}
        <Checkbox labelText="Abstractize volumes" bind:checked={ops.abstractVolumes} />

        <Slider labelText="Radius" fullWidth min={0.01} max={0.1} step={0.01} bind:value={ops.radius} />

        <!-- <Checkbox labelText="Use colormap" bind:checked={true} /> -->

        <Select labelText="Colormap" bind:selected={ops.volumeColormapChoice}>
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
        bind:interactiveCluster={interactiveCluster} 
        update={false}
      />
    {/if}
</div>