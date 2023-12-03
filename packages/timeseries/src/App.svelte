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
  import Viewport3D from "./Viewport3D.svelte";
  import { vec3, type vec4 } from "gl-matrix";
  import "./styles/splitpanes.css";
  import { Pane, Splitpanes } from "svelte-splitpanes";

  import { loadTimesteps, normalizePointClouds, timestepsToPathlines, loadBitmap, clusterTimestep, clusterPathlines, loadBEDfile, blobFromPoints } from "./utils/main";
  import type { ClusterBlob, ClusterNode } from "./utils/main";

  import ChromatinViewport from "./ChromatinViewport.svelte";
  import SignedDistanceGridBlended from "./objects/SignedDistanceGridBlended.svelte";
  import "carbon-components-svelte/css/g100.css";
  import { Header, SkipToContent, Checkbox, Accordion, AccordionItem, Select, SelectItem } from "carbon-components-svelte";
  import RangeSlider from "svelte-range-slider-pips";
  import { Slider } from "carbon-components-svelte";
  import TimeVolume from "./objects/TimeVolume.svelte";
  import SignedDistanceGrid from "./objects/SignedDistanceGrid.svelte";
  import { treeColor, staticColors } from "./utils/treecolors";
  import Sphere from "./objects/Sphere.svelte";
  import {DSVDelimiter, parseBEDString} from "./utils/data-parser";
  import {computePCA, getCenterPoints} from "./utils/abstractClustersUtils";

  import "@carbon/styles/css/styles.css";
  import "@carbon/charts/styles.css";
  import { loop_guard } from "svelte/internal";
  import ConnectedCones from "./objects/ConnectedCones.svelte";
  import ConnectedSpheres from "./objects/ConnectedSpheres.svelte";
  import BlobVolumes from "./objects/BlobVolumes.svelte";
    import MatryoshkaClusters from "./objects/MatryoshkaClusters.svelte";

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

  //let timesteps: vec3[][] = null;
  let dataTimesteps: vec3[][] = null;

  // Load base timestep data and transform them into pathlines (really just a transpose of data)
  // [timestep][bin]
  // $: dataTimesteps = timesteps && normalizePointClouds(timesteps);
  
  
  let dataClustersByTimestep: ClusterNode[][] | null = null;

  $: if (visualizationSelected == "Clustering" && selectedTimestep && dataTimesteps) {
    dataClustersByTimestep = clusterTimestep(dataTimesteps[selectedTimestep]).slice(0, 16);
    treeColor(dataClustersByTimestep);
  }

  let dataClusteredTimestep: ClusterBlob[] = [];

  $: if (dataClustersByTimestep && dataClustersByTimestep[blobsAmount] && dataTimesteps) {

    dataClusteredTimestep = [];
    for (const [clusterIndex, cluster] of dataClustersByTimestep[blobsAmount].entries()) {
      //dataTimesteps[selectedTimestep].filter((val, idx) => cluster.indexes[idx]);
      //dataClusteredTimestep[clusterIndex] = blobFromPoints(dataTimesteps[selectedTimestep].filter((val, idx) => cluster.indexes[idx]));
      dataClusteredTimestep[clusterIndex] = blobFromPoints(cluster.points);
    }

  }

  // [pathline][timestep]
  $: dataPathlines = dataTimesteps && timestepsToPathlines(dataTimesteps);

  // Load precomputed clusters of pathlines
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
    // dataPathlines = timestepsToPathlines(dataTimesteps);
    //dataClustersGivenK = await clusterPathlines(dataPathlines);

    // const bytes = new TextEncoder().encode(JSON.stringify(clusterPathlines(dataPathlines)));
    // const blob = new Blob([bytes], {
    //   type: "application/json;charset=utf-8",
    // });
    // saveAs(blob, `clusters.json`);

    dataClustersGivenK = await (await fetch("./clusters.json")).json();
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

  let matryoshkaBlobsVisible = [false, true, false, true, false, false, false, false, false, false, false, false, false, false];

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

  let blobColors: vec4[] = [];

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

  let blobsVisible = true;
  let blobsRadius = 0.03;
  let blobsAmount = 1;
  let blobsColored = true;
  let blobAlpha = 0.4;
  let visualizationSelected = "Default"
  let experimentalColors = false;

  let pathlinesSimplifyFactor = 0.0;
  let pathlinesShowChildren = false;
  let pathlinesApproximate = false;

  let selectedTimestep = 0; 
  
  let isMulticolored = false;
  //#endregion Configuration

  function dendrogramClick(depth) {
    matryoshkaBlobsVisible[depth] = !matryoshkaBlobsVisible[depth];
  }

  let blobsStyle = "arrows-2x2";
  $: if (blobsAmount < 4) {
    blobsStyle = "";
  } else if (blobsAmount == 5 || blobsAmount == 6) {
    blobsStyle = "arrows-3x2";
  } else if (blobsAmount >= 7 && blobsAmount <= 9) {
    blobsStyle = "arrows-3x3";
  } else if (blobsAmount > 9 && blobsAmount <= 12) {
    blobsStyle = "arrows-4x3";
  } else if (blobsAmount > 12 && blobsAmount <= 16) {
    blobsStyle = "arrows-4x4";
  } else {
    blobsStyle = "arrows-2x2";
  }

  let centerPoints: vec3[] = [];
  $: if (blobs[selectedTimestep] && (visualizationSelected == "Spheres"  || visualizationSelected == "Cones")) {
    centerPoints = getCenterPoints(blobs, selectedTimestep);
  }

  let firstPCVec: vec3[] = [];
  let firstPCVal: number[] = [];
  let secondPCVal: number[] = [];
  $: if (blobs[selectedTimestep] && (visualizationSelected == "Cones")) {
      let firstPC = computePCA(0, blobs, selectedTimestep, true);
      firstPCVec = firstPC.vectors;
      firstPCVal = firstPC.eigenvalues;
      let secondPC = computePCA(1, blobs, selectedTimestep, false);
      secondPCVal = secondPC.eigenvalues;
    
  }

  // fixed for now
  let filename = "./timeseries/tmpfile.bed";
  let result = loadBEDfile(filename);
  result.then((res) => {
    let data = parseBEDString(res, DSVDelimiter.Tab);
    // TODO
    });
