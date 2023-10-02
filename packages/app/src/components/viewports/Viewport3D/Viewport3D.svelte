<script lang="ts">
  import { getContext, onMount } from "svelte";
  import type { Writable } from "svelte/store";
  import type * as Graphics from "lib-graphics";
  import Sphere from "./objects/Sphere.svelte";
  import type { Configuration3D } from "src/storage/storage";

  // Context
  const adapter: Writable<GPUAdapter> = getContext("adapter");
  const device: Writable<GPUDevice> = getContext("device");
  const graphicsLibrary: Writable<Graphics.GraphicsLibrary> =
    getContext("graphicsLibrary");

  let context: GPUCanvasContext | null = null;
  let viewport: Graphics.Viewport3D | null = null;

  // Viewport
  $: {
    if ($graphicsLibrary) {
      viewport?.deallocate();
      viewport = $graphicsLibrary.create3DViewport();
      viewport.clearColor = { r: 0.0, g: 0.0, b: 0.0, a: 1.0 };
    }
  }

  // Props
  export let configuration: Writable<Configuration3D>;

  let wrapper: HTMLDivElement;
  let canvas: HTMLCanvasElement;

  let width = 0;
  let height = 0;

  $: style =
    "width:" +
    (width / window.devicePixelRatio).toString() +
    "px; height:" +
    (height / window.devicePixelRatio).toString() +
    "px";

  async function render(t: number) {
    if (!viewport || !context) {
      return;
    }

    if (width <= 0 || height <= 0) {
      return;
    }

    const texture = context.getCurrentTexture();
    const view = texture.createView();

    await viewport.render(view, t);
  }

  function canvasOnMouseDown(event: MouseEvent) {
    viewport.camera.onMouseDown(event);
  }

  function canvasOnMouseUp(event: MouseEvent) {
    viewport.camera.onMouseUp(event);
  }

  function canvasOnMouseOut(event: MouseEvent) {
    
  }

  function canvasOnMouseMove(event: MouseEvent) {
    viewport.camera.onMouseMove(event);
  }

  onMount(() => {
    const resizeObserver = new ResizeObserver((entries) => {
      const entry = entries.at(0);

      if (
        entry instanceof ResizeObserverEntry &&
        entry.devicePixelContentBoxSize
      ) {
        width = entry.devicePixelContentBoxSize[0].inlineSize;
        height = entry.devicePixelContentBoxSize[0].blockSize;

        if (viewport) {
          viewport.resize(width, height);
        }
      }
    });

    resizeObserver.observe(wrapper, { box: "device-pixel-content-box" });

    context = canvas.getContext("webgpu");
    context.configure({
      device: $device,
      format: navigator.gpu.getPreferredCanvasFormat(),
    });

    let frame: number;
    const loop = async (frametime: number) => {
      if (context && $device) {
        await render(frametime);
      }

      frame = requestAnimationFrame(loop);
    };
    frame = requestAnimationFrame(loop);

    return () => {
      resizeObserver.unobserve(canvas);
      cancelAnimationFrame(frame);

      viewport?.deallocate();
    };
  });
</script>

<div bind:this={wrapper} class="wrapper">
  <canvas
    bind:this={canvas}
    {width}
    {height}
    {style}
    on:mousedown={canvasOnMouseDown}
    on:mousemove={canvasOnMouseMove}
    on:mouseup={canvasOnMouseUp}
    on:mouseleave={canvasOnMouseOut}
  />
  {#if viewport}
    <!-- <Sphere {viewport} radius={$configuration.radius} center={[0.0, 0.0, 0.0]} /> -->
    <Sphere
      {viewport}
      radius={0.025}
      center={[0.03, 0.0, 0.0]}
      color={[0.1, 0.4, 0.8, 1.0]}
    />
    <Sphere
      {viewport}
      radius={0.025}
      center={[0.06, 0.0, 0.0]}
      color={[0.4, 0.4, 0.8, 1.0]}
    />
    <Sphere
      {viewport}
      radius={0.025}
      center={[0.09, 0.0, 0.0]}
      color={[0.4, 0.6, 0.3, 1.0]}
    />
  {/if}
</div>

<style>
  .wrapper {
    width: 100%;
    height: 100%;
    top: 0;
    left: 0;
    position: absolute;
  }

  canvas {
    width: 100%;
    height: 100%;
    position: relative;
  }
</style>
