<script lang="ts">
  import { onMount } from "svelte";
  import * as Graphics from "lib-graphics";

  export let viewport: Graphics.Viewport3D;
  export let radius = 0.3;
  export let center: [number, number, number] = [0.0, 0.0, 0.0];
  export let color: [number, number, number, number] = [1.0, 1.0, 1.0, 1.0];

  let object: Graphics.Sphere;
  let objectID: number;

  $: if (object) {
    object.properties.radius = radius;
    object.properties.center = center;
    object.properties.color = color;
    object.setDirtyCPU();
  }

  onMount(() => {
    if (viewport.scene) {
      [object, objectID] = viewport.scene.addObject(Graphics.Sphere);

      object.properties.radius = radius;
      object.properties.center = center;
      object.properties.color = color;
      object.setDirtyCPU();
    }

    return () => {
      if (viewport?.scene) {
        viewport.scene.removeObjectByID(objectID);
      }
    };
  });
</script>
