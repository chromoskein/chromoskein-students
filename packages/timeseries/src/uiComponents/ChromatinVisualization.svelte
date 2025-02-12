<script lang="ts">
  import { timestepsToPathlines } from "@chromoskein/components/utils";
  import { Volume, Pathline, Spline, Spheres, AbstractSpheres, Cones, Hedgehog, Implicit, Matryoshka } from "@chromoskein/components/visualisations";
  import { VisualisationType, type AllOptions } from "../types";
  import type { Chromosome } from "@chromoskein/components/types";
  import InteractiveCluster from "../visalizations/InteractiveCluster.svelte";
  import MatryoshkaClusters from "../visalizations/MatryoshkaClusters.svelte";

  let {
    chromosome,
    options = $bindable(),
  }: {
    chromosome: Chromosome;
    options: AllOptions;
  } = $props();
</script>

<div>
  {#if chromosome.visible}
    {#if options?.type === VisualisationType.Volume}
      <Volume {options} {...chromosome} />
    {:else if options?.type === VisualisationType.Pathline}
      <Pathline {options} {...chromosome} />
    {:else if options?.type === VisualisationType.Spline}
      <Spline {options} {...chromosome} />
    {:else if options?.type === VisualisationType.Spheres}
      <Spheres {options} {...chromosome} />
    {:else if options?.type === VisualisationType.Matryoshka}
      <!-- TODO! update this  -->
      <Matryoshka
        selectedTimestep={options.timestep}
        dataClustersGivenK={chromosome.clusterTree}
        dataTimesteps={chromosome.timesteps}
        dataPathlines={timestepsToPathlines(chromosome.timesteps)}
        blobAlpha={options.alpha}
        blobsRadius={options.radius}
        experimentalColors={false}
        matryoshkaBlobsVisible={options.matryoshkaBlobsVisible}
        outlines={false}
      />
    {:else if options?.type === VisualisationType.Implicit}
      <Implicit {options} {...chromosome} />
    {:else if options?.type === VisualisationType.AbstractSpheres}
      <AbstractSpheres {options} {...chromosome} />
    {:else if options?.type === VisualisationType.Cones}
      <Cones {options} {...chromosome} />
    {:else if options?.type === VisualisationType.Hedgehog}
      <Hedgehog {options} {...chromosome} />
    {:else if options?.type === VisualisationType.Composite}
      <InteractiveCluster
        dataClustersGivenK={chromosome.clusterTree}
        {options}
        pointsAtTimesteps={chromosome.timesteps}
        clustersUpdated={false}
        updateClustersUpdated={() => {}}
        bind:this={options.interactiveCluster}
      />
    {:else if options?.type === VisualisationType.Test}
      <MatryoshkaClusters
        selectedTimestep={options.timestep}
        dataClustersGivenK={chromosome.clusterTree}
        dataTimesteps={chromosome.timesteps}
        dataPathlines={timestepsToPathlines(chromosome.timesteps)}
        blobAlpha={options.alpha}
        blobsRadius={options.radius}
        experimentalColors={false}
        matryoshkaBlobsVisible={options.matryoshkaBlobsVisible}
        outlines={true}
      />
      {#if options?.secondaryVisualisation === VisualisationType.AbstractSpheres}
        <AbstractSpheres {options} {...chromosome} />
      {:else if options?.secondaryVisualisation === VisualisationType.Cones}
        <Cones {options} {...chromosome} />
      {:else if options?.secondaryVisualisation === VisualisationType.Hedgehog}
        <Hedgehog {options} {...chromosome} />
      {/if}
      <!-- TODO! -->
    {/if}
  {/if}
</div>
