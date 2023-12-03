<svelte:options immutable={true} />

<script context="module" lang="ts">
  export function evaluateQuadraticBezier(p0: vec3, p1: vec3, p2: vec3, t: number): vec3 {
    let tinv = 1.0 - t;

    let result = vec3.scale(vec3.create(), p0, tinv * tinv);
    vec3.add(result, result, vec3.scale(vec3.create(), p1, 2.0 * tinv * t));
    vec3.add(result, result, vec3.scale(vec3.create(), p2, t * t));

    return result;
  }
</script>

<script lang="ts">
  import { vec3, vec4 } from "gl-matrix";
  import ContinuousTube from "../objects/ContinuousTube.svelte";
  import Sphere from "../objects/Sphere.svelte";
  import Spline from "../objects/Spline.svelte";
  import { lineToSpline } from "../utils/lineToSpline";
  import { averagePathlines, normalizePointClouds, type ClusterNode } from "../utils/main";
  import { simplify } from "../utils/simplifyLine";
  import Viewport3D from "./Viewport3D.svelte";

  import { BoundingBoxFromPoints, OrbitCamera, toRadian, normalizePointsByBoundingBox } from "lib-graphics";

  export let dataPathlines: vec3[][] = null;
  export let dataClustersGivenK: ClusterNode[][] | null = null;

  export let currentLevel: number = 1;
  export let clusterIndex: number = 0;
  export let simplifyFactor: number = 0.0;

  export let approximateCurve: boolean = true;
  export let showChildren: boolean = false;
  export let t: number = 0.0;

  let pathlines: vec3[][] | null = null;
  let colors: vec3[] | null = null;

  $: if (dataPathlines && dataClustersGivenK) {
    const parentCluster = dataClustersGivenK[currentLevel][clusterIndex];
    let children = parentCluster.children;

    let level = currentLevel + 1;
    while (children.length < 2) {
      if (level >= 14) break;

      children = dataClustersGivenK[level][children[0]].children;

      level += 1;
    }
    const childClusters = children.map((c) => dataClustersGivenK[level][c]);

    pathlines = [
      averagePathlines(dataPathlines.slice(parentCluster.from, parentCluster.to + 1)),
      ...childClusters.map((c) => averagePathlines(dataPathlines.slice(c.from, c.to + 1))),
    ];
    // const bbs = pathlines.map((p) => BoundingBoxFromPoints(p));
    // pathlines = pathlines.map((p, i) => normalizePointsByBoundingBox(bbs[i], p));

    // console.log(BoundingBoxFromPoints(pathlines[0]));

    colors = [parentCluster.color.rgb, ...childClusters.map((c) => c.color.rgb)];
  }

  let normalizedPathlines: vec3[][] | null = null;
  $: if (pathlines) {
    normalizedPathlines = pathlines.map((p) => {
      const bb = BoundingBoxFromPoints(p);
      const normalized = normalizePointsByBoundingBox(bb, p);

      return simplify(normalized, simplifyFactor, true);
    });
  }

  let splinePathlines: vec3[][] | null = null;
  $: if (normalizedPathlines) {
    splinePathlines = normalizedPathlines.map((p) => lineToSpline(p));
  }

  let spherePositions: vec3[] | null = null;
  $: if (normalizedPathlines && !approximateCurve) {
    spherePositions = normalizedPathlines.map((pathline) => {
      const len = pathline.length - 1;

      const fromIndex = Math.floor(t * len);
      const toIndex = Math.ceil(t * len);
      const fractional = t * len - Math.floor(t * len);

      const from = pathline[fromIndex];
      const to = pathline[toIndex];

      const direction = vec3.sub(vec3.create(), to, from);

      return vec3.add(vec3.create(), from, vec3.scale(vec3.create(), direction, fractional));
    });
  }

  $: if (splinePathlines && approximateCurve) {
    spherePositions = splinePathlines.map((spline) => {
      const bezierCount = spline.length / 3;

      const bezier = Math.floor(t * (bezierCount - 1));
      const fractional = t * (bezierCount - 1) - Math.floor(t * (bezierCount - 1));

      const result = evaluateQuadraticBezier(spline[bezier * 3 + 0], spline[bezier * 3 + 1], spline[bezier * 3 + 2], fractional);

      return result;
    });
  }

  function updateCamera(camera: OrbitCamera) {
    const bb = BoundingBoxFromPoints(normalizedPathlines[0]);

    const radius = Math.max(vec3.length(bb.max), vec3.length(bb.min));

    // Given the camera Field of View in radians
    const fov = toRadian(camera.fieldOfView);

    // Compute the distance the camera should be to fit the entire bounding sphere
    const newDistance = (radius * 2.0) / Math.tan(fov / 2.0);

    console.log(newDistance);
    camera.distance = newDistance;
  }
</script>

<div class="arrows-viewport">
  <Viewport3D afterCameraUpdate={(camera) => updateCamera(camera)}>
    {#if !approximateCurve && normalizedPathlines[0]}<ContinuousTube points={normalizedPathlines[0]} radius={0.015} color={colors[0]} />{/if}
    {#if !approximateCurve && normalizedPathlines[1] && showChildren}<ContinuousTube points={normalizedPathlines[1]} radius={0.015} color={colors[1]} />{/if}
    {#if !approximateCurve && normalizedPathlines[2] && showChildren}<ContinuousTube points={normalizedPathlines[2]} radius={0.015} color={colors[2]} />{/if}

    {#if approximateCurve && splinePathlines[0]}<Spline points={splinePathlines[0]} radius={0.02} color={colors[0]} />{/if}
    {#if approximateCurve && splinePathlines[1] && showChildren}<Spline points={splinePathlines[1]} radius={0.02} color={colors[1]} />{/if}
    {#if approximateCurve && splinePathlines[2] && showChildren}<Spline points={splinePathlines[2]} radius={0.02} color={colors[2]} />{/if}

    {#if spherePositions[0]}<Sphere center={spherePositions[0]} radius={0.04} color={[1.0, 0.0, 0.0, 1.0]} />{/if}
    {#if spherePositions[1] && showChildren}<Sphere center={spherePositions[1]} radius={0.04} color={[1.0, 0.0, 0.0, 1.0]} />{/if}
    {#if spherePositions[2] && showChildren}<Sphere center={spherePositions[2]} radius={0.04} color={[1.0, 0.0, 0.0, 1.0]} />{/if}
  </Viewport3D>
</div>

<style>
  .arrows-viewport {
    border: 1px solid grey;
    position: relative;
    flex-grow: 1;
  }
</style>
