<script context="module" lang="ts">
  export const colors: Array<vec3> = new Array(100).fill(undefined).map((i) => {
    return vec3.fromValues(Math.random(), Math.random(), Math.random());
  });
</script>

<script lang="ts">
  // @hmr:keep-all

  import { onMount, setContext } from "svelte";
  import { writable, type Writable } from "svelte/store";
  import * as Graphics from "lib-graphics";
  import Viewport3D from "./viewports/Viewport3D.svelte";
  import { vec3 } from "gl-matrix";
  import "./styles/splitpanes.css";
  import { Pane, Splitpanes } from "svelte-splitpanes";

  import { loadTimesteps, normalizePointClouds, timestepsToPathlines, loadBitmap, clusterTimestep, clusterPathlines, blobFromPoints, VisualisationType } from "./utils/main";
  import type { ClusterBlob, ClusterNode } from "./utils/main";

  import "carbon-components-svelte/css/g100.css";
  import { Header, SkipToContent, Checkbox, Accordion, AccordionItem, Select, SelectItem, Button } from "carbon-components-svelte";
  import { Slider } from "carbon-components-svelte";
  import TimeVolume from "./objects/TimeVolume.svelte";
  import SignedDistanceGrid from "./objects/SignedDistanceGrid.svelte";
  import { treeColor } from "./utils/treecolors";
  import Sphere from "./objects/Sphere.svelte";
  import Spline from "./objects/Spline.svelte";

  import "@carbon/charts/styles.css";
  import MatryoshkaClusters from "./visalizations/MatryoshkaClusters.svelte";
  import Hedgehog from "./objects/Hedgehog.svelte";
  import InteractiveCluster from "./visalizations/InteractiveCluster.svelte";
  import ContinuousTube from "./objects/ContinuousTube.svelte";
  import { initializeChromosome, type Chromosome } from "./utils/data-models";
  import ChromosomeItem from "./uiComponents/ChromosomeItem.svelte";
  import Dendrogram from "./uiComponents/Dendrogram.svelte";
  import PcaCone from "./objects/PCACone.svelte";
  import { loadNewPdbModels } from "./utils/data-parser";
  import ChromatinVisualization from "./uiComponents/ChromatinVisualization.svelte";

  const adapter: Writable<GPUAdapter | null> = writable(null);
  const device: Writable<GPUDevice | null> = writable(null);
  const graphicsLibrary: Writable<Graphics.GraphicsLibrary | null> = writable(null);

  let viewport: Graphics.Viewport3D | null = null;

  let chromosomes: Chromosome[] = [];

  
  let pdbFiles;
  function loadFiles() {
		for (const file of pdbFiles) {
      file.text().then(pdbText => addChromosomes(loadNewPdbModels(pdbText)));
		}
  }

  function addChromosomes(models: Chromosome[]) {
    chromosomes = chromosomes.concat(models);
  }

  //#region Data

  // Repesents an array of all points for all timesteps in format [timestep][point]
  let dataTimesteps: vec3[][] = null;  

  // The volume and composite visualizations do not work for time-sensitive clustering so it turns off
  $: if (visualizationSelected == "Volume" || visualizationSelected == "Composite") {
    timestepClustering = false;
  }
  
  $: if (timestepClustering) {
    dataClustersGivenK = clusterTimestep(dataTimesteps[selectedTimestep]).slice(0, 16);
  }

  $: if (!timestepClustering) {
    dataClustersGivenK = staticDataClustersGivenK;
  }

  // Represents an array of all points for all timesteps in format [point][timestep]
  // aka each inner array contains all positions of a point all timesteps
  $: dataPathlines = dataTimesteps && timestepsToPathlines(dataTimesteps);

  // Objects which contain the calculated clusters
  let timestepClustering = false;
  let staticDataClustersGivenK: ClusterNode[][] | null = null;
  let dataClustersGivenK: ClusterNode[][] | null = null;

  $: dataClustersGivenK && treeColor(dataClustersGivenK);

  // Splits data pathlines based on clusters
  // Format [cluster][point][timestep]
  let dataClusteredPathlines: vec3[][][] | null = null;
  $: if (dataClustersGivenK && dataClustersGivenK[blobsAmount] && dataPathlines) {
    const clusters = dataClustersGivenK[blobsAmount];

    dataClusteredPathlines = [];
    for (const [clusterIndex, cluster] of clusters.entries()) {
      dataClusteredPathlines[clusterIndex] = dataPathlines.slice(cluster.from, cluster.to + 1);
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
    dataTimesteps = normalizePointClouds(timesteps);
    dataPathlines = timestepsToPathlines(dataTimesteps);
    staticDataClustersGivenK = await clusterPathlines(dataPathlines);
    staticDataClustersGivenK = staticDataClustersGivenK.slice(0, 16);

    let baseChromosome = initializeChromosome("Base", dataTimesteps);
    baseChromosome.clusters = staticDataClustersGivenK;
    chromosomes = [baseChromosome]
    selectedChromosome = baseChromosome;
    dataClustersGivenK = staticDataClustersGivenK;
    treeColor(staticDataClustersGivenK);
  });
  //#endregion Init

  // [timestep][blob]
  let blobs: ClusterBlob[][] = [];

  // Process the clustered pathlines [cluster][point][timestep]
  // into normalized blobs in format [timestep][blob]
  $: if (dataClusteredPathlines && blobsAmount) {
    // Allocate new ones
    blobs = [];
    for (let timestep = 0; timestep < dataTimesteps.length; timestep++) {
      let blobsPointsAtTimestep: {
        normalizedPoints: vec3[];
        center: vec3;
        scale: number;
      }[] = [];
      for (const [index, clusteredPathline] of dataClusteredPathlines.entries()) {
        const points = clusteredPathline.map((pathline) => pathline[timestep]);

        blobsPointsAtTimestep.push(blobFromPoints(points));
      }

      blobs.push(blobsPointsAtTimestep);
    }
  }

  $: (async () => {
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
    volumeColormap = await loadBitmap(path);
  })();

  $: if (volumeColormap && viewport != null && viewport.scene != null) {
    viewport.scene.setColorMapFromBitmap(volumeColormap);
  }

  let selectedId: number = 0;
  let selectedChromosome: Chromosome;
  function onSelectedChromosomeChanged() {
    for (let chromosome of chromosomes) {
      if (chromosome.id == selectedId) {
        selectedChromosome = chromosome;
        return;
      }
    }
  }

  //#region Configuration
  // Volume
  let abstractVolumes = false;
  let volumeTransparency = 0.15;
  let volumeRadius = 0.03;
  let volumeColormapChoice = "Cool Warm";
  let volumeColormap: ImageBitmap | null = null;
  let volumeFunction = 0;
  let volumeTimeRange = [0, 599];
  let volumeUseColormap = true;

  // Blobs
  let blobsVisible = true;
  let blobsRadius = 0.03;
  let blobsAmount: number = 1;
  let blobsColored = true;
  let blobAlpha = 0.4;
  let experimentalColors = false;

  let visualizationSelected = VisualisationType.Pathline;
  let showConnectors = false;
  let selectedTimestep = 0; 

  let matryoshkaBlobsVisible:boolean[] = [false, true, false, true, false, false, false, false, false, false, false, false, false, false, false];

  let preciseQuills: boolean = false;
  let maxDistance = 1.0;

  let clusterVisualization = "AbstractSphere";
  let action = "Change representation";
  let clustersUpdated = false;
  let interactiveClusterRef: InteractiveCluster;

  function updateClustersUpdated(newClustersUpdated) {
    clustersUpdated = newClustersUpdated;
  }

  //#endregion Configuration
