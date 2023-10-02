<script lang="ts">
  import { getContext, onMount } from "svelte";
  import type { Writable } from "svelte/store";
  import * as Graphics from "lib-graphics";
  import type { Configuration3D } from "../storage/storage";
    import { SmoothCamera } from "lib-graphics";
import { vec3} from "gl-matrix";
  import { parsePdb, type ChromatinModel} from "lib-dataloader";

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
      // viewport = $graphicsLibrary.create3DViewport(null, new SmoothCamera($device, width, height));
      viewport.clearColor = { r: 0.0, g: 0.0, b: 0.0, a: 1.0 };
      // viewport.camera = new SmoothCamera($device, width, height);
    }
  }

  let wrapper: HTMLDivElement;
  let canvas: HTMLCanvasElement;

  let width = 800;
  let height = 600;

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

  function canvasOnWheel(event: WheelEvent) {
    viewport.camera.onWheelEvent(event);
  }

  onMount(async () => {
    const resizeObserver = new ResizeObserver((entries) => {
      const entry = entries.at(0);

      if (
        entry instanceof ResizeObserverEntry &&
        entry.devicePixelContentBoxSize
      ) {
        width = entry.devicePixelContentBoxSize[0].inlineSize;
        height = entry.devicePixelContentBoxSize[0].blockSize;

        console.log("resize");
        if (viewport) {
          viewport.resize(width, height);
        }
      }
    });

    resizeObserver.observe(wrapper, { box: "device-pixel-content-box" });

    context = canvas.getContext("webgpu");
    if (!context) {
      return;
    }

    context.configure({
      device: $device,
      format: navigator.gpu.getPreferredCanvasFormat(),
    });


    const response = await (
      await await fetch("./cell7_3dmodel_renamed.pdb")
    ).text();
    const pdb: ChromatinModel = parsePdb(response);

    console.log(response);
    console.log(pdb);

    //~ Spheres
    // for (let bin of pdb.bins) {
    //   const [object, objectID] = viewport.scene.addObject(Graphics.Sphere);
    //   object.properties.center = [bin.x, bin.y, bin.z];
    //   object.properties.radius = 0.2;
    //   object.properties.color = [1.0, 1.0, 1.0, 1.0];
    // }

    //~ RoundedCones
    // for (let bin of pdb.bins) {
    for (let i = 0; i < pdb.bins.length - 1; i++) {
      const bin = pdb.bins[i];
      const next = pdb.bins[i+1];
      const [object, objectID] = viewport.scene.addObject(Graphics.RoundedCone);
      object.properties.startRadius = 0.2;
      object.properties.endRadius = 0.2;
      object.properties.start = [
        bin.x,
        bin.y,
        bin.z 
      ];
      object.properties.end = [
       next.x, 
       next.y, 
       next.z
      ];
      object.properties.radius = 0.5;
      object.properties.color = [1.0, 1.0, 1.0, 1.0];
    }


    //~ just testing stuff:
    const [object, objectID] = viewport.scene.addObject(Graphics.Sphere);
    object.properties.center = [0, 0, 0];
    object.properties.radius = 1.0;
    object.properties.color = [1.0, 1.0, 1.0, 1.0];
    object.setDirtyCPU();
    // const [object, objectID] = viewport.scene.addObject(Graphics.Circle);
    //     object.properties.center = [
    //       0, 
    //       0, 
    //       0
    //     ];
    //     object.properties.radius = 1.0;

    //     object.properties.color = [1.0, 1.0, 1.0, 1.0];
    //     object.setDirtyCPU();

    // if (viewport.camera instanceof SmoothCamera) {
    //   viewport.camera.position = vec3.fromValues(0.0, 0.0, -5.0);
    //   viewport.camera.orbitingPivot = vec3.fromValues(0, 0, 0);
    // }

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
    on:wheel|passive={canvasOnWheel}
  />
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