<script lang="ts">
    import { getContext, onMount, setContext } from "svelte";
    import { writable, type Writable } from "svelte/store";
    import type * as Graphics from "lib-graphics";
  
    // Context
    let device: Writable<GPUDevice> = getContext("device");
    let graphicsLibrary: Writable<Graphics.GraphicsLibrary> =
      getContext("graphicsLibrary");
  
    let context: GPUCanvasContext | null = null;
    let viewportInner: Writable<Graphics.DistanceViewport | null> = writable(null);
    
    export let viewport = $viewportInner;
    //export let afterCameraUpdate = (camera: Graphics.OrbitCamera) => {};
  
    $: if ($viewportInner) {
      viewport = $viewportInner;
    }
  
    setContext("viewport", viewportInner);
  
    $: {
      if ($viewportInner) {
        $viewportInner.deallocate();
      }
  
      if ($graphicsLibrary) {
        $viewportInner = $graphicsLibrary.create2DViewport();
        //afterCameraUpdate($viewportInner.camera as Graphics.OrbitCamera);
      }
    }
  
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
      if (!$viewportInner || !context) {
        return;
      }
  
      if (width <= 0 || height <= 0) {
        return;
      }
  
      const texture = context.getCurrentTexture();
      const view = texture.createView();
  
      await $viewportInner.render(view);
    }
  
    function canvasOnMouseDown(event: MouseEvent) {
      if (!$viewportInner) return;
  
      $viewportInner.camera.onMouseDown(event);
  
      //afterCameraUpdate($viewportInner.camera as Graphics.OrbitCamera);
    }
  
    function canvasOnMouseUp(event: MouseEvent) {
      if (!$viewportInner) return;
  
      $viewportInner.camera.onMouseUp(event);
  
      //afterCameraUpdate($viewportInner.camera as Graphics.OrbitCamera);
    }
  
    function canvasOnMouseOut(event: MouseEvent) {}
  
    function canvasOnMouseMove(event: MouseEvent) {
      if (!$viewportInner) return;
  
      $viewportInner.camera.onMouseMove(event);
  
      //afterCameraUpdate($viewportInner.camera as Graphics.OrbitCamera);
    }
  
    function canvasOnScroll(event: WheelEvent) {
      if (!$viewportInner) return;
  
      $viewportInner.camera.onWheelEvent(event);
  
      //afterCameraUpdate($viewportInner.camera as Graphics.OrbitCamera);
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
  
          if ($viewportInner) {
            $viewportInner.resize(width, height);
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
  
        if ($viewportInner) {
          $viewportInner.deallocate();
        }
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
      on:wheel={canvasOnScroll}
    />
    {#if $device && $viewportInner}
      <slot />
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
  