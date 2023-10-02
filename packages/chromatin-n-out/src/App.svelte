<script lang="ts">
  //~ svetle stuff
  // import { get, type Writable } from "svelte/store";
  import { onMount, setContext } from "svelte";
  import type { Writable } from "svelte/store";
  import { writable } from "svelte/store";


  //~ own app stuff
  import Viewport3D from "./components/Viewport3D.svelte";

  //~ graphics lib stuff
  import { GraphicsLibrary } from "lib-graphics";
  // import { parsePdb, type ChromatinModel} from "../../lib-dataloader";
  import { parsePdb, type ChromatinModel} from "lib-dataloader";

  const adapter: Writable<GPUAdapter | null> = writable(null);
  const device: Writable<GPUDevice | null> = writable(null);
  const graphicsLibrary: Writable<GraphicsLibrary | null> = writable(null);

  setContext("adapter", adapter);
  setContext("device", device);
  setContext("graphicsLibrary", graphicsLibrary);

  async function getGPU() {
    $adapter = await navigator.gpu.requestAdapter();

    if ($adapter) {
      $device = await $adapter.requestDevice();
      $graphicsLibrary = new GraphicsLibrary($adapter, $device);
    }
  }

  onMount(async () => {
    await getGPU();


  });
</script>

<main>
  {#if $adapter && $device && $graphicsLibrary}
    <Viewport3D />
  {/if}

</main>


<style>
  
</style>