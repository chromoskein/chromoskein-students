<script lang="ts">
  // @hmr:keep-all

  import { onMount, setContext } from "svelte";
  import { writable, type Writable } from "svelte/store";
  import * as Graphics from "@chromoskein/lib-graphics";
  import Viewport3D from "./viewports/Viewport3D.svelte";
  import "./styles/splitpanes.css";
  import { Pane, Splitpanes } from "svelte-splitpanes";

  import { loadTimesteps, normalizePointClouds, loadBitmap, type ClusterNode } from "./utils/main";

  import "carbon-components-svelte/css/all.css";
  import { Header, SkipToContent, Accordion, AccordionItem, Select, SelectItem, Button, Checkbox, HeaderUtilities, Theme, Toggle } from "carbon-components-svelte";
  import { Slider } from "carbon-components-svelte";
  import { treeColor } from "./utils/treecolors";

  import { defaultVisOptions, initializeChromosome, type VisOptions, type Chromosome } from "./utils/data-models";
  import ChromosomeItem from "./uiComponents/ChromosomeItem.svelte";
  import ChromatinVisualization from "./uiComponents/ChromatinVisualization.svelte";
  import VisualizationOptions from "./uiComponents/VisualizationOptions.svelte";

  import workerUrl from './utils/clusteringWorker.ts?worker';
  import Viewport2D from "./viewports/Viewport2D.svelte";
  import LoaderModal from "./uiComponents/LoaderModal.svelte";
  import InteractiveCluster from "./visalizations/InteractiveCluster.svelte";
  import type { CarbonTheme } from "carbon-components-svelte/src/Theme/Theme.svelte";

  const adapter: Writable<GPUAdapter | null> = writable(null);
  const device: Writable<GPUDevice | null> = writable(null);
  const graphicsLibrary: Writable<Graphics.GraphicsLibrary | null> = writable(null);


  let theme: CarbonTheme = "white";
  let clearColor = {r: 1.0, g: 1.0,  b: 1.0,  a: 1.0};

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
    if (selectedChromosome) {
      selectedChromosome.clusters = event.data;
      chromosomes[selectedChromosomeId].clusters = event.data;
    }
  };

  clusteringWorker.onerror = (event: Event) => {
    console.log("Worker error:", event);
  }

  let viewport: Graphics.Viewport3D | null = null;
  let loadedChromosomes: Chromosome[] = [];


  let chromosomes: Chromosome[] = [];
  let chromosomeOptions: VisOptions[] = [];
  
  function addChromosomes(models: Chromosome[]) {
    chromosomes = chromosomes.concat(models);
    let defaultOptions: VisOptions[]= [];
    models.forEach(element => {
      defaultOptions.push(defaultVisOptions())
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
    if (selectedChromosome) {
      selectedChromosome.points = normalizePointClouds([selectedChromosome.points[0].slice(clusters[1][0].from, clusters[1][0].to)]);
      selectedChromosome.clusters = clusters;
      chromosomes[selectedChromosomeId].clusters = clusters;
      chromosomeOptions[selectedChromosomeId].blobsAmount = 1;
    }
  }

  //#endregion Data

  //#region Init
  setContext("adapter", adapter);
  setContext("device", device);
  setContext("graphicsLibrary", graphicsLibrary);

  async function getGPU() {
    $adapter = await navigator.gpu.requestAdapter();

    if ($adapter) {
      $device = await $adapter.requestDevice();
      $graphicsLibrary = new Graphics.GraphicsLibrary($adapter, $device);
    }
  }

  onMount(async () => {
    await getGPU();
    const filenames: string[] = new Array(600).fill(null).map((v, i) => "./timeseries/timestep_" + (i + 1).toString() + ".XYZ");
    const timesteps = await loadTimesteps(filenames);
    const dataTimesteps = normalizePointClouds(timesteps);

    let baseChromosome = initializeChromosome("Base", dataTimesteps);
    chromosomeOptions = [defaultVisOptions()]
    chromosomes = [baseChromosome]
    selectedChromosome = baseChromosome;
    clusteringWorker.postMessage(selectedChromosome.points);
  });

  // Set default colormap on viewport change
  $: if (viewport && viewport.scene) {
    loadBitmap("./colormaps/cool-warm-paraview.png").then((colormap) =>  viewport?.scene?.setColorMapFromBitmap(colormap));
  }

  let selectedId: number = 0;
  let selectedChromosome: Chromosome;
  let selectedChromosomeId = 0;
  function onSelectedChromosomeChanged() {
    for (let i = 0; i < chromosomes.length; i++) {
      if (chromosomes[i].id == selectedId) {
        selectedChromosome = chromosomes[i];
        selectedChromosomeId = i;
        return;
      }
    }
  }


  let selectedInteractiveCluster: InteractiveCluster | null = null;


  // Loader
  let loaderOpen: boolean = false;

  // Distance map
  let showDistanceMap = false;


  //#endregion Configuration
</script>


<main>
  <Theme bind:theme />
  
  <div class="ui">
    {#if selectedChromosome && selectedChromosome.points.length > 1}
      <Slider fullWidth min={0} max={selectedChromosome.points.length - 1} bind:value={chromosomeOptions[selectedChromosomeId].timestep} />
    {/if}
  </div>

  <Splitpanes theme="chromoskein" horizontal={false} style="padding-bottom:5%">
    {#if showDistanceMap}
      <Pane size={10}>
        {#if $adapter && $device && $graphicsLibrary && selectedChromosome}
          <Viewport2D clearColor={clearColor}
            points={selectedChromosome.points[chromosomeOptions[selectedChromosomeId].timestep]}
          /> 
        {/if}
      </Pane>
    {/if}
    <Pane size={75}>
      {#if $adapter && $device && $graphicsLibrary}
        <Viewport3D bind:viewport clearColor={clearColor}>
          {#if selectedChromosome}
            <ChromatinVisualization
              points={selectedChromosome.points}
              visible={selectedChromosome.visible}
              dataClustersGivenK={selectedChromosome.clusters}
              ops={chromosomeOptions[selectedChromosomeId]}
              bind:this={selectedChromosome.visualization}
              bind:interactiveCluster={selectedInteractiveCluster}
            />
          {/if}

          {#each chromosomes as chromosome, i}
            {#if i != selectedChromosomeId}
              <ChromatinVisualization
                points={chromosome.points}
                visible={chromosome.visible}
                dataClustersGivenK={chromosome.clusters}
                ops={chromosomeOptions[i]}
                bind:this={chromosome.visualization}
              />
            {/if}
          {/each}

        </Viewport3D>
      {/if}
    </Pane>
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

            {#key selectedChromosomeId}
              {#if chromosomeOptions && chromosomeOptions[selectedChromosomeId]}
                <VisualizationOptions
                  viewport={viewport}
                  interactiveCluster={selectedInteractiveCluster}
                  bind:ops={chromosomeOptions[selectedChromosomeId]}
                  dataClustersGivenK={chromosomes[selectedChromosomeId].clusters}
                  size={chromosomes[selectedChromosomeId].points[0].length}
                />            
              {/if}
            {/key}  


            <input type="file"  accept=".json" id="clustering-input" on:change={(event) => loadClustering(event)}/>
            <Button
                kind="secondary"
                size="small"
                on:click={() => { document.getElementById("clustering-input")?.click()}}
            >  
                Upload Clusters
            </Button>
            <Button size="small" on:click={() => { clusteringWorker.postMessage(selectedChromosome.points) }}> Cluster </Button>
          </AccordionItem>

          <AccordionItem title="Data Loading">
            
            <LoaderModal bind:outputChromosomes={loadedChromosomes} bind:open={loaderOpen} />
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
