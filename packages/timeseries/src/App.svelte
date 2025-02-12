<script lang="ts">
  // @hmr:keep-all

  import { onMount } from "svelte";
  import "./styles/splitpanes.css";
  import { Pane, Splitpanes } from "svelte-splitpanes";

  import { loadTimesteps, normalizePointClouds, loadBitmap, type ClusterNode } from "./utils/main";

  import "carbon-components-svelte/css/all.css";
  import { Header, SkipToContent, Accordion, AccordionItem, Select, SelectItem, Button, Checkbox, HeaderUtilities, Theme, Toggle } from "carbon-components-svelte";
  import { Slider } from "carbon-components-svelte";
  import { treeColor } from "./utils/treecolors";

  import ChromosomeItem from "./uiComponents/ChromosomeItem.svelte";
  import ChromatinVisualization from "./uiComponents/ChromatinVisualization.svelte";
  import VisualizationOptionsMenu from "./uiComponents/VisualizationOptions.svelte";

  import workerUrl from './utils/clusteringWorker.ts?worker';
  import Viewport2D from "./viewports/Viewport2D.svelte";
  import LoaderModal from "./uiComponents/LoaderModal.svelte";
  import InteractiveCluster from "./visalizations/InteractiveCluster.svelte";
  import type { CarbonTheme } from "carbon-components-svelte/src/Theme/Theme.svelte";

  import { GraphicsContext, Viewport } from "@chromoskein/components/base";
  import type { Chromosome } from "@chromoskein/components/types";
  import { defaultVisualisationOptions, VisualisationType, type AllOptions } from "./types";
  import { initializeChromosome } from "@chromoskein/components/utils";

  let theme: CarbonTheme = $state("white");
  let clearColor = $state({r: 1.0, g: 1.0,  b: 1.0,  a: 1.0});

  function changeTheme(event: CustomEvent) {
    const toggled = event.detail.toggled;

    if (toggled) {
      theme = "g90";
      clearColor = {r: 0.0, g: 0.0,  b: 0.0,  a: 1.0};
    } else {
      theme = "white";
      clearColor = {r: 1.0, g: 1.0,  b: 1.0,  a: 1.0};
    }
  }

  const clusteringWorker: Worker = new workerUrl();
  clusteringWorker.onmessage = (event: MessageEvent) => {
    if (chromosomes[selectedChromosomeId]) {
      chromosomes[selectedChromosomeId].clusterTree = event.data;
    }
  };

  clusteringWorker.onerror = (event: Event) => {
    console.log("Worker error:", event);
  }

  let chromosomes: Chromosome[] = $state([]);
  let chromosomeOptions: AllOptions[] = $state([defaultVisualisationOptions(VisualisationType.Pathline)]);
  
  function addChromosomes(models: Chromosome[]) {
    chromosomes = chromosomes.concat(models);
    let defaultOptions: AllOptions[] = [];
    models.forEach(element => {
      defaultOptions.push(defaultVisualisationOptions(VisualisationType.Pathline))
    });
    chromosomeOptions = chromosomeOptions.concat(defaultOptions)
  }

  async function loadClustering(event: Event) {
    const input = event.target as HTMLInputElement; 
    const json = input.files?.item(0);
    if (!json) return;
    let result: ClusterNode[][] = JSON.parse(await json.text());
    const rootColor = result[1][0].color;
    if (rootColor[0] == 1.0 && rootColor[1] == 1.0 && rootColor[2] == 1.0) {
      treeColor(result);
    }
    setNewClusters(result);
  }

  function setNewClusters(clusters: ClusterNode[][]) {
    chromosomes[selectedChromosomeId].timesteps = normalizePointClouds([chromosomes[selectedChromosomeId].timesteps[0].slice(clusters[1][0].from, clusters[1][0].to)]);
    chromosomes[selectedChromosomeId].clusterTree = clusters;
    chromosomeOptions[selectedChromosomeId].blobsAmount = 1;
  }

  //#endregion Data

  //#region Init

  let defaultColormap = $state<ImageBitmap>();

  onMount(async () => {
    const filenames: string[] = new Array(600).fill(null).map((v, i) => "./timeseries/timestep_" + (i + 1).toString() + ".XYZ");
    const timesteps = await loadTimesteps(filenames);
    const dataTimesteps = normalizePointClouds(timesteps);

    let baseChromosome = initializeChromosome("Base", dataTimesteps);
    chromosomeOptions = [defaultVisualisationOptions(VisualisationType.Pathline)]
    chromosomes = [baseChromosome]
    clusteringWorker.postMessage(chromosomes[selectedChromosomeId].timesteps.map((point) => [...point]));

    loadBitmap("./colormaps/cool-warm-paraview.png").then((colormap) =>  defaultColormap = colormap);
  });

  let selectedId: number = $state(0);
  let selectedChromosomeId = $state(0);
  function onSelectedChromosomeChanged() {
    for (let i = 0; i < chromosomes.length; i++) {
      if (chromosomes[i].id == selectedId) {
        selectedChromosomeId = i;
        return;
      }
    }
  }

  let selectedInteractiveCluster: InteractiveCluster | null = $state(null);

  // Loader
  let loaderOpen: boolean = $state(false);

  // Distance map
  let showDistanceMap = $state(false);

  //#endregion Configuration
