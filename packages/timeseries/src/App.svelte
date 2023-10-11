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

  import { averagePathlines, loadTimesteps, normalizePointClouds, timestepsToPathlines, loadBitmap, clusterPathlines, centroid } from "./utils/main";
  import type { ClusterNode } from "./utils/main";

  import "carbon-components-svelte/css/g100.css";
  import { Header, SkipToContent, Checkbox, Accordion, AccordionItem, Select, SelectItem } from "carbon-components-svelte";
  import RangeSlider from "svelte-range-slider-pips";
  import { Slider } from "carbon-components-svelte";
  import TimeVolume from "./objects/TimeVolume.svelte";
  import SignedDistanceGrid from "./objects/SignedDistanceGrid.svelte";
  import ContinuousTube from "./objects/ContinuousTube.svelte";
  import { treeColor } from "./utils/treecolors";
  import Sphere from "./objects/Sphere.svelte";
  import { simplify } from "./utils/simplifyLine";
  import PathlineViewport from "./PathlineViewport.svelte";
  import Spline from "./objects/Spline.svelte";

  import "@carbon/styles/css/styles.css";
  import "@carbon/charts/styles.css";
  import { LineChart } from "@carbon/charts-svelte";

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
  let viewport2d: Graphics.DistanceViewport | null = null;

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

        blobsPointsAtTimestep.push({
          normalizedPoints,
          center: vec3.clone(bb.center),
          scale: 0.5 * maxLength,
        });
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

  //#region Configuration
  // Volume
  let volumeVisible = true;
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

  let pathlinesSimplifyFactor = 0.0;
  let pathlinesShowChildren = false;
  let pathlinesApproximate = false;

  let selectedTimestep = 0;
  //#endregion Configuration

  let lineChartMovementAmount = [];
  $: if (dataPathlines) {
    lineChartMovementAmount = dataPathlines.map((p, index) => {
      let result = 0.0;
      for (let i = 0; i < p.length - 1; i++) {
        result += vec3.distance(p[i], p[i + 1]);
      }
      return {
        group: "Value",
        key: index + 1,
        value: result,
      };
    });
  }

  let lineChartMovementRadius = [];
  $: if (dataPathlines) {
    lineChartMovementRadius = dataPathlines.map((p, index) => {
      let result = p.reduce((a, b) => Math.max(a, vec3.distance(p[0], b)), 0.0);

      return {
        group: "Value",
        key: index + 1,
        value: result,
      };
    });
  }

  import Graph from "graphology";
  import forceAtlas2 from "graphology-layout-forceatlas2";
  import { random } from "graphology-layout";
  import * as graphologyCanvas from "graphology-canvas";
  import Sigma from "sigma";
    import Viewport2D from "./Viewport2D.svelte";
    import DistanceMap from "./objects/DistanceMap.svelte";
    import ChromatinViewport from "./ChromatinViewport.svelte";

  function componentToHex(c) {
    var hex = c.toString(16);
    return hex.length == 1 ? "0" + hex : hex;
  }

  function rgbToHex(r, g, b) {
    return "#" + componentToHex(r) + componentToHex(g) + componentToHex(b);
  }

  let sigmaContainer: HTMLDivElement;
  let graph = new Graph();
  let renderer = null;
  const namedColors = ["blue", "red", "pink", "cyan", "green", "purple", "navy"];
  $: if (dataTimesteps && dataClustersGivenK && sigmaContainer) {
    const averagedPositions: vec3[] = dataClustersGivenK[blobsAmount].map((c) => {
      const points = dataTimesteps[selectedTimestep].slice(c.from, c.to + 1);
      const sum = points.reduce((a, b) => vec3.add(vec3.create(), a, b), vec3.create());

      return vec3.scale(sum, sum, points.length);
    });

    graph = new Graph();
    for (let i = 0; i < blobsAmount; i++) {
      const c = dataClustersGivenK[blobsAmount][i].color.rgb;
      console.log(c);
      console.log("#" + Math.round(255 * c[0]).toString(16) + Math.round(255 * c[1]).toString(16) + Math.round(255 * c[2]).toString(16));
      graph.addNode(i, { size: 5, color: rgbToHex(Math.round(255 * c[0]).toString(16), Math.round(255 * c[1]).toString(16), Math.round(255 * c[2]).toString(16)) });
    }

    for (let i = 0; i < blobsAmount; i++) {
      for (let j = i + 1; j < blobsAmount; j++) {
        graph.addEdge(i, j, { weight: vec3.distance(averagedPositions[i], averagedPositions[j]) });
      }
    }

    random.assign(graph);
    forceAtlas2.assign(graph, 200);

    console.log(graph, graph.order, graph.size);

    // graphologyCanvas.render(graph, graphCanvas.getContext("2d"));
    if (!renderer) {
      renderer = new Sigma(graph, sigmaContainer);
    }
    renderer.setGraph(graph);
  }

  let visibleClusters: boolean[] = [];
  $: console.log(visibleClusters);
  $: {
    visibleClusters = new Array(blobsAmount).fill(true);
    console.log("because this shit is run");
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
          <!-- <LineChart
            theme="g90"
            data={lineChartMovementAmount}
            options={{
              title: "Line (time series)",
              axes: {
                bottom: {
                  title: "Bin",
                  mapsTo: "key",
                  scaleType: "linear",
                },
                left: {
                  title: "Movement amount",
                  mapsTo: "value",
                  scaleType: "linear",
                },
              },
              curve: "curveMonotoneX",
              height: "400px",
            }}
          />
          <LineChart
            theme="g90"
            data={lineChartMovementRadius}
            options={{
              title: "Line (time series)",
              axes: {
                bottom: {
                  title: "Bin",
                  mapsTo: "key",
                  scaleType: "linear",
                },
                left: {
                  title: "Movement amount",
                  mapsTo: "value",
                  scaleType: "linear",
                },
              },
              curve: "curveMonotoneX",
              height: "400px",
            }}
          /> -->
          <!-- <div bind:this={sigmaContainer} style="width: 400px; height: 400px; display: relative; background: white;" /> -->
          {#if $adapter && $device && $graphicsLibrary && dataTimesteps && dataTimesteps.length > volumeTimeRange[1]}
            <div class="arrows"> 
              <ChromatinViewport
                chromatinParts={[dataTimesteps[selectedTimestep]]}
                approximateCurve={pathlinesApproximate}
                radius={blobsRadius}
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
              {#if blobs[selectedTimestep]}
                {#each blobs[selectedTimestep] as blob, i}
                  <SignedDistanceGrid
                    points={blob.normalizedPoints}
                    translate={blob.center}
                    scale={blob.scale}
                    radius={blobsRadius}
                    visible={blobsVisible && visibleClusters[i]}
                    color={blobsColored ? dataClustersGivenK[blobsAmount][i].color.rgb : vec3.fromValues(1.0, 1.0, 1.0)}
                  />
                {/each}
              {/if}
              <!-- {#if dataClusteredClustersCentroid}
                {#each dataClusteredClustersCentroid as centroids, i}
                  <ContinuousTube points={centroids} radius={0.01} color={colors[i]} />
                {/each}
              {/if} -->
            </Viewport3D>
          {/if}
        </Pane>
      </Splitpanes>
    </Pane>
    <Pane size={20}>
      <div style="padding: 8px; color:white">
        <Accordion>
          <AccordionItem open title="Volume">
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
            <Checkbox labelText="Visible" bind:checked={blobsVisible} />
            <Checkbox labelText="Colored" bind:checked={blobsColored} />

            <Slider labelText="Amount" fullWidth min={1} max={16} bind:value={blobsAmount} />
            <Slider labelText="Radius" fullWidth min={0.01} max={0.1} step={0.01} bind:value={blobsRadius} />

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
                  <div class="cluster-dendogram-row">
                    {#each clustersAtLevel as cluster, i}
                      <div
                        style={`width: ${100.0 * ((cluster.to - cluster.from + 1) / dataPathlines.length)}%;
                        background-color: rgb(${255 * cluster.color.rgb[0]} ${255 * cluster.color.rgb[1]} ${255 * cluster.color.rgb[2]})
                        `}
                      />
                    {/each}
                  </div>
                {/each}
              </div>
            {/if}
          </AccordionItem>

          <AccordionItem title="Average pathline">
            <Slider labelText="Simplify " fullWidth min={0.0} max={0.5} step={0.01} bind:value={pathlinesSimplifyFactor} />
            <Checkbox labelText="Show direct children pathlines" bind:checked={pathlinesShowChildren} />
            <Checkbox labelText="Show curve approximation" bind:checked={pathlinesApproximate} />
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
    height: 40px;
    display: flex;
    flex-direction: row;
    border-bottom: 4px solid black;
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
