<script lang="ts">
  import { getContext, onMount } from "svelte";
  import * as Graphics from "@chromoskein/lib-graphics";
  import type { Writable } from "svelte/store";
  import type { Viewport3D } from "@chromoskein/lib-graphics";
  import { vec3 } from "gl-matrix";

  let viewport: Writable<Viewport3D | null> = getContext("viewport");

  interface HullProps {
    points: vec3[],
    color: vec3,
  }

  let {  
      points = [],
      color = vec3.fromValues(1.0, 1.0, 1.0),
  }: HullProps = $props();

  let [object, objectID]: [Graphics.Mesh | null, number | null] = [null, null];
  $effect(() => {
    if ($viewport && $viewport.scene) {
        if (objectID != null) {
            $viewport.scene.removeObjectByID(objectID);
        }
        [object, objectID] = $viewport.scene.addMesh(Graphics.Mesh, 4)
        object.vertices = tetrahedron;
        object.color = [color[0], color[1], color[2], 1.0];
        object.setDirtyCPU()
        //[object, objectID] = $viewport.scene.addObjectInstanced(Graphics.RoundedConeInstanced, points.length * 3);
    }
  })

  //$effect(() => { if (object && points) {
  //  object.setDirtyCPU();
  //}});

  onMount(() => {
    console.log("Creating crosses object")
    return () => {
      if (viewport && $viewport?.scene && objectID != null) {
        $viewport.scene.removeObjectByID(objectID);
      }
    };
  });


    const tetrahedron: Graphics.Vertex[] = [
        {
            position: [ 0.115470,  0.115470,  0.115470, 1 ],
            normal:   [-0.577350, -0.577350, -0.577350, 0 ],
        },
        {
            position: [ 0.115470, -0.115470, -0.115470, 1 ],
            normal:   [-0.577350, -0.577350, -0.577350, 0 ],
        },
        {
            position: [-0.115470,  0.115470, -0.115470, 1 ],
            normal:   [-0.577350, -0.577350, -0.577350, 0 ],
        },

        // Face 2
        {
            position: [ 0.115470,  0.115470,  0.115470, 1 ],
            normal:   [-0.577350,  0.577350,  0.577350, 0 ],
        },
        {
            position: [-0.115470,  0.115470, -0.115470, 1 ],
            normal:   [-0.577350,  0.577350,  0.577350, 0 ],
        },
        {
            position: [-0.115470, -0.115470,  0.115470, 1 ],
            normal:   [-0.577350,  0.577350,  0.577350, 0 ],
        },

        // Face 3
        {
            position: [ 0.115470,  0.115470,  0.115470, 1 ],
            normal:   [ 0.577350, -0.577350,  0.577350, 0 ],
        },
        {
            position: [-0.115470, -0.115470,  0.115470, 1 ],
            normal:   [ 0.577350, -0.577350,  0.577350, 0 ],
        },
        {
            position: [ 0.115470, -0.115470, -0.115470, 1 ],
            normal:   [ 0.577350, -0.577350, 0.577350, 0 ],
        },

        // Face 4
        {
            position: [ 0.115470, -0.115470, -0.115470, 1 ],
            normal:   [ 0.577350, 0.577350, -0.577350, 0 ],
        },
        {
            position: [-0.115470, -0.115470,  0.115470, 1 ],
            normal:   [ 0.577350, 0.577350, -0.577350, 0 ],
        },
        {
            position: [-0.115470,  0.115470, -0.115470, 1 ],
            normal:   [ 0.577350, 0.577350, -0.577350, 0 ],
        },
    ];
</script>
