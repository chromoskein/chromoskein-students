import { vec3 } from "gl-matrix";
import * as Graphics from "lib-graphics";
import type { Viewport3D } from "lib-graphics";
import type { ClusterNode } from "../../utils/main";
import type { CompositeClusters } from "../interactiveClusters";
import { AbstractClusterVisualisation } from "./abstractVisualization";

export class SphereSimplificationClusterVisualisation extends AbstractClusterVisualisation {
    private sphere: Graphics.Sphere;
    private sphereID: number;
    private cluster: ClusterNode;
    private center: vec3 = vec3.fromValues(0, 0, 0);

    constructor(manager: CompositeClusters, cluster: ClusterNode, viewport: Viewport3D) {
        super(manager, cluster, viewport);

        [this.sphere, this.sphereID] = viewport.scene.addObject(Graphics.Sphere);
        this.updateCluster(cluster);
        this.setColor(cluster.color.rgb);
    }

    public updateCluster(cluster: ClusterNode) {
        this.cluster = cluster;
    }

    public updatePoints(pointsAtTimestep: vec3[][], selectedTimestep: number) {
        let objectPoints = pointsAtTimestep[selectedTimestep].slice(this.cluster.from, this.cluster.to + 1);
        // It is rather inefficient to create an entire axis aligned bounding box
        // just to calculate the mean position of a bunch of points...
        let bb = Graphics.boundingBoxFromPoints(objectPoints);
        this.sphere.properties.center = [bb.center[0], bb.center[1], bb.center[2]];
        this.center = bb.center;
        this.sphere.properties.radius = objectPoints.length / 1000.0 * 2;

        this.sphere.setDirtyCPU();
    }

    public setColor(color: vec3) {
        this.color = color;
        let c = vec3.copy(vec3.create(), this.color);
        if (this.highlighted) {
            vec3.scale(c, c, 1.8);
        }

        this.sphere.properties.color = [c[0], c[1], c[2], 1];
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

    public getInConnectionPoint() {
        return this.center;
    }

    public getOutConnectionPoint() {
        return this.center;
    }

    public getConstructor() {
        return SphereSimplificationClusterVisualisation;
    }
}