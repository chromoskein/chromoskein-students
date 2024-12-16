<script lang="ts">
  import { getContext, onMount, setContext } from "svelte";
  import { writable, type Writable } from "svelte/store";
  import type * as Graphics from "@chromoskein/lib-graphics";

  // Context
  let device: Writable<GPUDevice> = getContext("device");
  let graphicsLibrary: Writable<Graphics.GraphicsLibrary> =
    getContext("graphicsLibrary");

  let context: GPUCanvasContext | null = null;
  let viewportInner: Writable<Graphics.Viewport3D | null> = writable(null);
  
  export let viewport = $viewportInner;
  export let afterCameraUpdate = (camera: Graphics.OrbitCamera) => {};
  export let clearColor = { r: 1.0, g: 1.0, b: 1.0, a: 1.0 }

  $: $viewportInner?.setClearColor(clearColor);

  $: if ($viewportInner) {
    viewport = $viewportInner;
  }

  setContext("viewport", viewportInner);

  $: {
    if ($viewportInner) {
      $viewportInner.deallocate();
    }

    if ($graphicsLibrary) {
      $viewportInner = $graphicsLibrary.create3DViewport();
      $viewportInner.setClearColor({ r: 1.0, g: 1.0, b: 1.0, a: 1.0 })
      afterCameraUpdate($viewportInner.camera as Graphics.OrbitCamera);
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

    await $viewportInner.render(view, t);
  }

  function canvasOnMouseDown(event: MouseEvent) {
    if (!$viewportInner) return;

    $viewportInner.camera?.onMouseDown(event);

    /*
    let rect = canvas.getBoundingClientRect(); // abs. size of element    
    let ray = Graphics.screenSpaceToRay(vec2.fromValues((event.clientX - rect.left) / rect.width, (event.clientY - rect.top) / rect.height), $viewportInner.camera);
    let intersect = $viewportInner.scene.rayIntersection(ray);

    console.log(intersect[0]);
    if (intersect[0] instanceof Graphics.Sphere) {
      let sphere = intersect[0] as Graphics.Sphere;
      sphere.properties.color = [1.0, 1.0, 1.0, 1.0];
      sphere.setDirtyCPU();
    }
    */
    afterCameraUpdate($viewportInner.camera as Graphics.OrbitCamera);
  }

  function canvasOnMouseUp(event: MouseEvent) {
    if (!$viewportInner) return;

    $viewportInner.camera?.onMouseUp(event);

    afterCameraUpdate($viewportInner.camera as Graphics.OrbitCamera);
  }

  function canvasOnMouseOut(event: MouseEvent) {}

  function canvasOnMouseMove(event: MouseEvent) {
    if (!$viewportInner) return;

    $viewportInner.camera?.onMouseMove(event);

    afterCameraUpdate($viewportInner.camera as Graphics.OrbitCamera);
  }

  function canvasOnScroll(event: WheelEvent) {
    if (!$viewportInner) return;

    $viewportInner.camera?.onWheelEvent(event);

    afterCameraUpdate($viewportInner.camera as Graphics.OrbitCamera);
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
    context?.configure({
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
  <canvas id="canvas"
    bind:this={canvas}
    {width}
    {height}
    {style}
    on:mousedown={canvasOnMouseDown}
    on:mousemove={canvasOnMouseMove}
    on:mouseup={canvasOnMouseUp}
    on:mouseleave={canvasOnMouseOut}
    on:wheel={canvasOnScroll}
  > </canvas>
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
