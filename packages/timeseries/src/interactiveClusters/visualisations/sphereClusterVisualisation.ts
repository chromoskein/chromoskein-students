import type { vec3 } from "gl-matrix";
import * as Graphics from "lib-graphics";
import type { Viewport3D } from "lib-graphics";
import type { ClusterNode } from "../../utils/main";
import type { InteractiveClusters } from "../interactiveClusters";
import { AbstractClusterVisualisation } from "./abstractVisualization";

export class SphereClusterVisualisation extends AbstractClusterVisualisation {
    private sphere: Graphics.Sphere;
    private sphereID: number;
    private cluster: ClusterNode;

    constructor(manager: InteractiveClusters, points: vec3[], cluster: ClusterNode, viewport: Viewport3D) {
        super(manager, points, cluster, viewport);

        [this.sphere, this.sphereID] = viewport.scene.addObject(Graphics.Sphere);
        this.updateCluster(cluster);
        this.setColor(cluster.color.rgb);
    }

    public updateCluster(cluster: ClusterNode) {
        this.cluster = cluster;
    }

    public updatePoints(points: vec3[]) {
        let objectPoints = points.slice(this.cluster.from, this.cluster.to + 1);
        // It is rather inefficient to create an entire axis aligned bounding box
        // just to calculate the mean position of a bunch of points...
        let bb = Graphics.boundingBoxFromPoints(objectPoints);
        this.sphere.properties.center = [bb.center[0], bb.center[1], bb.center[2]];
        this.center = bb.center;
        this.sphere.properties.radius = objectPoints.length / 1000.0 * 2;

        this.sphere.setDirtyCPU();
    }

    public setColor(color: vec3) {
        this.sphere.properties.color = [color[0], color[1], color[2], 1];
        this.sphere.setDirtyCPU();
    }

    public rayIntersection(ray: Graphics.Ray): Graphics.Intersection {
        return this.sphere.rayIntersection(ray);
    }
    
    public delete(viewport: Graphics.Viewport3D) {
        viewport.scene.removeObjectByID(this.sphereID);
        this.sphereID = null;
        this.sphere = null;
    }

    public getConstructor() {
        return SphereClusterVisualisation;
    }
}