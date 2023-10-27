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

  import { loadTimesteps, normalizePointClouds, timestepsToPathlines, loadBitmap, clusterPathlines, centroid } from "./utils/main";
  import type { ClusterNode } from "./utils/main";

  import ChromatinViewport from "./ChromatinViewport.svelte";
  import SignedDistanceGridBlended from "./objects/SignedDistanceGridBlended.svelte";
  import "carbon-components-svelte/css/g100.css";
  import { Header, SkipToContent, Checkbox, Accordion, AccordionItem, Select, SelectItem } from "carbon-components-svelte";
  import RangeSlider from "svelte-range-slider-pips";
  import { Slider } from "carbon-components-svelte";
  import TimeVolume from "./objects/TimeVolume.svelte";
  import SignedDistanceGrid from "./objects/SignedDistanceGrid.svelte";
  import { treeColor } from "./utils/treecolors";
  import Sphere from "./objects/Sphere.svelte";
  import ContinuousTube from "./objects/ContinuousTube.svelte";


  import "@carbon/styles/css/styles.css";
  import "@carbon/charts/styles.css";

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
  const filenames: string[] = new Array(600).fill(null).map((v, i) => "./timeseries/timestep_" + (i + 1).toString() + ".XYZ");

  let timesteps: vec3[][] = null;

  // Load base timestep data and transform them into pathlines (really just a transpose of data)
  // [timestep][bin]
  $: dataTimesteps = timesteps && normalizePointClouds(timesteps);

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

    timesteps = await loadTimesteps(filenames);
    // dataTimesteps = normalizePointClouds(timesteps);
    // dataPathlines = timestepsToPathlines(dataTimesteps);
    // dataClustersGivenK = clusterPathlines(dataPathlines);

    // const bytes = new TextEncoder().encode(JSON.stringify(clusterPathlines(dataPathlines)));
    // const blob = new Blob([bytes], {
    //   type: "application/json;charset=utf-8",
    // });
    // saveAs(blob, `clusters.json`);

    dataClustersGivenK = await (await fetch("./clusters.json")).json();
  });
  //#endregion Init

  // [timestep][blob]
  let blobs: {
    normalizedPoints: vec3[];
    center: vec3;
    scale: number;
  }[][] = [];

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

  let matryoshkaColors: vec3[] = [];
  let matryoshkaRadius: number[] = [];
  let matryoshkaBlobs: {
    normalizedPoints: vec3[];
    center: vec3;
    scale: number;
  }[][] = [];

  let matryoshkaBlobPoints: vec3[][] = [];
  let matryoshkaBlobCenters: vec3[] = [];
  let matryoshkaBlobScales: number[] = [];
  let matryoshkaBlobsVisible = [false, true, false, true, false, false, false, false, false, false, false, false, false, false];

  $: if (matryoshkaBlobs[selectedTimestep]) {
    matryoshkaBlobPoints.length = 0;
    matryoshkaBlobCenters.length = 0;
    matryoshkaBlobScales.length = 0;
    for (let i = 0; i < matryoshkaBlobs[selectedTimestep].length; i++) {
      matryoshkaBlobPoints.push(matryoshkaBlobs[selectedTimestep][i].normalizedPoints);
      matryoshkaBlobCenters.push(matryoshkaBlobs[selectedTimestep][i].center);
      matryoshkaBlobScales.push(matryoshkaBlobs[selectedTimestep][i].scale);
    }
  }


  $: if (dataClustersGivenK && dataPathlines) {
    matryoshkaBlobs = [];
    matryoshkaColors = [];
    matryoshkaRadius = [];

    let depthsVisible = matryoshkaBlobsVisible.filter(x => x).length;
    let radiusOffset = depthsVisible * 0.015;

    let found = [];
    let clusterPoints = [];
    for (let i = 1; i < 15; i++) {
      if (!matryoshkaBlobsVisible[i - 1]) {
        continue;
      }

      let clusters = dataClustersGivenK[i];

      for (const [_, cluster] of clusters.entries()) {
        if (found.filter(x => x[0] == cluster.from && x[1] == cluster.to).length == 0) {
          clusterPoints.push(dataPathlines.slice(cluster.from, cluster.to + 1));
          matryoshkaColors.push(cluster.color.rgb);
          found.push([cluster.from, cluster.to]);
          matryoshkaRadius.push(radiusOffset);
        }
      }
      radiusOffset -= 0.015;
    }

    for (let timestep = 0; timestep < dataTimesteps.length; timestep++) {
      let blobsPointsAtTimestep: {
        normalizedPoints: vec3[];
        center: vec3;
        scale: number;
      }[] = [];
      for (const [index, clusteredPathline] of clusterPoints.entries()) {
        const points = clusteredPathline.map((pathline) => pathline[timestep]);

        blobsPointsAtTimestep.push(blobFromPoints(points));
      }

      matryoshkaBlobs.push(blobsPointsAtTimestep);
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

  //#region Configuration
  // Volume
  let volumeVisible = false;
  let volumeTransparency = 0.15;
  let volumeRadius = 0.03;
  let volumeColormapChoice = "Cool Warm";
  let volumeColormap: ImageBitmap | null = null;
  let volumeFunction = 0;
  let volumeTimeRange = [0, 599];

  let blobsVisible = true;
  let blobsRadius = 0.03;
  let blobsAmount = 1;
  let blobsColored = true;
  let blobAlpha = 0.4;
  let visualizationSelected = "Default"

  let pathlinesSimplifyFactor = 0.0;
  let pathlinesShowChildren = false;
  let pathlinesApproximate = false;

  let selectedTimestep = 0; 
  
  let isMulticolored = false;
  //#endregion Configuration

  function dendrogramClick(depth) {
    matryoshkaBlobsVisible[depth] = !matryoshkaBlobsVisible[depth];
  }

  function blobFromPoints(points) {
    let bb = Graphics.BoundingBoxFromPoints(points);
    Graphics.BoundingBoxCalculateCenter(bb);

    let bbSizeLengthsVec3 = vec3.sub(vec3.create(), bb.max, bb.min);
    let bbSizeLengths = [Math.abs(bbSizeLengthsVec3[0]), Math.abs(bbSizeLengthsVec3[1]), Math.abs(bbSizeLengthsVec3[2])];
    let maxLength = Math.max(...bbSizeLengths) * 0.25;

    bb.min = vec3.add(vec3.create(), bb.min, vec3.fromValues(-maxLength, -maxLength, -maxLength));
    bb.max = vec3.add(vec3.create(), bb.max, vec3.fromValues(maxLength, maxLength, maxLength));

    const normalizedPoints: Array<vec3> = Graphics.normalizePointsByBoundingBox(bb, points);

    bbSizeLengthsVec3 = vec3.sub(vec3.create(), bb.max, bb.min);
    bbSizeLengths = [Math.abs(bbSizeLengthsVec3[0]), Math.abs(bbSizeLengthsVec3[1]), Math.abs(bbSizeLengthsVec3[2])];
    maxLength = Math.max(...bbSizeLengths);

    return {
      normalizedPoints,
      center: vec3.clone(bb.center),
      scale: 0.5 * maxLength,
    };
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
  $: if (blobs[selectedTimestep] && visualizationSelected == "Approximated") {
    console.log(blobs[selectedTimestep].length);
    centerPoints = [];
    for (let i = 0; i < blobs[selectedTimestep].length; i++) {
      centerPoints.push(blobs[selectedTimestep][i].center);
    }
    console.log(centerPoints);
  }
</script>

<main>
  <div class="ui">
    {#if dataTimesteps}
      <Slider fullWidth min={0} max={dataTimesteps.length - 1} bind:value={selectedTimestep} />
    {/if}
  </div>

  <Splitpanes theme="chromoskein" horizontal={false}>
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
          <!--
            <Viewport2D> 
              <DistanceMap
                points={dataTimesteps[selectedTimestep]}
              />
            </Viewport2D>
          -->
          <!--
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
          -->
          {/if}
        </Pane>
        <Pane size={50}>
          {#if $adapter && $device && $graphicsLibrary && dataTimesteps && dataTimesteps.length > volumeTimeRange[1]}
            <Viewport3D bind:viewport>
              <TimeVolume
                visible={volumeVisible}
                points={dataTimesteps.slice(volumeTimeRange[0], volumeTimeRange[1])}
                transparency={volumeTransparency}
                radius={volumeRadius}
                colormap={volumeColormap}
                func={volumeFunction}
              />
              {#if visualizationSelected == "Matryoshka"}
                <SignedDistanceGridBlended
                  points={matryoshkaBlobPoints}
                  scales={matryoshkaBlobScales}
                  translates={matryoshkaBlobCenters}
                  colors={matryoshkaColors}
                  radius={blobsRadius}
                  radiusOffsets={matryoshkaRadius}
                  alpha={blobAlpha}
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
              {#if blobs[selectedTimestep] && visualizationSelected == "Approximated"}
                {#each blobs[selectedTimestep] as blob, i}
                  <Sphere
                    radius={blob.normalizedPoints.length / 1000.0 * 2}
                    center={blob.center}
                    color={blobsColored ? [dataClustersGivenK[blobsAmount][i].color.rgb[0], dataClustersGivenK[blobsAmount][i].color.rgb[1], dataClustersGivenK[blobsAmount][i].color.rgb[2], 1.0] : [1.0, 1.0, 1.0, 1.0]} 
                  />
                  <ContinuousTube 
                    points={centerPoints}
                    radius={(1.0 / centerPoints.length) / 10.0} 
                    color={[1.0, 1.0, 1.0]} 
                    multicolored={false} 
                  />
                {/each}
              {/if}
            </Viewport3D>
          {/if}
        </Pane>
      </Splitpanes>
    </Pane>
    <Pane size={20}>
      <div style="padding: 8px; color:white">
        <Accordion>
          <AccordionItem title="Volume">
            <Checkbox labelText="Visible" bind:checked={volumeVisible} />
            <Slider labelText="Transparency" fullWidth min={0.0} max={1.0} step={0.01} bind:value={volumeTransparency} />
            <Slider labelText="Radius" fullWidth min={0.0} max={0.1} step={0.01} bind:value={volumeRadius} />
            <RangeSlider id={"rangeSlider"} bind:values={volumeTimeRange} min={0} max={599} range={true} />

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
              <SelectItem value="Approximated" />
            </Select>

            <Checkbox labelText="Colored" bind:checked={blobsColored} />

            {#if visualizationSelected != "Matryoshka"}
            <Slider labelText="Amount" fullWidth min={1} max={15} bind:value={blobsAmount} />
            {/if}
            {#if visualizationSelected != "Approximated"}
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
            {#if dataClustersGivenK}
              <div class="cluster-dendogram">
                {#each dataClustersGivenK.slice(1, 15) as clustersAtLevel, clusterLevel}
                  <div class="cluster-dendogram-row" on:click={() => dendrogramClick(clusterLevel)} on:keydown={() => { }}>
                    {#each clustersAtLevel as cluster, i}
                      <div
                        style={`
                          width: ${100.0 * ((cluster.to - cluster.from + 1) / dataPathlines.length)}%;
                          background-color: rgb(${255 * cluster.color.rgb[0]} ${255 * cluster.color.rgb[1]} ${255 * cluster.color.rgb[2]});
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
