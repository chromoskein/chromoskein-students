import { vec3 } from "gl-matrix";
import * as Graphics from "lib-graphics";
import type { Viewport3D } from "lib-graphics";
import type { ClusterNode } from "../../utils/main";
import type { InteractiveClusters } from "../interactiveClusters";
import { AbstractClusterVisualisation } from "./abstractVisualization";
import { lineToSpline } from "../../utils/lineToSpline";

export class SplineClusterVisualisation extends AbstractClusterVisualisation {
    private cluster: ClusterNode;
    private viewport: Viewport3D;
    private spline: Graphics.Spline;
    private splineID: number | null = null;
    private n_instances: number = 0;
    private startPoint: vec3 = vec3.fromValues(0, 0, 0);
    private endPoint: vec3 = vec3.fromValues(0, 0, 0);

    constructor(manager: InteractiveClusters, cluster: ClusterNode, viewport: Viewport3D) {
        super(manager, cluster, viewport);

        this.viewport = viewport;
        this.updateCluster(cluster);
    }

    public updateCluster(cluster: ClusterNode) {
        this.cluster = cluster;
    }

    public updatePoints(pointsAtTimestep: vec3[][], selectedTimestep: number) {
        let clusterPoints = pointsAtTimestep[selectedTimestep].slice(this.cluster.from, this.cluster.to + 1);
        this.startPoint = clusterPoints[0];
        this.endPoint = clusterPoints[clusterPoints.length - 1];

        let spline = lineToSpline(clusterPoints);
        if (this.splineID == null || this.n_instances != spline.length) {
            this.delete(this.viewport);
            [this.spline, this.splineID] = this.viewport.scene.addObjectInstanced(
                Graphics.Spline,
                spline.length
            );
            this.n_instances = spline.length;
            this.setColor(this.cluster.color.rgb);
        }
        
        const radius = 0.06;
        for (let i = 0; i < spline.length / 3; i++) {
            this.spline.properties[i].p0 = [spline[i * 3 + 0][0], spline[i * 3 + 0][1], spline[i * 3 + 0][2], radius];
            this.spline.properties[i].p1 = [spline[i * 3 + 1][0], spline[i * 3 + 1][1], spline[i * 3 + 1][2], radius];
            this.spline.properties[i].p2 = [spline[i * 3 + 2][0], spline[i * 3 + 2][1], spline[i * 3 + 2][2], radius];
      
        }
        this.spline.setDirtyCPU();
    }

    public setColor(color: vec3) {
        this.color = color;
        let c = vec3.copy(vec3.create(), this.color);
        if (this.highlighted) {
            vec3.scale(c, c, 1.8);
        }

        if (this.splineID) {
            for (let i = 0; i < this.n_instances - 1; i++) {
                this.spline.properties[i].color = [c[0], c[1], c[2], 1.0];
            }
            this.spline.setDirtyCPU();
        }
    }

    public rayIntersection(ray: Graphics.Ray): Graphics.Intersection {
        return this.spline.rayIntersection(ray);
    }
    
    public delete(viewport: Graphics.Viewport3D) {
        if (this.splineID) {
            viewport.scene.removeObjectByID(this.splineID);
            
            this.splineID = null;
            this.spline = null;
        }
    }

    public getInConnectionPoint() {
        return this.startPoint;
    }

    public getOutConnectionPoint() {
        return this.endPoint;
    }

    public getConstructor() {
        return SplineClusterVisualisation;
    }
}