</script>


<main>
  <div class="ui">
    {#if dataTimesteps}
      <Slider fullWidth min={0} max={dataTimesteps.length - 1} bind:value={selectedTimestep} />
    {/if}
  </div>

  <Splitpanes theme="chromoskein" horizontal={false}>
    <!--
    <Pane>
      <Splitpanes theme="chromoskein" horizontal={false}>
        <Pane size={50}>
          {#if $adapter && $device && $graphicsLibrary && dataTimesteps && dataTimesteps.length > volumeTimeRange[1]}
            <div class="arrows"> 
              <ChromatinViewport
                chromatinParts={[dataTimesteps[selectedTimestep]]}
                approximateCurve={pathlinesApproximate}
                radius={blobsRadius}
                multicolored={isMulticolored}
              />
            </div>
            <Viewport2D> 
              <DistanceMap
                points={dataTimesteps[selectedTimestep]}
              />
            </Viewport2D>
            <div class={`arrows ${blobsStyle}`}>
              {#if dataClustersGivenK && dataPathlines}
                {#each Array(blobsAmount) as _, index (index)}
                  <PathlineViewport
                    {dataClustersGivenK}
                    {dataPathlines}
                    t={selectedTimestep / (dataTimesteps.length - 1)}
                    currentLevel={blobsAmount}
                    clusterIndex={index}
                    simplifyFactor={pathlinesSimplifyFactor}
                    showChildren={pathlinesShowChildren}
                    approximateCurve={pathlinesApproximate}
                  />
                {/each}
              {/if}
            </div>
          {/if}
        </Pane>
      -->
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
          {#if dataClusteredTimestep && visualizationSelected == "Clustering"}
            {#each dataClusteredTimestep as blob, i}
              <SignedDistanceGrid
                points={blob.normalizedPoints}
                translate={blob.center}
                scale={blob.scale}
                radius={blobsRadius}
                visible={blobsVisible}
                color={blobsColored ? dataClustersByTimestep[blobsAmount][i].color.rgb : vec3.fromValues(1.0, 1.0, 1.0)}
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
                coneStartRadius={secondPCVal[i] / 20.0 + 0.05}
                coneCenter={blob.center}
                coneHeight={firstPCVal[i] / 2.0 + 0.3}
                coneOrientation={vec3.fromValues(firstPCVec[i][0], firstPCVec[i][1], firstPCVec[i][2])}
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
            <!--<RangeSlider id={"rangeSlider"} bind:values={volumeTimeRange} min={0} max={599} range={true} />-->

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
              <SelectItem value="Clustering" />
              <SelectItem value="Matryoshka" />
              <SelectItem value="Spheres" />
              <SelectItem value="Cones" />
            </Select>

            <Checkbox labelText="Colored" bind:checked={blobsColored} />
            <Checkbox labelText="Experimental colors" bind:checked={experimentalColors} />

            {#if visualizationSelected != "Matryoshka"}
            <Slider labelText="Amount" fullWidth min={1} max={15} bind:value={blobsAmount} />
            {/if}
            {#if visualizationSelected != "Spheres" && visualizationSelected != "Cones"}
              <Slider labelText="Radius" fullWidth min={0.01} max={0.1} step={0.01} bind:value={blobsRadius} />
            {/if}
            {#if visualizationSelected == "Matryoshka"}
              <Slider labelText="Alpha" fullWidth min={0.05} max={1.0} step={0.05} bind:value={blobAlpha} />
            {/if}
            <!-- {#each visibleClusters as visibleCluster, i}
              <Checkbox
                checked={visibleClusters[i]}
                on:change={() => {
                  visibleClusters[i] = !visibleClusters[i];
                  visibleClusters = visibleClusters;
                  console.log(visibleClusters[i]);
                }}
              />
            {/each} -->
            {#if dataClustersGivenK && visualizationSelected != "Clustering"}
              <div class="cluster-dendogram">
                {#each dataClustersGivenK.slice(1, 15) as clustersAtLevel, clusterLevel}
                  <div class="cluster-dendogram-row" on:click={() => dendrogramClick(clusterLevel)} on:keydown={() => { }}>
                    {#each clustersAtLevel as cluster, i}
                      <div
                        style={`
                          width: ${100.0 * ((cluster.to - cluster.from + 1) / dataPathlines.length)}%;
                          background-color: rgb(${(!experimentalColors) ? 255 * cluster.color.rgb[0] : 255 * staticColors[i % staticColors.length][0]} ${(!experimentalColors) ? 255 * cluster.color.rgb[1] : 255 * staticColors[i % staticColors.length][1]} ${(!experimentalColors) ? 255 * cluster.color.rgb[2] : 255 * staticColors[i % staticColors.length][2]});
                          border: 2px solid ${(matryoshkaBlobsVisible[clusterLevel] ? "white" : "black")}
                        `}
                      />
                    {/each}
                  </div>
                {/each}
              </div>
            {/if}
            {#if dataClustersGivenK && visualizationSelected == "Clustering"}
              <div class="cluster-dendogram">
                {#each dataClustersByTimestep.slice(1, 15) as clustersAtLevel, clusterLevel}
                  <div class="cluster-dendogram-row" on:click={() => dendrogramClick(clusterLevel)} on:keydown={() => { }}>
                    {#each clustersAtLevel as cluster, i}
                      <div
                        style={`
                          width: ${100.0 * (cluster.points.length / dataPathlines.length)}%;
                          background-color: rgb(${(!experimentalColors) ? 255 * cluster.color.rgb[0] : 255 * staticColors[i % staticColors.length][0]} ${(!experimentalColors) ? 255 * cluster.color.rgb[1] : 255 * staticColors[i % staticColors.length][1]} ${(!experimentalColors) ? 255 * cluster.color.rgb[2] : 255 * staticColors[i % staticColors.length][2]});
                          border: 2px solid ${(matryoshkaBlobsVisible[clusterLevel] ? "white" : "black")}
                        `}
                      />
                    {/each}
                  </div>
                {/each}
              </div>
            {/if}

          </AccordionItem>

          <AccordionItem open title="Average pathline">
            <Slider labelText="Simplify " fullWidth min={0.0} max={0.5} step={0.01} bind:value={pathlinesSimplifyFactor} />
            <Checkbox labelText="Show direct children pathlines" bind:checked={pathlinesShowChildren} />
            <Checkbox labelText="Show curve approximation" bind:checked={pathlinesApproximate} />
            <Checkbox labelText="Multicolored" bind:checked={isMulticolored} />
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

<!-- <Content>
  hello
</Content> -->
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

  .arrows {
    width: 100%;
    height: 100%;
    position: relative;
    display: flex;
    flex-direction: row;
  }

  /*
  .arrows-2x2 {
    display: grid;
    grid-template-columns: 1fr 1fr;
    grid-template-rows: 1fr 1fr;
  }

  .arrows-3x3 {
    display: grid;
    grid-template-columns: 1fr 1fr 1fr;
    grid-template-rows: 1fr 1fr 1fr;
  }

  .arrows-3x2 {
    display: grid;
    grid-template-columns: 1fr 1fr 1fr;
  }

  .arrows-4x3 {
    display: grid;
    grid-template-columns: 1fr 1fr 1fr 1fr;
    grid-template-rows: 1fr 1fr 1fr;
  }

  .arrows-4x4 {
    display: grid;
    grid-template-columns: 1fr 1fr 1fr 1fr;
    grid-template-rows: 1fr 1fr 1fr 1fr;
  }
  */

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
