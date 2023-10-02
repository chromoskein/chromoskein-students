<script lang="ts">
  import { onMount, setContext } from "svelte";
  import { writable, type Writable } from "svelte/store";
  import * as Graphics from "lib-graphics";
  import Viewport3D from "./Viewport3D.svelte";
  import minimumBoundingSphere from "./minimumBoundingSphere.js";
  import { parsePdb, type ChromatinModel } from "./parsePDB";
  import { glMatrix, vec3, vec4 } from "gl-matrix";
  import { buildTree, type Tree } from "./TreeSimplifier";

  const adapter: Writable<GPUAdapter | null> = writable(null);
  const device: Writable<GPUDevice | null> = writable(null);
  const graphicsLibrary: Writable<Graphics.GraphicsLibrary | null> =
    writable(null);

  let viewport = null;
  let wasm_module = null;
  let atoms: vec3[] = [];
  let baseSpheres: vec4[] = [];
  let tree: Tree = null;
  let visibleNodes: Tree[] = [];
  let limit: number = 3;

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

  async function loadMinimumBoundingSphereModule() {
    wasm_module = await minimumBoundingSphere();
  }

  onMount(async () => {
    await getGPU();
    await loadMinimumBoundingSphereModule();

    const response = await (
      await await fetch("./cell7_3dmodel_renamed.pdb")
    ).text();
    const pdb: ChromatinModel = parsePdb(response)[0];

    const range = pdb.ranges[0];
    range.to = 100;
    const pdbAtoms = pdb.atoms
      .slice(range.from, range.from + range.to - 1)
      .map((a) => vec3.fromValues(a.x, a.y, a.z));

    let bbMax = pdbAtoms.reduce(
      (a, b) => vec3.max(vec3.create(), a, b),
      vec3.fromValues(Number.MIN_VALUE, Number.MIN_VALUE, Number.MIN_VALUE)
    );
    let bbMin = pdbAtoms.reduce(
      (a, b) => vec3.min(vec3.create(), a, b),
      vec3.fromValues(Number.MAX_VALUE, Number.MAX_VALUE, Number.MAX_VALUE)
    );
    let bbCenter = vec3.scale(
      vec3.create(),
      vec3.add(vec3.create(), bbMax, bbMin),
      0.5
    );
    let bbSides = vec3.sub(vec3.create(), bbMax, bbMin);
    bbSides.forEach((v: number) => Math.abs(v));
    const largestSide = Math.max(...bbSides);
    let bbLength = vec3.fromValues(
      1.0 / largestSide,
      1.0 / largestSide,
      1.0 / largestSide
    );

    const atomsNormalized = pdbAtoms.map((a) =>
      vec3.mul(vec3.create(), vec3.sub(vec3.create(), a, bbCenter), bbLength)
    );
    atoms = atomsNormalized;
  });

  $: {
    if (viewport && tree) {
      visibleNodes = [tree];
      while (visibleNodes.length < limit) {
        const notLeafs = visibleNodes.filter(n => n.right != null || n.left != null);

        if (notLeafs.length == 0) {
          break;
        }
        
        // let maxNodeIndex = 0; 
        let max = notLeafs[0];
        for (let i = 0; i < notLeafs.length; i++) {
          if (notLeafs[i].sphere[3] > max.sphere[3]) {
            max = notLeafs[i];
          }
        }

        const maxNodeIndex = visibleNodes.findIndex(n => n == max);

        // const maxNode = notLeafs.reduce((prev, current) =>
        //   // prev.sphere[3] > current[3] 
        //   prev.volumeLeftScore + prev.volumeRightScore < current.volumeLeftScore + current.volumeRightScore
        //   ? prev : current
        // );

        // console.log(maxNodeIndex);
        const newNodes = [...visibleNodes.slice(0, maxNodeIndex), max.left, max.right, ...visibleNodes.slice(maxNodeIndex + 1)].filter(n => n != null);
        // visibleNodes = visibleNodes.filter((n) => n != maxNode);
        // if (maxNode.left) visibleNodes.push(maxNode.left);
        // if (maxNode.right) visibleNodes.push(maxNode.right);
        visibleNodes = newNodes;

        // console.log(visibleNodes);
      }
    }
  }

  $: {
    if (viewport && atoms.length > 0) {
      viewport.scene.clearObjects();
      
      const initialSpheres: vec4[] = [];
      for (let i = 0; i < atoms.length; i++) {
        const distance = vec3.distance(
          atoms[i],
          i == atoms.length - 1 ? atoms[i - 1] : atoms[i + 1]
        );

        initialSpheres.push(
          vec4.fromValues(atoms[i][0], atoms[i][1], atoms[i][2], 0.5 * distance)
        );
      }
      baseSpheres = initialSpheres;

      tree = buildTree(initialSpheres, wasm_module);
      visibleNodes = [tree];
    }
  }

  $: {
    if (viewport && tree && visibleNodes) {
      viewport.scene.clearObjects();

      for (let i = 0; i < visibleNodes.length - 1; i++) {
        // const [object, objectID] = viewport.scene.addObject(Graphics.RoundedCone);
        // object.properties.startRadius = 0.50 * visibleNodes[i].sphere[3];
        // object.properties.endRadius = 0.50 * visibleNodes[i+1].sphere[3];
        // object.properties.start = [
        //   visibleNodes[i].sphere[0], 
        //   visibleNodes[i].sphere[1], 
        //   visibleNodes[i].sphere[2]
        // ];
        // object.properties.end = [
        //   visibleNodes[i+1].sphere[0], 
        //   visibleNodes[i+1].sphere[1], 
        //   visibleNodes[i+1].sphere[2]
        // ];

        const [object, objectID] = viewport.scene.addObject(Graphics.Circle);
        object.properties.center = [
          visibleNodes[i].sphere[0], 
          visibleNodes[i].sphere[1], 
          visibleNodes[i].sphere[2]
        ];
        object.properties.radius = visibleNodes[i].sphere[3];

        object.properties.color = [1.0, 1.0, 1.0, 1.0];
        object.setDirtyCPU();
      }

      // for (let i = 0; i < baseSpheres.length; i++) {
      //   // const [object, objectID] = viewport.scene.addObject(Graphics.RoundedCone);
      //   const [object, objectID] = viewport.scene.addObject(Graphics.Sphere);

      //   object.properties.center = [
      //     baseSpheres[i][0], baseSpheres[i][1], baseSpheres[i][2]
      //   ];
      //   object.properties.radius = baseSpheres[i][3];

      //   // object.properties.startRadius = 0.005;
      //   // object.properties.endRadius = 0.005;
      //   // object.properties.start = [atoms[i][0], atoms[i][1], atoms[i][2]];
      //   // object.properties.end = [
      //   //   atoms[i + 1][0],
      //   //   atoms[i + 1][1],
      //   //   atoms[i + 1][2],
      //   // ];

      //   object.properties.color = [1.0, 1.0, 1.0, 1.0];
      //   object.setDirtyCPU();
      // }
    }
  }
</script>

<main>
  <div class="ui">
    <input type="range" min="2" max={baseSpheres.length} step="2" bind:value={limit} />
  </div>
  {#if $adapter && $device && $graphicsLibrary}
    <Viewport3D bind:viewport />
  {/if}
</main>

<style>
.ui {
  position: fixed;
  top: 30px;
  left: 30px;
  width: 200px;
  height: 100px;
  background: white;
  z-index: 2;
}
</style>
