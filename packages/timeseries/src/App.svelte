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
  import { parsePdb } from "lib-dataloader";
  import Viewport3D from "./viewports/Viewport3D.svelte";
  import { vec3, type vec4 } from "gl-matrix";
  import "./styles/splitpanes.css";
  import { Pane, Splitpanes } from "svelte-splitpanes";

  import { loadTimesteps, normalizePointClouds, timestepsToPathlines, loadBitmap, clusterTimestep, clusterPathlines, loadBEDfile, blobFromPoints } from "./utils/main";
  import type { ClusterBlob, ClusterNode } from "./utils/main";

  import "carbon-components-svelte/css/g100.css";
  import { Header, SkipToContent, Checkbox, Accordion, AccordionItem, Select, SelectItem, Button } from "carbon-components-svelte";
  import { Slider } from "carbon-components-svelte";
  import TimeVolume from "./objects/TimeVolume.svelte";
  import SignedDistanceGrid from "./objects/SignedDistanceGrid.svelte";
  import { treeColor, staticColors } from "./utils/treecolors";
  import Sphere from "./objects/Sphere.svelte";
  import Spline from "./objects/Spline.svelte";
  import {DSVDelimiter, parseBEDString} from "./utils/data-parser";
  import {computePCA, getCenterPoints} from "./utils/abstractClustersUtils";

  import "@carbon/styles/css/styles.css";
  import "@carbon/charts/styles.css";
  import ConnectedCones from "./objects/ConnectedCones.svelte";
  import MatryoshkaClusters from "./visalizations/MatryoshkaClusters.svelte";
  import Hedgehog from "./objects/Hedgehog.svelte";
  import InteractiveCluster from "./visalizations/InteractiveCluster.svelte";
  import ContinuousTube from "./objects/ContinuousTube.svelte";
  import type { Chromosome } from "./utils/data-models";
  import ChromosomeItem from "./visalizations/ChromosomeItem.svelte";

  enum VisualisationType {
    None = "None",
    Implicit = "Implicit",
    Pathline = "Pathline",
    Spheres = "Spheres",
    Spline = "Spline",
    Volume = "Volume",
    Matryoshka = "Matryoshka",
    AbstractSpheres = "Abstract Spheres",
    Cones = "Cones",
    Hedgehog = "Hedgehog",
    Composite = "Composite"
  }

  export const saveAs = (blob, name) => {
    // Namespace is used to prevent conflict w/ Chrome Poper Blocker extension (Issue https://github.com/eligrey/FileSaver.js/issues/561)
    const a = document.createElementNS("http://www.w3.org/1999/xhtml", "a");
    //a.download = name;
    //a.rel = "noopener";
    //a.href = URL.createObjectURL(blob);

    setTimeout(() => a.click(), 200);
  };

  const adapter: Writable<GPUAdapter | null> = writable(null);
  const device: Writable<GPUDevice | null> = writable(null);
  const graphicsLibrary: Writable<Graphics.GraphicsLibrary | null> = writable(null);

  let viewport: Graphics.Viewport3D | null = null;

  let chromosomes: Chromosome[] = [];
  let chromosomeID: number = 0;
  function loadNewModels(pdbText) {
    let loadedModels = [];
    let model = parsePdb(pdbText);
    if (model.ranges.length == 0) {
      loadedModels.push({
          id: chromosomeID,
          name: "0",
          visible: true,
          points: model.bins.map((v) => vec3.fromValues(v.x, v.y, v.z)),
          color: {r: Math.random(), g: Math.random(), b: Math.random()}
        });
      chromosomeID++;
    } else {
      for (let i = 0; i < model.ranges.length; i++) {
        loadedModels.push({
          id: chromosomeID,
          name: i.toString(),
          visible: true,
          points: model.bins.slice(model.ranges[i].from, model.ranges[i].to).map((v) => vec3.fromValues(v.x, v.y, v.z)),
          color: {r: Math.random(), g: Math.random(), b: Math.random()}
        });
        chromosomeID++;
      }
    }
    return loadedModels;
  }

	let pdbFiles;
	$: if (pdbFiles) { 
		for (const file of pdbFiles) {
      file.text().then(pdbText => addChromosomes(loadNewModels(pdbText)));
		}
	}

  $: (async (chromosomes) => {
    if (chromosomes) {
      for (let chromosome of chromosomes) {
        console.log(chromosome.name)
      }
      console.log(chromosomes);
  }})(chromosomes);

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
    //normalizePointClouds(timesteps)
    const filenames: string[] = new Array(600).fill(null).map((v, i) => "./timeseries/timestep_" + (i + 1).toString() + ".XYZ");
    const timesteps = await loadTimesteps(filenames);
    dataTimesteps = normalizePointClouds(timesteps);
    // dataTimesteps = normalizePointClouds(timesteps);
    dataPathlines = timestepsToPathlines(dataTimesteps);
    staticDataClustersGivenK = await clusterPathlines(dataPathlines);
    staticDataClustersGivenK = staticDataClustersGivenK.slice(0, 16);
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

  $: if (volumeColormap && viewport != null) {
    viewport.scene.setColorMapFromBitmap(volumeColormap);
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
  let blobsAmount = 1;
  let blobsColored = true;
  let blobAlpha = 0.4;
  let blobColors: vec4[] = [];
  let experimentalColors = false;

  $: if (blobs && blobs[0] && dataClustersGivenK) {
    blobColors = [];
    for (let i = 0; i < blobs[0].length; i++) {
        if (blobsColored) {
            blobColors.push([dataClustersGivenK[blobsAmount][i].color.rgb[0], dataClustersGivenK[blobsAmount][i].color.rgb[1], dataClustersGivenK[blobsAmount][i].color.rgb[2], 1.0]);
        } else {  
            blobColors.push([1.0, 1.0, 1.0, 0.0]);
        }
    }
  }


  let visualizationSelected = VisualisationType.Pathline;
  let showConnectors = false;
  let selectedTimestep = 0; 

  let matryoshkaBlobsVisible = [false, true, false, true, false, false, false, false, false, false, false, false, false, false, false];
  function dendrogramClick(depth) {
    blobsAmount = depth + 1;
  }

  function dendrogramClickMatryoshka(depth) {
    matryoshkaBlobsVisible[depth] = !matryoshkaBlobsVisible[depth];
  }

  let centerPoints: vec3[] = [];
  $: if (blobs[selectedTimestep] && (visualizationSelected == "Spheres"  || visualizationSelected == "Cones" || visualizationSelected == "Hedgehog")) {
    centerPoints = getCenterPoints(blobs, selectedTimestep);
  }

  let firstPCVec: vec3[] = [];
  let firstPCVal: number[] = [];
  let secondPCVal: number[] = [];
  $: if (blobs[selectedTimestep] && (visualizationSelected == "Cones")) {
      let PCA = computePCA(blobs, selectedTimestep);
      firstPCVec = PCA.firstPCVec;
      firstPCVal = PCA.firstPCVal;
      secondPCVal = PCA.secondPCVal;    
  }

  let preciseQuills: boolean = false;
  let maxDistance = 1.0;

  let clusterVisualization = "AbstractSphere";
  let action = "Change representation";

  // fixed for now
  let filename = "./timeseries/tmpfile.bed";
  let result = loadBEDfile(filename);
  result.then((res) => {
    let data = parseBEDString(res, DSVDelimiter.Tab);
    // TODO
  });

  let clustersUpdated = false;

  function updateClustersUpdated(newClustersUpdated) {
    clustersUpdated = newClustersUpdated;
  }

  let interactiveClusterRef;

  function callSplitClusters(cluster) {
    switch (action) {
      case "Split":
        cluster = interactiveClusterRef.getClusterComposite(cluster);
        interactiveClusterRef.splitClusters(cluster);
        break;
      case "Merge":
        cluster = interactiveClusterRef.getClusterComposite(cluster);
        interactiveClusterRef.mergeClusters(cluster);
    }
  }

  function findNodeWithTwoChildren(node) {
    while (node.children.length == 1 && node.k + 1 < dataClustersGivenK.length - 1) { 
      let originalRowIndex = node.k + 1;
      let originalColumnIndex = node.children[0];
      node = dataClustersGivenK[originalRowIndex][originalColumnIndex];
    }
    return node;
  }

  function addChildren(list, node, i) {
    for (let c = 0; c < node.children.length; c++) {
      let originalRowIndex = node.k + 1;
      let originalColumnIndex = node.children[c];
      let child = dataClustersGivenK[originalRowIndex][originalColumnIndex];
      list[i + 1].push(child);
    }
    return list;
  }

  let sparseDataClustersGivenK: ClusterNode[][] | null = [];

  $: if (dataClustersGivenK) {
    sparseDataClustersGivenK = [];
    sparseDataClustersGivenK.push([]);
    sparseDataClustersGivenK.push(dataClustersGivenK[1]);
    
    let i = 1;
    
    while (sparseDataClustersGivenK[i][0].k < dataClustersGivenK.length - 1) {
      sparseDataClustersGivenK.push([]);
      for(let j = 0; j < sparseDataClustersGivenK[i].length; j++){
        let node = findNodeWithTwoChildren(sparseDataClustersGivenK[i][j]);
        if(node.k == dataClustersGivenK.length - 1){
          sparseDataClustersGivenK[i + 1].push(node);
          continue;
        }
        sparseDataClustersGivenK = addChildren(sparseDataClustersGivenK, node, i);
      }
      i++;
    }
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
          {#if visualizationSelected == "Volume"}
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

          {#if visualizationSelected == "Pathline" && dataClustersGivenK && dataClustersGivenK[blobsAmount]}
            {#each chromosomes as chromosome, i}
              {#if chromosome.visible}
                <ContinuousTube
                  points={chromosome.points}
                  radius={blobsRadius}
                  color={[chromosome.color.r, chromosome.color.g, chromosome.color.b]}
                  multicolored={false}
                />
              {/if}
            {/each}
            <!--
            {#each dataClustersGivenK[blobsAmount] as cluster, _}
              <ContinuousTube
                points={dataTimesteps[selectedTimestep].slice(cluster.from, cluster.to + 1)}
                radius={blobsRadius}
                color={blobsColored ? vec3.fromValues(cluster.color.rgb[0], cluster.color.rgb[1], cluster.color.rgb[2]) : [1.0, 1.0, 1.0]}
                multicolored={false}
              />
            {/each}
            -->
          {/if}

          {#if visualizationSelected == "Spline" && dataClustersGivenK && dataClustersGivenK[blobsAmount]}
          {#each dataClustersGivenK[blobsAmount] as cluster, _}
            <Spline
              points={dataTimesteps[selectedTimestep].slice(cluster.from, cluster.to + 1)}
              radius={blobsRadius}
              color={blobsColored ? vec3.fromValues(cluster.color.rgb[0], cluster.color.rgb[1], cluster.color.rgb[2]) : [1.0, 1.0, 1.0]}
              multicolored={false}
            />
            {/each}
        {/if}

        {#if visualizationSelected == "Spheres" && dataClustersGivenK && dataClustersGivenK[blobsAmount]}
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

          {#if visualizationSelected == "Matryoshka"}
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
          {#if visualizationSelected == "Composite"}
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

          {#if blobs[selectedTimestep] && visualizationSelected == "Implicit"}
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
          {#if blobs[selectedTimestep] && visualizationSelected == "Abstract Spheres"}
            {#each blobs[selectedTimestep] as blob, i}
              <Sphere
                radius={blob.normalizedPoints.length / 1000.0 * 2}
                center={blob.center}
                color={blobsColored ? [blobColors[i][0], blobColors[i][1], blobColors[i][2], blobColors[i][3]] : [1.0, 1.0, 1.0, 1.0]} 
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
          {#if blobs[selectedTimestep] && visualizationSelected == "Cones"}
            {#each blobs[selectedTimestep] as blob, i}
              <ConnectedCones
                tubePoints={centerPoints}
                tubeRadius={(1.0 / centerPoints.length) / 20.0} 
                tubeColor={[0.9, 0.9, 0.9]} 
                coneStartRadius={secondPCVal[i] / 10.0 + 0.1}
                coneCenter={blob.center}
                coneHeight={firstPCVal[i] / 10.0 + 0.1}
                coneOrientation={vec3.fromValues(firstPCVec[i][0], firstPCVec[i][1], firstPCVec[i][2])}
                coneColor={blobsColored ? [dataClustersGivenK[blobsAmount][i].color.rgb[0], dataClustersGivenK[blobsAmount][i].color.rgb[1], dataClustersGivenK[blobsAmount][i].color.rgb[2]] : [1.0, 1.0, 1.0]}
              />
            {/each}                
          {/if}
          {#if blobs[selectedTimestep] && visualizationSelected == "Hedgehog"}
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
          {/if}
        </Viewport3D>
      {/if}
    </Pane>
        <!--
      </Splitpanes>
    </Pane> -->
    <Pane size={25}>
      <div style="padding: 8px; color:white; overflow: auto; height: calc(90vh);">
        <Accordion>
          <AccordionItem open title="Visualisation Parameters">
            <Select size="sm" inline labelText="Model">
              <SelectItem value={-1} text="Base"/>
              {#each chromosomes as chromosome, i}
                <SelectItem value={chromosome.id} text={chromosome.name}/>
              {/each}
            </Select>

            <Select size="sm" inline labelText="Visualization:" bind:selected={visualizationSelected}>
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

            {#if dataClustersGivenK && 
            (visualizationSelected == "Cones" || visualizationSelected == "Spheres" || visualizationSelected == "Abstract Spheres" || visualizationSelected == "Spline" ||
            visualizationSelected == "Hedgehog" || visualizationSelected == "Implicit" || visualizationSelected == "Volume" || visualizationSelected == "Pathline")}
              <div class="cluster-dendogram">
                {#each dataClustersGivenK.slice(1, 16) as clustersAtLevel, clusterLevel}
                  <div class="cluster-dendogram-row" on:click={() => dendrogramClick(clusterLevel)} on:keydown={() => { }}>
                    {#each clustersAtLevel as cluster, i}
                      <div
                        style={`
                          width: ${100.0 * ((cluster.to - cluster.from + 1) / dataPathlines.length)}%;
                          background-color: rgb(${(!experimentalColors) ? 255 * cluster.color.rgb[0] : 255 * staticColors[i % staticColors.length][0]} ${(!experimentalColors) ? 255 * cluster.color.rgb[1] : 255 * staticColors[i % staticColors.length][1]} ${(!experimentalColors) ? 255 * cluster.color.rgb[2] : 255 * staticColors[i % staticColors.length][2]});
                          border: 2px solid ${blobsAmount == clusterLevel + 1 ? "white" : "black"}
                        `}
                      />
                    {/each}
                  </div>
                {/each}
              </div>
            {/if}
            {#if dataClustersGivenK && visualizationSelected == "Matryoshka"}
            <div class="cluster-dendogram">
              {#each dataClustersGivenK.slice(1, 16) as clustersAtLevel, clusterLevel}
                <div class="cluster-dendogram-row" on:click={() => dendrogramClickMatryoshka(clusterLevel)} on:keydown={() => { }}>
                  {#each clustersAtLevel as cluster, i}
                    <div
                      style={`
                        width: ${100.0 * ((cluster.to - cluster.from + 1) / dataPathlines.length)}%;
                        background-color: rgb(${(!experimentalColors) ? 255 * cluster.color.rgb[0] : 255 * staticColors[i % staticColors.length][0]} ${(!experimentalColors) ? 255 * cluster.color.rgb[1] : 255 * staticColors[i % staticColors.length][1]} ${(!experimentalColors) ? 255 * cluster.color.rgb[2] : 255 * staticColors[i % staticColors.length][2]});
                        border: 2px solid ${matryoshkaBlobsVisible[clusterLevel] ? "white" : "black"}
                      `}
                    />
                  {/each}
                </div>
              {/each}
            </div>
            {/if}
            {#key clustersUpdated}
            {#if sparseDataClustersGivenK && visualizationSelected == "Composite"}
            <div class="cluster-dendogram">
              {#each sparseDataClustersGivenK.slice(1, 16) as clustersAtLevel, clusterLevel}
                <div class="cluster-dendogram-row">
                  {#each clustersAtLevel as cluster, i}
                    <div on:click={() => callSplitClusters(cluster)} on:keydown={() => { }}
                      style={`
                        width: ${100.0 * ((cluster.to - cluster.from + 1) / dataPathlines.length)}%;
                        background-color: rgb(${(!experimentalColors) ? 255 * cluster.color.rgb[0] : 255 * staticColors[i % staticColors.length][0]} ${(!experimentalColors) ? 255 * cluster.color.rgb[1] : 255 * staticColors[i % staticColors.length][1]} ${(!experimentalColors) ? 255 * cluster.color.rgb[2] : 255 * staticColors[i % staticColors.length][2]});
                        border: 2px solid ${cluster.visible ? "white" : "black"}
                      `}
                    />
                  {/each}
                </div>
              {/each}
            </div>
              {/if}
              {/key}
          </AccordionItem>

          <AccordionItem title="Data Loading">
            <input type="file"  accept=".pdb,.PDB" id="file-input" bind:files={pdbFiles}/>
            <Button
              kind="secondary"
              size="field"
              on:click={() => document.getElementById("file-input").click()}
            >  
              Load PDB File
            </Button>
            {#each chromosomes as chromosome, i}
              <ChromosomeItem bind:chromosome={chromosome} />
            {/each}
          </AccordionItem>
          <!-- <AccordionItem title="Pathlines" /> -->
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

  .cluster-dendogram {
    width: 100%;
    display: flex;
    flex-direction: column;
    border: 1px solid black;
  }

  .cluster-dendogram-row {
    height: 20px;
    display: flex;
    flex-direction: row;
    border-bottom: 2px solid black;
  }

  .cluster-dendogram:last-child {
    border-bottom: 0px;
  }

  .cluster-dendogram-row div {
    border-right: 4px solid black;
    display: block;
  }

  .cluster-dendogram-row:last-child {
    border: 0px;
  }

  #file-input {
    display: none;
  }
</style>
