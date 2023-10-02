<script lang="ts">
  import { onMount, setContext } from "svelte";
  import { writable, type Writable } from "svelte/store";
  import * as Graphics from "lib-graphics";
  import Viewport3D from "./Viewport3D.svelte";

  const adapter: Writable<GPUAdapter | null> = writable(null);
  const device: Writable<GPUDevice | null> = writable(null);
  const graphicsLibrary: Writable<Graphics.GraphicsLibrary | null> =
    writable(null);

  setContext("adapter", adapter);
  setContext("device", device);
  setContext("graphicsLibrary", graphicsLibrary);

  let viewport: Graphics.Viewport3D | null = null;

  async function getGPU() {
    $adapter = await navigator.gpu.requestAdapter();

    if ($adapter) {
      $device = await $adapter.requestDevice();
      $graphicsLibrary = new Graphics.GraphicsLibrary($adapter, $device);
    }
  }

  // Will be called precisely once when creating component
  onMount(async () => {
    await getGPU();
  });

  // Will be called whenever viewport changes (hopefully never)
  $: if (viewport) {
    const [object, objectID] = viewport.scene.addObject(Graphics.Sphere);
    object.properties.center = [0, 0, 0];
    object.properties.radius = 0.1;
    object.properties.color = [1.0, 1.0, 1.0, 1.0];
    object.setDirtyCPU();
  }
</script>

{#if $adapter && $device && $graphicsLibrary}
  <Viewport3D bind:viewport />
{/if}

<style>
</style>