</script>


<main>
  <Theme bind:theme />
  
  <div class="ui">
    {#if chromosomes[selectedChromosomeId] && chromosomes[selectedChromosomeId].timesteps.length > 1}
      <Slider fullWidth min={0} max={chromosomes[selectedChromosomeId].timesteps.length - 1} bind:value={chromosomeOptions[selectedChromosomeId].timestep} />
    {/if}
  </div>

  <Splitpanes theme="chromoskein" horizontal={false} style="padding-bottom:5%">
    <GraphicsContext>
    {#if showDistanceMap}
      <Pane size={10}>        
        {#if chromosomes[selectedChromosomeId]}
        <!-- TODO: move 2d viewports to the library -->
        <Viewport2D clearColor={clearColor}
            points={chromosomes[selectedChromosomeId].timesteps[chromosomeOptions[selectedChromosomeId].timestep]}
          /> 
        {/if}
      </Pane>
    {/if}
    <Pane size={75}>
        <Viewport {clearColor} colormap={defaultColormap}>
          {#each chromosomes as chromosome, i}
             <ChromatinVisualization {chromosome} bind:options={chromosomeOptions[i]} />
          {/each}
        </Viewport>
      </Pane>
    </GraphicsContext>
    <Pane size={25}>
      <div style="padding: 8px; overflow: auto; height: calc(90vh);">
        <Accordion>
          <AccordionItem open title="Visualisation Parameters">
            <Select size="sm" inline labelText="Model" bind:selected={selectedId} on:change={onSelectedChromosomeChanged}>
              {#each chromosomes as chromosome, i}
                <SelectItem value={chromosome.id} text={chromosome.name}/>
              {/each}
            </Select>

            <Checkbox labelText="Show Distance Map" bind:checked={showDistanceMap} />

            {#if chromosomes[selectedChromosomeId]}
              <VisualizationOptionsMenu
                bind:options={chromosomeOptions[selectedChromosomeId]}
                clusterTree={chromosomes[selectedChromosomeId].clusterTree}
                size={chromosomes[selectedChromosomeId].timesteps[0].length}
              />            
            {/if}

            <input type="file"  accept=".json" id="clustering-input" onchange={(event) => loadClustering(event)}/>
            <Button
                kind="secondary"
                size="small"
                on:click={() => { document.getElementById("clustering-input")?.click()}}
            >  
                Upload Clusters
            </Button>
            <Button size="small" on:click={() => { clusteringWorker.postMessage(chromosomes[selectedChromosomeId].timesteps.map((point) => [...point])) }}> Cluster </Button>
          </AccordionItem>

          <AccordionItem title="Data Loading">
            
            <LoaderModal bind:open={loaderOpen} onload={addChromosomes} />
            <Button
              kind="secondary"
              size="field"
              on:click={() => loaderOpen = true}
            >  
              Load Files
            </Button>
            
            {#each chromosomes as chromosome, i}
              <ChromosomeItem bind:visible={chromosome.visible} name={chromosome.name} />
            {/each}
          </AccordionItem>
        </Accordion>
      </div>
      
    </Pane>
  </Splitpanes>
</main>

<Header company="Anonymous" platformName="---" isSideNavOpen={true}>
  <svelte:fragment slot="skip-to-content">
    <SkipToContent />
  </svelte:fragment>
  <div style="position: fixed; right: 120px;">
    <HeaderUtilities>
      <Toggle labelText="Include" hideLabel on:toggle={(event) => changeTheme(event) }>
        <span slot="labelA" style="color: white">Light theme</span>
        <span slot="labelB" style="color: white">Dark theme</span>
      </Toggle>
    </HeaderUtilities>
  </div>
</Header>

<style>
  main {
    height: calc(100vh);
    padding-top: 3rem;
  }

  .ui {
    position: fixed;
    z-index: 100;

    bottom: 0px;
    left: 0px;

    width: 100%;

    padding: 8px;
  }

  #clustering-input {
    display: none;
  }
</style>
