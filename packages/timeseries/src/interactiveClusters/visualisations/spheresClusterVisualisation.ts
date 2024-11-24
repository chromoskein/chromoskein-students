import { vec3 } from "gl-matrix";
import * as Graphics from "@chromoskein/lib-graphics";
import type { Viewport3D } from "@chromoskein/lib-graphics";
import type { ClusterNode } from "../../utils/main";
import type { CompositeClusters } from "../compositeClusters";
import { AbstractClusterVisualisation } from "./abstractVisualization";
import { VisOptions } from "../../utils/data-models";

export class SpheresClusterVisualization extends AbstractClusterVisualisation {
    private cluster: ClusterNode;
    private viewport: Viewport3D;
    private spheres: Graphics.Sphere[] = [];
    private sphereIDs: number[] = [];
    private n_instances: number = 0;
    private radius: number = 0.1;
    private startPoint: vec3 = vec3.fromValues(0, 0, 0);
    private endPoint: vec3 = vec3.fromValues(0, 0, 0);

    constructor(manager: CompositeClusters, cluster: ClusterNode, viewport: Viewport3D) {
        super(manager, cluster, viewport);

        this.radius = manager.getOptions().radius;
        this.viewport = viewport;
        this.updateCluster(cluster);
    }


    public updateParameters(options: VisOptions) {
        this.radius = options.radius;
        for (let i = 0; i < this.spheres.length; i++) {
            this.spheres[i].properties.radius = this.radius;    
            this.spheres[i].setDirtyCPU();
        }
    }

    public updateCluster(cluster: ClusterNode) {
        this.cluster = cluster;
    }

    public updatePoints(pointsAtTimestep: vec3[][], selectedTimestep: number) {
        let clusterPoints = pointsAtTimestep[selectedTimestep].slice(this.cluster.from, this.cluster.to + 1);
        this.startPoint = clusterPoints[0];
        this.endPoint = clusterPoints[clusterPoints.length - 1];

        if (this.sphereIDs.length == 0 || this.n_instances != clusterPoints.length) {
            this.delete(this.viewport);
            for (let _ of clusterPoints) {
                let sphere;
                let sphereID;
                [sphere, sphereID] = this.viewport.scene.addObject(Graphics.Sphere);
                this.spheres.push(sphere);
                this.sphereIDs.push(sphereID);
            }
            this.n_instances = clusterPoints.length;
            this.setColor(this.cluster.color.rgb);
        }

        for (let i = 0; i < clusterPoints.length; i++) {
            this.spheres[i].properties.center = [clusterPoints[i][0], clusterPoints[i][1], clusterPoints[i][2]];
            this.spheres[i].properties.radius = this.radius;    
            this.spheres[i].setDirtyCPU();
        }
    }

    public setColor(color: vec3) {
        this.color = color;
        let c = vec3.copy(vec3.create(), this.color);
        if (this.highlighted) {
            vec3.scale(c, c, 1.8);
        }

        for (let i = 0; i < this.spheres.length; i++) {
            this.spheres[i].properties.color = [c[0], c[1], c[2], 1.0];
            
            this.spheres[i].setDirtyCPU(); 
        }
    }

    public rayIntersection(ray: Graphics.Ray): Graphics.Intersection {
        let bestT = Infinity
        let bestIntersection = null;
        for (let object of this.spheres) {
            let intersection = object.rayIntersection(ray);
            if (intersection != null && intersection.t < bestT) {
                bestT = intersection.t;
                bestIntersection = intersection;
            }
        }

        return bestIntersection;
    }
    
    public delete(viewport: Graphics.Viewport3D) {
        for (let sphereID of this.sphereIDs) {
            viewport.scene.removeObjectByID(sphereID);
        }
        this.spheres = [];
        this.sphereIDs = [];
    }

    public getInConnectionPoint() {
        return this.startPoint;
    }

    public getOutConnectionPoint() {
        return this.endPoint;
    }

    public getConstructor() {
        return SpheresClusterVisualization;
    }
}