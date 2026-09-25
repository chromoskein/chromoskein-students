<script lang="ts">
  import { getContext, onMount } from "svelte";
  import * as Graphics from "@chromoskein/lib-graphics";
  import type { Writable } from "svelte/store";
  import type { Viewport3D } from "@chromoskein/lib-graphics";
  import { vec3 } from "gl-matrix";
  import { convexHull } from "../utils/convexHull3D";

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
  // A mesh fixes how many triangles it owns when it is constructed, so the hull has to be known
  // before one is allocated and the mesh replaced whenever that count changes.
  let allocatedTriangles: number | null = null;

  $effect(() => {
    if ($viewport && $viewport.scene) {
        if (objectID != null) {
            $viewport.scene.removeObjectByID(objectID);
        }
        [object, objectID] = $viewport.scene.addMesh(Graphics.Mesh, 4)
        object.vertices = tetrahedron;
        object.color = [color[0], color[1], color[2], 1.0];
        object.setDirtyCPU()
        allocatedTriangles = 4;
    }
  })

  $effect(() => { if (points && $viewport?.scene) {
      const scene = $viewport.scene;

      const hull = convexHull(points);
      const triangles = hull.length / 3;

      // Points that do not span a volume have no hull, so draw nothing rather than leave the
      // placeholder behind. The guard above deliberately does not test object, otherwise clearing
      // it here would stop this effect from ever bringing the hull back.
      if (triangles === 0) {
          if (objectID != null) {
              scene.removeObjectByID(objectID);
          }

          object = null;
          objectID = null;
          allocatedTriangles = null;
          return;
      }

      let mesh = object;
      if (mesh == null || objectID == null || triangles !== allocatedTriangles) {
          if (objectID != null) {
              scene.removeObjectByID(objectID);
          }

          [mesh, objectID] = scene.addMesh(Graphics.Mesh, triangles);
          object = mesh;
          allocatedTriangles = triangles;
      }

      mesh.vertices = hull;
      mesh.color = [color[0], color[1], color[2], 1.0];
      mesh.setDirtyCPU();
  }});

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
