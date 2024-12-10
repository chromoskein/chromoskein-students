import { vec3 } from "gl-matrix";
import * as Graphics from "@chromoskein/lib-graphics";
import type { Viewport3D } from "@chromoskein/lib-graphics";
import type { ClusterNode } from "../../utils/main";
import type { CompositeClusters } from "../compositeClusters";
import { AbstractClusterVisualisation } from "./abstractVisualization";
import type { VisOptions } from "../../utils/data-models";
import { calculateSphereParameters } from "../../utils/abstractClustersUtils";

export class SphereSimplificationClusterVisualisation extends AbstractClusterVisualisation {
    private sphere: Graphics.Sphere;
    private sphereID: number;
    private cluster: ClusterNode;
    private center: vec3 = vec3.fromValues(0, 0, 0);
    private radiusMultiplier: number = 4.0;

    constructor(manager: CompositeClusters, cluster: ClusterNode, viewport: Viewport3D) {
        super(manager, cluster, viewport);

        this.radiusMultiplier = manager.getOptions().abstractionMultiplier;
        [this.sphere, this.sphereID] = viewport.scene.addObject(Graphics.Sphere);
        this.updateCluster(cluster);
        this.setColor(cluster.color);
    }

    
    public updateParameters(options: VisOptions) {
        if (this.radiusMultiplier != options.abstractionMultiplier) {
            this.radiusMultiplier = options.abstractionMultiplier;
            this.updatePoints(this.manager.getPoints(), this.manager.getTimestep());
        }
    }

    public updateCluster(cluster: ClusterNode) {
        this.cluster = cluster;
    }

    public updatePoints(pointsAtTimestep: vec3[][], selectedTimestep: number) {
        let objectPoints = pointsAtTimestep[selectedTimestep].slice(this.cluster.from, this.cluster.to + 1);
        // It is rather inefficient to create an entire axis aligned bounding box
        // just to calculate the mean position of a bunch of points...
        let params = calculateSphereParameters(objectPoints)
        this.sphere.properties.center = [params.center[0], params.center[1], params.center[2]];
        this.center = params.center;
        this.sphere.properties.radius = params.radius / this.radiusMultiplier;

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