</script>


<main>
  <div class="ui">
    {#if dataTimesteps}
      <Slider fullWidth min={0} max={dataTimesteps.length - 1} bind:value={selectedTimestep} />
    {/if}
  </div>

  <Splitpanes theme="chromoskein" horizontal={false}>
    <Pane size={75}>
      {#if $adapter && $device && $graphicsLibrary && dataTimesteps && dataTimesteps.length > volumeTimeRange[1]}
        <Viewport3D bind:viewport>
          <!--
            "Empty" Sphere is put here because there must be at least one object in scene else undefined behavior starts 
            for reasons completely unknown to me
          -->
          <Sphere
            radius={0}
            center={[0.0, 0.0, 0.0]}
            color={[0.0, 0.0, 0.0, 0.0]} 
          />
          {#if visualizationSelected == VisualisationType.Volume}
            {#each dataClustersGivenK[blobsAmount] as cluster, _}
              <TimeVolume
                points={dataTimesteps.map(sequence => sequence.slice(cluster.from, cluster.to + 1))}
                transparency={volumeTransparency}
                radius={volumeRadius}
                colormap={volumeColormap}
                usecolormap={volumeUseColormap}
                func={volumeFunction}
                abstract={abstractVolumes}
                color={cluster.color.rgb}
              />
            {/each}
          {/if}

          {#each chromosomes as chromosome, i}
              <ChromatinVisualization
                points={chromosome.points}
                visible={chromosome.visible}
                options={chromosome.options}
                dataClustersGivenK={chromosome.clusters}
                bind:this={chromosome.visualization}
              />
          {/each}

          <!-- {#if visualizationSelected == VisualisationType.Spline && dataClustersGivenK && dataClustersGivenK[blobsAmount]}
            {#each dataClustersGivenK[blobsAmount] as cluster, _}
              <Spline
                points={dataTimesteps[selectedTimestep].slice(cluster.from, cluster.to + 1)}
                radius={blobsRadius}
                color={blobsColored ? vec3.fromValues(cluster.color.rgb[0], cluster.color.rgb[1], cluster.color.rgb[2]) : [1.0, 1.0, 1.0]}
                multicolored={false}
              />
              {/each}
          {/if}

          {#if visualizationSelected == VisualisationType.Spheres && dataClustersGivenK && dataClustersGivenK[blobsAmount]}
            {#each dataClustersGivenK[blobsAmount] as cluster, _}
              {#each dataTimesteps[selectedTimestep].slice(cluster.from, cluster.to + 1) as point, _}
                <Sphere
                  radius={blobsRadius}
                  center={point}
                  color={blobsColored ? [cluster.color.rgb[0], cluster.color.rgb[1], cluster.color.rgb[2], 1.0] : [1.0, 1.0, 1.0, 1.0]} 
                />
              {/each}
            {/each}
          {/if}

          {#if visualizationSelected == VisualisationType.Matryoshka}
            <MatryoshkaClusters
              selectedTimestep={selectedTimestep}
              dataClustersGivenK={dataClustersGivenK}
              dataTimesteps={dataTimesteps}
              dataPathlines={dataPathlines}
              blobAlpha={blobAlpha}
              blobsRadius={blobsRadius}
              experimentalColors={experimentalColors}
              matryoshkaBlobsVisible={matryoshkaBlobsVisible} 
            />
          {/if}

          {#if visualizationSelected == VisualisationType.Composite}
            <InteractiveCluster
              dataClustersGivenK={dataClustersGivenK}
              pointsAtTimesteps={dataTimesteps}
              selectedTimestep={selectedTimestep}
              clusterVisualization={clusterVisualization}
              showConnections={showConnectors}
              clustersUpdated={clustersUpdated}
              updateClustersUpdated={updateClustersUpdated}
              action={action}
              bind:this={interactiveClusterRef}
            />
          {/if}

          {#if blobs[selectedTimestep] && visualizationSelected == VisualisationType.Implicit}
            {#each blobs[selectedTimestep] as blob, i}
              <SignedDistanceGrid
                points={blob.normalizedPoints}
                translate={blob.center}
                scale={blob.scale}
                radius={blobsRadius}
                visible={blobsVisible}
                color={blobsColored ? dataClustersGivenK[blobsAmount][i].color.rgb : vec3.fromValues(1.0, 1.0, 1.0)}
                outline={false}
              />
            {/each}
          {/if}
          {#if blobs[selectedTimestep] && visualizationSelected == VisualisationType.AbstractSpheres} 
            {#each dataClustersGivenK[blobsAmount] as cluster, i}
              <Sphere
                radius={(cluster.to - cluster.from + 1) / 1000.0 * 2}
                center={blobFromPoints(dataTimesteps[selectedTimestep].slice(cluster.from, cluster.to + 1)).center}
                color={blobsColored ? [dataClustersGivenK[blobsAmount][i].color.rgb[0], dataClustersGivenK[blobsAmount][i].color.rgb[1], dataClustersGivenK[blobsAmount][i].color.rgb[2], 1.0] : [1.0, 1.0, 1.0, 1.0]}
              />
            {/each}
            {#if blobsAmount > 1}
              <ContinuousTube
                radius={(1.0 / blobsAmount) / 15.0}
                points={blobs[selectedTimestep].map(blob => blob.center)}
                color={[0.9, 0.9, 0.9]}
                multicolored={false}
              />
            {/if}
          {/if}
          {#if blobs[selectedTimestep] && visualizationSelected == VisualisationType.Cones}
            {#each dataClustersGivenK[blobsAmount] as cluster, _}
              <PcaCone 
                points={dataTimesteps[selectedTimestep].slice(cluster.from, cluster.to + 1)}
                color={blobsColored ? [cluster.color.rgb[0], cluster.color.rgb[1], cluster.color.rgb[2]] : [1.0, 1.0, 1.0]}
              />
            {/each}
            {#if blobsAmount > 1}
              <ContinuousTube
                radius={(1.0 / blobsAmount) / 15.0}
                points={blobs[selectedTimestep].map(blob => blob.center)}
                color={[0.9, 0.9, 0.9]}
                multicolored={false}
              />
            {/if}  
          {/if}
          {#if blobs[selectedTimestep] && visualizationSelected == VisualisationType.Hedgehog}
            {#each blobs[selectedTimestep] as blob, i}
              <Hedgehog
                radius = {blob.normalizedPoints.length / 1000.0 * 2}
                blobs = {blobs[selectedTimestep]}
                blobID = {i}
                precise = {preciseQuills}
                minDistance = {maxDistance}
                color={blobsColored ? [dataClustersGivenK[blobsAmount][i].color.rgb[0], dataClustersGivenK[blobsAmount][i].color.rgb[1], dataClustersGivenK[blobsAmount][i].color.rgb[2]] : [1.0, 1.0, 1.0]}
              />
            {/each}
            {#if blobsAmount > 1}
              <ContinuousTube
                radius={(1.0 / blobsAmount) / 15.0}
                points={blobs[selectedTimestep].map(blob => blob.center)}
                color={[0.9, 0.9, 0.9]}
                multicolored={false}
              />
            {/if}
          {/if}-->
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

            <Select size="sm" inline labelText="Visualization:" bind:selected={visualizationSelected} on:change={() => selectedChromosome?.visualization?.setVisualizationType(visualizationSelected)}>
              {#each Object.keys(VisualisationType) as key, index}
                <SelectItem value={key}/>  
              {/each}
            </Select>

            {#if visualizationSelected == VisualisationType.Composite}
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
            {/if}

            {#if visualizationSelected != VisualisationType.Composite && visualizationSelected != VisualisationType.None && visualizationSelected != VisualisationType.Volume && visualizationSelected != VisualisationType.Matryoshka}
            <Checkbox labelText="Colored" bind:checked={blobsColored} />
            {/if}

            {#if visualizationSelected != VisualisationType.None && visualizationSelected != VisualisationType.Composite}
            <Checkbox labelText="Cluster at timestep" bind:checked={timestepClustering} />
            {/if}

            {#if visualizationSelected == VisualisationType.Matryoshka}
            <Checkbox labelText="Experimental colors" bind:checked={experimentalColors} />
            {/if}

            {#if visualizationSelected != VisualisationType.Matryoshka && visualizationSelected != VisualisationType.Composite && visualizationSelected != VisualisationType.None}
            <Slider labelText="Cluster amount" fullWidth min={1} max={15} bind:value={blobsAmount} />
            {/if}
            {#if visualizationSelected == VisualisationType.Implicit || visualizationSelected == VisualisationType.Matryoshka || visualizationSelected == VisualisationType.Pathline || visualizationSelected == VisualisationType.Spheres || visualizationSelected == VisualisationType.Spline}
              <Slider labelText="Radius" fullWidth min={0.01} max={0.3} step={0.01} bind:value={blobsRadius} />
            {/if}
            {#if visualizationSelected == VisualisationType.Matryoshka}
              <Slider labelText="Alpha" fullWidth min={0.05} max={1.0} step={0.05} bind:value={blobAlpha} />
            {/if}
            {#if visualizationSelected == VisualisationType.Hedgehog}
              <Slider labelText="Max distance" fullWidth min={0.0} max={0.5} step={0.01} bind:value={maxDistance} />
              <Checkbox labelText="Precise quills" bind:checked={preciseQuills} />
            {/if}

            {#if visualizationSelected == VisualisationType.Volume}
              <Checkbox labelText="Abstractize volumes" bind:checked={abstractVolumes} />

              <Slider labelText="Transparency" fullWidth min={0.0} max={1.0} step={0.01} bind:value={volumeTransparency} />
              <Slider labelText="Radius" fullWidth min={0.01} max={0.1} step={0.01} bind:value={volumeRadius} />

              <Checkbox labelText="Use colormap" bind:checked={volumeUseColormap} />

              <Select labelText="Colormap" bind:selected={volumeColormapChoice}>
                <SelectItem value="White to Black" />
                <SelectItem value="Rainbow" />
                <SelectItem value="Cool Warm" />
                <SelectItem value="Matplotlib Plasma" />
                <SelectItem value="Samsel Linear Green" />
              </Select>

              <Select labelText="Math Function" bind:selected={volumeFunction}>
                <SelectItem text="Last Timestep" value={0} />
                <SelectItem text="Number of Timesteps" value={1} />
              </Select>
            {/if}

            {#if dataClustersGivenK && dataPathlines}
              <Dendrogram
                dataClustersGivenK={dataClustersGivenK}
                visualizationSelected={visualizationSelected}
                bind:blobsAmount={blobsAmount}
                modelSize={dataPathlines.length}
                experimental={experimentalColors}
                action={action}
                bind:matryoshkaVisibility={matryoshkaBlobsVisible}
                bind:interactiveCluster={interactiveClusterRef}
                update={clustersUpdated}
              />
            {/if}
          </AccordionItem>

          <AccordionItem title="Data Loading">
            <input type="file"  accept=".pdb,.PDB" id="file-input" bind:files={pdbFiles} on:change={loadFiles}/>
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
