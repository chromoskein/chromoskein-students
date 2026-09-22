<script lang="ts">
  // @hmr:keep-all

  import { onMount, setContext, tick } from "svelte";
  import { writable, type Writable } from "svelte/store";
  import * as Graphics from "@chromoskein/lib-graphics";
  import Viewport3D from "./viewports/Viewport3D.svelte";
  import "./styles/splitpanes.css";
  import { Pane, Splitpanes } from "svelte-splitpanes";

  import { loadTimesteps, normalizePointClouds, loadBitmap, type ClusterNode } from "./utils/main";

  import "carbon-components-svelte/css/all.css";
  import { Header, SkipToContent, Accordion, AccordionItem, Select, SelectItem, Button, Checkbox, HeaderUtilities, Theme, Toggle } from "carbon-components-svelte";
  import { Slider } from "carbon-components-svelte";
  import { colorBrewerColors, colorHierarchy, iWantHueColors, treeColor } from "./utils/treecolors";

  import { defaultVisOptions, initializeChromosome, type VisOptions, type Chromosome, getEmptyClustering, getClustering } from "./utils/data-models";
  import ChromosomeItem from "./uiComponents/ChromosomeItem.svelte";
  import ChromatinVisualization from "./uiComponents/ChromatinVisualization.svelte";
  import VisualizationOptions from "./uiComponents/VisualizationOptions.svelte";

  import workerUrl from './utils/clusteringWorker.ts?worker';
  import Viewport2D from "./viewports/Viewport2D.svelte";
  import LoaderModal from "./uiComponents/LoaderModal.svelte";
  import InteractiveCluster from "./visalizations/InteractiveCluster.svelte";
  import type { CarbonTheme } from "carbon-components-svelte/src/Theme/Theme.svelte";
    import type { ChromatinModel } from "./dataloader/models";
    import { parsePdb } from "./dataloader/pdb";
    import { vec3 } from "gl-matrix";


  const adapter: Writable<GPUAdapter | null> = writable(null);
  const device: Writable<GPUDevice | null> = writable(null);
  const graphicsLibrary: Writable<Graphics.GraphicsLibrary | null> = writable(null);

  let appReady = $state(false)
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
      chromosomes[selectedChromosomeId].clusters = event.data;
    }
  };

  clusteringWorker.onerror = (event: Event) => {
    console.log("Worker error:", event);
  }

  let viewport: Graphics.Viewport3D | null = $state(null);

  let chromosomes: Chromosome[] = $state([]);
  let chromosomeOptions: VisOptions[] = $state([defaultVisOptions()]);
  
  function addChromosomes(models: Chromosome[]) {
    chromosomes = chromosomes.concat(models);
    let defaultOptions: VisOptions[]= [];
    models.forEach(element => {
      defaultOptions.push(defaultVisOptions())
    });
    chromosomeOptions = chromosomeOptions.concat(defaultOptions)
    console.log("Adding chromosome")
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
    chromosomes[selectedChromosomeId].points = normalizePointClouds([chromosomes[selectedChromosomeId].points[0].slice(clusters[1][0].from, clusters[1][0].to)]);
    chromosomes[selectedChromosomeId].clusters = clusters;
    chromosomeOptions[selectedChromosomeId].blobsAmount = 1;
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
    const pdbFile = await (await fetch("./pdb/GSM2219497_Cell_1_genome_structure_model.pdb")).text()
    let id = 0;

    let chromatinModel: ChromatinModel = parsePdb(pdbFile);
    let points = chromatinModel.bins.map((v) => vec3.fromValues(v.x, v.y, v.z))

    let loadedData: any[] = [];
    chromatinModel.ranges.forEach((model, index) => {
        const name = model.name + " " + (index + 1);
        loadedData.push({
            id: id++,
            name: name,
            from: model.from,
            to: model.to
        })
    });

    let filteredData = [loadedData[1], loadedData[2], loadedData[3], loadedData[7]]//, loadedData[9]]

    let modelPoints = filteredData.map((item, index) => points.slice(item.from, item.to + 1));

    modelPoints = normalizePointClouds(modelPoints);
    

    let concatPoints: vec3[] = modelPoints.flat();
    // Update the from and to indexes of data based on filtering done in selection
    let indexStart = 0;
    for (let i = 0; i < filteredData.length; i++) {
        filteredData[i].from = indexStart;
        filteredData[i].to = indexStart + modelPoints[i].length - 1;
        indexStart = indexStart + modelPoints[i].length;
    }

    let chromosome = initializeChromosome("Chromosome", [concatPoints]);
    let clusters = [[], [getEmptyClustering(points.length - 1)]]
    // Dont create a second hierarchy level if only a single model is selected
    if (filteredData.length > 1) {
        let modelClusterIndices: number[] = [];
        let modelClusters: ClusterNode[] = [];
        filteredData.forEach((model, index) => {
            modelClusters.push(getClustering(model.from, model.to, 2, index));
            modelClusterIndices.push(index);
        });
        clusters[1][0].children = modelClusterIndices;
        clusters.push(modelClusters);
    }

    //const filenames: string[] = new Array(600).fill(null).map((v, i) => "./timeseries/timestep_" + (i + 1).toString() + ".XYZ");
    //const timesteps = await loadTimesteps(filenames);
    //const dataTimesteps = normalizePointClouds(timesteps);
    
    //let baseChromosome = initializeChromosome("Base", dataTimesteps);
    //chromosomeOptions = [defaultVisOptions()]
    chromosome.clusters = clusters;
    chromosomes = [chromosome];
    //chromosomes = [baseChromosome]
    //clusteringWorker.postMessage(chromosomes[selectedChromosomeId].points.map((point) => [...point]));
    await tick()
    appReady = true
  });

  // Set default colormap on viewport change
  $effect(() => { if (viewport && viewport.scene) {
    loadBitmap("./colormaps/cool-warm-paraview.png").then((colormap) =>  viewport?.scene?.setColorMapFromBitmap(colormap));
  }});

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
    {#if chromosomes[selectedChromosomeId] && chromosomes[selectedChromosomeId].points.length > 1}
      <Slider fullWidth min={0} max={chromosomes[selectedChromosomeId].points.length - 1} bind:value={chromosomeOptions[selectedChromosomeId].timestep} />
    {/if}
  </div>

  <Splitpanes theme="chromoskein" horizontal={false} style="padding-bottom:5%">
    {#if showDistanceMap}
      <Pane size={10}>
        {#if $adapter && $device && $graphicsLibrary && chromosomes[selectedChromosomeId]}
          <Viewport2D clearColor={clearColor}
            points={chromosomes[selectedChromosomeId].points[chromosomeOptions[selectedChromosomeId].timestep]}
          /> 
        {/if}
      </Pane>
    {/if}
    <Pane size={75}>
      {#if $adapter && $device && $graphicsLibrary && appReady}
        <Viewport3D bind:viewport clearColor={clearColor}>
          {#each chromosomes as chromosome, i}
              <ChromatinVisualization
                points={chromosome.points}
                visible={chromosome.visible}
                dataClustersGivenK={chromosome.clusters}
                bind:ops={chromosomeOptions[i]}
              />
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

            {#if chromosomes[selectedChromosomeId]}
              <VisualizationOptions
                viewport={viewport}
                interactiveCluster={chromosomeOptions[selectedChromosomeId].interactiveCluster}
                bind:ops={chromosomeOptions[selectedChromosomeId]}
                dataClustersGivenK={chromosomes[selectedChromosomeId].clusters}
                size={chromosomes[selectedChromosomeId].points[0].length}
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
            <Button size="small" on:click={() => { clusteringWorker.postMessage(chromosomes[selectedChromosomeId].points.map((point) => [...point])) }}> Cluster </Button>

            <Select size="sm" labelText="Color scheme:" on:update={(e) => {
                switch(e.detail as number) {
                  case 0:
                    colorHierarchy(chromosomes[selectedChromosomeId].clusters, treeColor);
                    break;
                  case 1:
                    colorHierarchy(chromosomes[selectedChromosomeId].clusters, colorBrewerColors);
                    break;
                  default:
                    colorHierarchy(chromosomes[selectedChromosomeId].clusters, iWantHueColors);
                    break;
                }
              }}>
              <SelectItem text="Hierarchical" value={0} />
              <SelectItem text="Color Brewer" value={1} />
              <SelectItem text="iWantHue" value={2} />
            </Select>

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
