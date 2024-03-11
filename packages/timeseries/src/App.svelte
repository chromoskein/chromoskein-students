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
  import { vec3, type vec4 } from "gl-matrix";
  import "./styles/splitpanes.css";
  import { Pane, Splitpanes } from "svelte-splitpanes";

  import { loadTimesteps, normalizePointClouds, timestepsToPathlines, loadBitmap, clusterTimestep, clusterPathlines, loadBEDfile, blobFromPoints } from "./utils/main";
  import type { ClusterBlob, ClusterNode } from "./utils/main";

  import "carbon-components-svelte/css/g100.css";
  import { Header, SkipToContent, Checkbox, Accordion, AccordionItem, Select, SelectItem } from "carbon-components-svelte";
  import { Slider } from "carbon-components-svelte";
  import TimeVolume from "./objects/TimeVolume.svelte";
  import SignedDistanceGrid from "./objects/SignedDistanceGrid.svelte";
  import { treeColor, staticColors } from "./utils/treecolors";
  import Sphere from "./objects/Sphere.svelte";
  import {DSVDelimiter, parseBEDString} from "./utils/data-parser";
  import {computePCA, findClosestBlobs, getCenterPoints, getConeOrientation} from "./utils/abstractClustersUtils";

  import "@carbon/styles/css/styles.css";
  import "@carbon/charts/styles.css";
  import ConnectedCones from "./objects/ConnectedCones.svelte";
  import ConnectedSpheres from "./objects/ConnectedSpheres.svelte";
  import BlobVolumes from "./visalizations/BlobVolumes.svelte";
  import MatryoshkaClusters from "./visalizations/MatryoshkaClusters.svelte";
  import Hedgehog from "./objects/Hedgehog.svelte";
  import InteractiveCluster from "./visalizations/InteractiveCluster.svelte";

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

  //#region Data

  let dataTimesteps: vec3[][] = null;  
  let dataClustersByTimestep: ClusterNode[][] = [];


  let dataClusteredTimestep: ClusterBlob[] = [];
  let dataClusteredTimestepDelimiters: number[][] = [];

  
  $: if (timestepClustering) {
    dataClustersGivenK = clusterTimestep(dataTimesteps[selectedTimestep]).slice(0, 16);
  }

  $: if (!timestepClustering) {
    dataClustersGivenK = staticDataClustersGivenK;
  }

  // [pathline][timestep]
  $: dataPathlines = dataTimesteps && timestepsToPathlines(dataTimesteps);

  // Load precomputed clusters of pathlines
  let timestepClustering = false;
  let staticDataClustersGivenK: ClusterNode[][] | null = null;
  let dataClustersGivenK: ClusterNode[][] | null = null;

  $: dataClustersGivenK && treeColor(dataClustersGivenK);

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

    // const bytes = new TextEncoder().encode(JSON.stringify(clusterPathlines(dataPathlines)));
    // const blob = new Blob([bytes], {
    //   type: "application/json;charset=utf-8",
    // });
    // saveAs(blob, `clusters.json`);

    //dataClustersGivenK = await (await fetch("./clusters.json")).json();
    dataClustersByTimestep = clusterTimestep(dataTimesteps[selectedTimestep]).slice(0, 16);
    treeColor(dataClustersByTimestep);
  });
  //#endregion Init

  // [timestep][blob]
  let blobs: ClusterBlob[][] = [];

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
  let blobsTimeVolumeVisible = false;
  let volumeVisible = false;
  let volumeTransparency = 0.15;
  let volumeRadius = 0.03;
  let volumeColormapChoice = "Cool Warm";
  let volumeColormap: ImageBitmap | null = null;
  let volumeFunction = 0;
  let volumeTimeRange = [0, 599];

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


  let visualizationSelected = "Default"
  let showConnectors = false;
  let selectedTimestep = 0; 

  let matryoshkaBlobsVisible = [false, true, false, true, false, false, false, false, false, false, false, false, false, false];
  function dendrogramClick(depth) {
    blobsAmount = depth + 1;
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

  let closestBlobs: vec3[][] = [];
  let coneOrient: vec3[][] = [];
  let maxDistance = 2.0;
  $: if (blobs[selectedTimestep] && (visualizationSelected == "Hedgehog") && blobsAmount > 1) {
    closestBlobs = findClosestBlobs(blobs[selectedTimestep], centerPoints, maxDistance);
    coneOrient = getConeOrientation(blobs[selectedTimestep], closestBlobs);
  }

  let clusterVisualization = "Sphere";
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
          {#if volumeVisible}
            <TimeVolume
              visible={volumeVisible}
              points={[dataTimesteps.slice(volumeTimeRange[0], volumeTimeRange[1])]}
              transparency={volumeTransparency}
              radii={[volumeRadius]}
              colormap={volumeColormap}
              func={volumeFunction}
              colors={[[1.0, 1.0, 1.0, 0.0]]}
            />
          {/if}
          {#if blobsTimeVolumeVisible && blobs && blobs[0]}
            <BlobVolumes
              blobs={blobs}
              blobColors={blobColors}
              volumeRadius={volumeRadius}
              selectedTimestep={selectedTimestep}
              transparency={volumeTransparency}
              func={volumeFunction}
              colormap={volumeColormap}
            />
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

          {#if blobs[selectedTimestep] && visualizationSelected == "Default"}
            {#each blobs[selectedTimestep] as blob, i}
              <SignedDistanceGrid
                points={blob.normalizedPoints}
                translate={blob.center}
                scale={blob.scale}
                radius={blobsRadius}
                visible={blobsVisible}
                color={blobsColored ? dataClustersGivenK[blobsAmount][i].color.rgb : vec3.fromValues(1.0, 1.0, 1.0)}
              />
            {/each}
          {/if}
          {#if blobs[selectedTimestep] && visualizationSelected == "Spheres"}
            {#each blobs[selectedTimestep] as blob, i}
              <ConnectedSpheres
                tubePoints={centerPoints}
                tubeRadius={(1.0 / centerPoints.length) / 10.0} 
                tubeColor={[0.9, 0.9, 0.9]} 
                tubeMulticolored={false} 
                sphereRadius={blob.normalizedPoints.length / 1000.0 * 2}
                sphereCenter={blob.center}
                sphereColor={[blobColors[i][0], blobColors[i][1], blobColors[i][2], blobColors[i][3]]} 
              />
            {/each}
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
          {#if blobs[selectedTimestep] && visualizationSelected == "Hedgehog" && blobsAmount > 1}
            {#each blobs[selectedTimestep] as blob, i}
              <Hedgehog
                tubePoints={centerPoints}
                tubeRadius={(1.0 / centerPoints.length) / 8.0} 
                tubeColor={[0.9, 0.9, 0.9]}
                coneStartRadius={0.1}
                coneCenter={blob.center}
                coneHeight={0.5}
                coneOrientation={coneOrient[i]}
                coneColor={blobsColored ? [dataClustersGivenK[blobsAmount][i].color.rgb[0], dataClustersGivenK[blobsAmount][i].color.rgb[1], dataClustersGivenK[blobsAmount][i].color.rgb[2]] : [1.0, 1.0, 1.0]}
              />
            {/each}
          {/if}
        </Viewport3D>
      {/if}
    </Pane>
        <!--
      </Splitpanes>
    </Pane> -->
    <Pane size={25}>
      <div style="padding: 8px; color:white">
        <Accordion>
          <AccordionItem title="Volume">
            <Checkbox labelText="Visible" bind:checked={volumeVisible} />
            <Checkbox labelText="Approximation blob volumes" bind:checked={blobsTimeVolumeVisible} />

            <Slider labelText="Transparency" fullWidth min={0.0} max={1.0} step={0.01} bind:value={volumeTransparency} />
            <Slider labelText="Radius" fullWidth min={0.0} max={0.1} step={0.01} bind:value={volumeRadius} />

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
          </AccordionItem>

          <AccordionItem open title="Blobby Clusters">
            <Select size="sm" inline labelText="Visualization:" bind:selected={visualizationSelected}>
              <SelectItem value="None" />
              <SelectItem value="Default" />
              <SelectItem value="Matryoshka" />
              <SelectItem value="Spheres" />
              <SelectItem value="Cones" />
              <SelectItem value="Hedgehog" />
              <SelectItem value="Composite" />
            </Select>

            {#if visualizationSelected == "Composite"}
            <Select size="sm" inline labelText="Action" bind:selected={action}>
              <SelectItem value="Change representation" />
              <SelectItem value="Split" />
              <SelectItem value="Merge" />
            </Select>
            {/if}

            {#if visualizationSelected == "Composite" && action == "Change representation"}
            <Select size="sm" inline labelText="Visualization type:" bind:selected={clusterVisualization}>
              <SelectItem value="Sphere" />
              <SelectItem value="Hedgehog" />
              <SelectItem value="Cones" />
              <SelectItem value="SignedDistanceGrid" />
              <SelectItem value="Pathline" />
              <SelectItem value="Volume" />
            </Select>
            {/if}

            {#if visualizationSelected == "Composite"}
            <Checkbox labelText="Show cluster connections" bind:checked={showConnectors} />
            {/if}

            {#if visualizationSelected != "Composite"}
            <Checkbox labelText="Colored" bind:checked={blobsColored} />
            <Checkbox labelText="Experimental colors" bind:checked={experimentalColors} />
            <Checkbox labelText="Cluster at timestep" bind:checked={timestepClustering} />
            {/if}

            {#if visualizationSelected != "Matryoshka" && visualizationSelected != "Composite"}
            <Slider labelText="Amount" fullWidth min={1} max={15} bind:value={blobsAmount} />
            {/if}
            {#if visualizationSelected != "Spheres" && visualizationSelected != "Cones" && visualizationSelected != "Composite"}
              <Slider labelText="Radius" fullWidth min={0.01} max={0.1} step={0.01} bind:value={blobsRadius} />
            {/if}
            {#if visualizationSelected == "Matryoshka"}
              <Slider labelText="Alpha" fullWidth min={0.05} max={1.0} step={0.05} bind:value={blobAlpha} />
            {/if}
            {#if visualizationSelected == "Hedgehog"}
              <Slider labelText="Max distance" fullWidth min={0.1} max={3.0} step={0.05} bind:value={maxDistance} />
            {/if}

            {#if dataClustersGivenK && 
            (visualizationSelected == "Cones" || visualizationSelected == "Spheres" ||
            visualizationSelected == "Hedgehog" || visualizationSelected == "Default")}
              <div class="cluster-dendogram">
                {#each dataClustersGivenK.slice(1, 16) as clustersAtLevel, clusterLevel}
                  <div class="cluster-dendogram-row" on:click={() => dendrogramClick(clusterLevel)} on:keydown={() => { }}>
                    {#each clustersAtLevel as cluster, i}
                      <div
                        style={`
                          width: ${100.0 * ((cluster.to - cluster.from + 1) / dataPathlines.length)}%;
                          background-color: rgb(${(!experimentalColors) ? 255 * cluster.color.rgb[0] : 255 * staticColors[i % staticColors.length][0]} ${(!experimentalColors) ? 255 * cluster.color.rgb[1] : 255 * staticColors[i % staticColors.length][1]} ${(!experimentalColors) ? 255 * cluster.color.rgb[2] : 255 * staticColors[i % staticColors.length][2]});
                          border: 2px solid ${(blobsAmount == clusterLevel + 1 ? "white" : "black")}
                        `}
                      />
                    {/each}
                  </div>
                {/each}
              </div>
            {/if}
            {#key clustersUpdated}
            {#if dataClustersGivenK && visualizationSelected == "Composite"}
                <div class="cluster-dendogram">
                  {#each dataClustersGivenK.slice(1, 16) as clustersAtLevel, clusterLevel}
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
</style>
