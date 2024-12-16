import { vec3 } from "gl-matrix";
import * as Graphics from "@chromoskein/lib-graphics";
import type { Viewport3D } from "@chromoskein/lib-graphics";
import type { ClusterNode } from "../../utils/main";
import type { CompositeClusters } from "../compositeClusters";
import { AbstractClusterVisualisation } from "./abstractVisualization";
import type { VisOptions } from "../../utils/data-models";

export class PathlineClusterVisualization extends AbstractClusterVisualisation {
    private cluster: ClusterNode;
    private viewport: Viewport3D;
    private pathline: Graphics.RoundedConeInstanced;
    private pathlineID: number | null = null;
    private n_instances: number = 0;
    private startPoint: vec3 = vec3.fromValues(0, 0, 0);
    private endPoint: vec3 = vec3.fromValues(0, 0, 0);
    private radius: number = 0.2;


    constructor(manager: CompositeClusters, cluster: ClusterNode, viewport: Viewport3D) {
        super(manager, cluster, viewport);

        this.viewport = viewport;
        this.radius = manager.getOptions().radius;
        this.updateCluster(cluster);
    }

    public updateCluster(cluster: ClusterNode) {
        this.cluster = cluster;
    }

    public updateParameters(options: VisOptions) {
        this.radius = options.radius;
        for (let i = 0; i < this.pathline.properties.length - 1; i++) {
            this.pathline.properties[i].startRadius = this.radius;
            this.pathline.properties[i].endRadius = this.radius;
          }
          this.pathline.setDirtyCPU();
    }

    public updatePoints(pointsAtTimestep: vec3[][], selectedTimestep: number) {
        let clusterPoints = pointsAtTimestep[selectedTimestep].slice(this.cluster.from, this.cluster.to + 1);
        this.startPoint = clusterPoints[0];
        this.endPoint = clusterPoints[clusterPoints.length - 1];

        if (this.pathlineID == null || this.n_instances != clusterPoints.length) {
            this.delete(this.viewport);
            [this.pathline, this.pathlineID] = this.viewport.scene.addObjectInstanced(
                Graphics.RoundedConeInstanced,
                clusterPoints.length
            );
            this.n_instances = clusterPoints.length;
            this.setColor(this.cluster.color);
        }

        for (let i = 0; i < clusterPoints.length - 1; i++) {
            this.pathline.properties[i].start = [clusterPoints[i][0], clusterPoints[i][1], clusterPoints[i][2]];
            this.pathline.properties[i].end = [
                clusterPoints[i + 1][0],
                clusterPoints[i + 1][1],
                clusterPoints[i + 1][2],
            ];
      
            this.pathline.properties[i].startRadius = this.radius;
            this.pathline.properties[i].endRadius = this.radius;
      
          }
          this.pathline.setDirtyCPU();
    }

    public setColor(color: vec3) {
        this.color = color;
        let c = vec3.copy(vec3.create(), this.color);
        if (this.highlighted) {
            vec3.scale(c, c, 1.8);
        }

        if (this.pathlineID) {
            for (let i = 0; i < this.n_instances - 1; i++) {
                this.pathline.properties[i].startColor = [c[0], c[1], c[2], 1.0];
                this.pathline.properties[i].endColor = [c[0], c[1], c[2], 1.0];
            }
            this.pathline.setDirtyCPU();
        }
    }

    public rayIntersection(ray: Graphics.Ray): Graphics.Intersection | null {
        return this.pathline.rayIntersection(ray);
    }
    
    public delete(viewport: Graphics.Viewport3D) {
        if (this.pathlineID) {
            viewport.scene.removeObjectByID(this.pathlineID);
            
            this.pathlineID = null;
            this.pathline = null;
        }
    }

    public getInConnectionPoint() {
        return this.startPoint;
    }

    public getOutConnectionPoint() {
        return this.endPoint;
    }

    public getConstructor() {
        return PathlineClusterVisualization;
    }
}