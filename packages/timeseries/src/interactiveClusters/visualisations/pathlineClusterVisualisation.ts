import { vec3 } from "gl-matrix";
import * as Graphics from "lib-graphics";
import type { Viewport3D } from "lib-graphics";
import type { ClusterNode } from "../../utils/main";
import type { InteractiveClusters } from "../interactiveClusters";
import { AbstractClusterVisualisation } from "./abstractVisualization";

export class PathlineClusterVisualization extends AbstractClusterVisualisation {
    private cluster: ClusterNode;
    private viewport: Viewport3D;
    private pathline: Graphics.RoundedConeInstanced;
    private pathlineID: number | null = null;
    private n_instances: number = 0;
    private startPoint: vec3 = vec3.fromValues(0, 0, 0);
    private endPoint: vec3 = vec3.fromValues(0, 0, 0);

    constructor(manager: InteractiveClusters, points: vec3[], cluster: ClusterNode, viewport: Viewport3D) {
        super(manager, points, cluster, viewport);

        this.viewport = viewport;
        this.updateCluster(cluster);
    }

    public updateCluster(cluster: ClusterNode) {
        this.cluster = cluster;
    }

    public updatePoints(points: vec3[]) {
        let clusterPoints = points.slice(this.cluster.from, this.cluster.to + 1);
        this.startPoint = clusterPoints[0];
        this.endPoint = clusterPoints[clusterPoints.length - 1];

        if (this.pathlineID == null || this.n_instances != clusterPoints.length) {
            this.delete(this.viewport);
            [this.pathline, this.pathlineID] = this.viewport.scene.addObjectInstanced(
                Graphics.RoundedConeInstanced,
                clusterPoints.length
            );
            this.n_instances = clusterPoints.length;
            this.setColor(this.cluster.color.rgb);
        }

        for (let i = 0; i < clusterPoints.length - 1; i++) {
            this.pathline.properties[i].start = [clusterPoints[i][0], clusterPoints[i][1], clusterPoints[i][2]];
            this.pathline.properties[i].end = [
                clusterPoints[i + 1][0],
                clusterPoints[i + 1][1],
                clusterPoints[i + 1][2],
            ];
      
            this.pathline.properties[i].startRadius = 0.04;
            this.pathline.properties[i].endRadius = 0.04;
      
          }
          this.pathline.setDirtyCPU();
    }

    public setColor(color: vec3) {
        if (this.pathlineID) {
            for (let i = 0; i < this.n_instances - 1; i++) {
                this.pathline.properties[i].startColor = [color[0], color[1], color[2], 1.0];
                this.pathline.properties[i].endColor = [color[0], color[1], color[2], 1.0];
            }
            this.pathline.setDirtyCPU();
        }
    }

    public rayIntersection(ray: Graphics.Ray): Graphics.Intersection {
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