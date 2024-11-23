<script context="module" lang="ts">
  export const colors: Array<vec3> = new Array(100).fill(undefined).map((i) => {
    return vec3.fromValues(Math.random(), Math.random(), Math.random());
  });
</script>

<script lang="ts">
  // @hmr:keep-all

  import { onMount, setContext } from "svelte";
  import { writable, type Writable } from "svelte/store";
  import * as Graphics from "@chromoskein/lib-graphics";
  import Viewport3D from "./viewports/Viewport3D.svelte";
  import { vec3 } from "gl-matrix";
  import "./styles/splitpanes.css";
  import { Pane, Splitpanes } from "svelte-splitpanes";

  import { loadTimesteps, normalizePointClouds, timestepsToPathlines, loadBitmap, clusterPathlines } from "./utils/main";

  import "carbon-components-svelte/css/g100.css";
  import { Header, SkipToContent, Accordion, AccordionItem, Select, SelectItem, Button, Checkbox } from "carbon-components-svelte";
  import { Slider } from "carbon-components-svelte";
  import { treeColor } from "./utils/treecolors";

  import "@carbon/charts/styles.css";
  import InteractiveCluster from "./visalizations/InteractiveCluster.svelte";
  import { defaultVisOptions, initializeChromosome, type VisOptions, type Chromosome } from "./utils/data-models";
  import ChromosomeItem from "./uiComponents/ChromosomeItem.svelte";
  import { loadNewPdbModels } from "./utils/data-parser";
  import ChromatinVisualization from "./uiComponents/ChromatinVisualization.svelte";
  import VisualizationOptions from "./uiComponents/VisualizationOptions.svelte";

  import workerUrl from './utils/clusteringWorker.ts?worker';
  import Viewport2D from "./viewports/Viewport2D.svelte";
  import LoaderModal from "./uiComponents/LoaderModal.svelte";

  const adapter: Writable<GPUAdapter | null> = writable(null);
  const device: Writable<GPUDevice | null> = writable(null);
  const graphicsLibrary: Writable<Graphics.GraphicsLibrary | null> = writable(null);

  const clusteringWorker = new workerUrl();

  clusteringWorker.onmessage = (event) => {
    console.log("Worker sent a message", event);
  };

  clusteringWorker.onerror = (error) => {
    console.error("Worker error:", error);
  };

  let viewport: Graphics.Viewport3D | null = null;

  let chromosomes: Chromosome[] = [];
  let chromosomeOptions: VisOptions[] = [];
  
  let pdbFiles: FileList;
  function loadFiles() {
    for (let i = 0; i < pdbFiles.length; i++) {
      const file = pdbFiles.item(i);
      file.text().then(pdbText => addChromosomes(loadNewPdbModels(pdbText)));
    }
  }

  function addChromosomes(models: Chromosome[]) {
    chromosomes = chromosomes.concat(models);
    let defaultOptions = [];
    models.forEach(element => {
      defaultOptions.push(defaultVisOptions())
    });
    chromosomeOptions = chromosomeOptions.concat(defaultOptions)
  }


  function foo() {
    console.log("Starting worker");
    clusteringWorker.postMessage("start");
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
    const dataPathlines = timestepsToPathlines(dataTimesteps);
    const staticDataClustersGivenK = await clusterPathlines(dataPathlines).slice(0, 16);

    let baseChromosome = initializeChromosome("Base", dataTimesteps);
    chromosomeOptions = [defaultVisOptions()]
    baseChromosome.clusters = staticDataClustersGivenK;
    treeColor(staticDataClustersGivenK);
    chromosomes = [baseChromosome]
    selectedChromosome = baseChromosome;
  });
  //#endregion Init

  // Set default colormap on viewport change
  $: if (viewport && viewport.scene) {
    loadBitmap("./colormaps/cool-warm-paraview.png").then((colormap) =>  viewport.scene.setColorMapFromBitmap(colormap));
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

  // Loader
  let loaderOpen: boolean = false;

  // Distance map
  let showDistanceMap = false;

  // Blobs
  let clusterVisualization = "AbstractSphere";
  let action = "Change representation";
  let clustersUpdated = false;
  let interactiveClusterRef: InteractiveCluster;

  //#endregion Configuration
</script>


<main>
  <div class="ui">
    {#if selectedChromosome && selectedChromosome.points.length > 1}
      <Slider fullWidth min={0} max={selectedChromosome.points.length - 1} bind:value={chromosomeOptions[selectedChromosomeId].timestep} />
    {/if}
  </div>

  <Splitpanes theme="chromoskein" horizontal={false}>
    {#if showDistanceMap}
      <Pane size={10}>
        {#if $adapter && $device && $graphicsLibrary && selectedChromosome}
          <Viewport2D
            points={selectedChromosome.points[chromosomeOptions[selectedChromosomeId].timestep]}
          /> 
        {/if}
      </Pane>
    {/if}
    <Pane size={75}>
      {#if $adapter && $device && $graphicsLibrary}
        <Viewport3D bind:viewport>
          {#if selectedChromosome}
            <ChromatinVisualization
              points={selectedChromosome.points}
              visible={selectedChromosome.visible}
              dataClustersGivenK={selectedChromosome.clusters}
              ops={chromosomeOptions[selectedChromosomeId]}
              bind:this={selectedChromosome.visualization}
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
      <div style="padding: 8px; color:white; overflow: auto; height: calc(90vh);">
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
                  bind:ops={chromosomeOptions[selectedChromosomeId]}
                  dataClustersGivenK={chromosomes[selectedChromosomeId].clusters}
                  size={chromosomes[selectedChromosomeId].points[0].length}
                />            
              {/if}
            {/key}  


            <Button on:click={() => { console.log("I am clicked!!!"); foo() }}> Click Me </Button>
          </AccordionItem>

          <AccordionItem title="Data Loading">
            
            <LoaderModal bind:open={loaderOpen} />
            <Button
              kind="secondary"
              size="field"
              on:click={() => loaderOpen = true}
            >  
              Load Files
            </Button>
            
            <Button
              kind="secondary"
              size="field"
              on:click={() => document.getElementById("file-input").click()}
            >  
              Load PDB File
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

<Header company="Masaryk University" platformName="VisitLab" isSideNavOpen={true}>
  <svelte:fragment slot="skip-to-content">
    <SkipToContent />
  </svelte:fragment>
</Header>

<style>
  main {
    height: calc(100vh);
    padding-top: 3rem;
  }

  .ui {
    position: fixed;
    z-index: 100;

    color: white;
    background: black;

    bottom: 0px;
    left: 0px;

    width: 100%;

    padding: 8px;
  }

  #file-input {
    display: none;
  }
</style>
