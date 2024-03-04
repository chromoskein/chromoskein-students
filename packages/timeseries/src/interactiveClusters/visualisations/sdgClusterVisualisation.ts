import { vec3 } from "gl-matrix";
import * as Graphics from "lib-graphics";
import type { Viewport3D } from "lib-graphics";
import type { ClusterNode } from "../../utils/main";
import type { InteractiveClusters } from "../interactiveClusters";
import { AbstractClusterVisualisation } from "./abstractVisualization";
import { blobFromPoints } from "../../utils/main";

export class SDGClusterVisualisation extends AbstractClusterVisualisation {
    private cluster: ClusterNode;
    private sdgObject: Graphics.SignedDistanceGrid;
    private sdgObjectID: number | null = null;
    private startPoint: vec3 = vec3.fromValues(0, 0, 0);
    private endPoint: vec3 = vec3.fromValues(0, 0, 0);

    constructor(manager: InteractiveClusters, points: vec3[], cluster: ClusterNode, viewport: Viewport3D) {
        super(manager, points, cluster, viewport);

        [this.sdgObject, this.sdgObjectID] = viewport.scene.addObject(Graphics.SignedDistanceGrid);
        this.sdgObject.setDirtyCPU();

        this.updateCluster(cluster);
        this.setColor(cluster.color.rgb);
    }

    public updateCluster(cluster: ClusterNode) {
        this.cluster = cluster;
    }

    public updatePoints(points: vec3[]) {
        let clusterPoints = points.slice(this.cluster.from, this.cluster.to + 1);
        this.startPoint = clusterPoints[0];
        this.endPoint = clusterPoints[clusterPoints.length - 1];
        
        let blob = blobFromPoints(clusterPoints)
        this.sdgObject.translate([blob.center[0], blob.center[1], blob.center[2]], 0);
        this.sdgObject.scale(blob.scale, 0);
        this.sdgObject.fromPoints(this.manager.getDevice(), [blob.normalizedPoints], [0.03]);
        this.sdgObject.setDirtyCPU();
    }

    public setColor(color: vec3) {
        this.color = color;
        let c = vec3.copy(vec3.create(), this.color);
        if (this.highlighted) {
            vec3.scale(c, c, 1.8);
        }

        if (this.sdgObjectID) {
            this.sdgObject.properties[0].color = [c[0], c[1], c[2], 1.0];
            this.sdgObject.setDirtyCPU();
        }
    }

    public rayIntersection(ray: Graphics.Ray): Graphics.Intersection {
        return this.sdgObject.rayIntersection(ray);
    }
    
    public delete(viewport: Graphics.Viewport3D) {
        if (this.sdgObjectID) {
            viewport.scene.removeObjectByID(this.sdgObjectID);
            
            this.sdgObjectID = null;
            this.sdgObject = null;
        }
    }

    public getInConnectionPoint() {
        return this.startPoint;
    }

    public getOutConnectionPoint() {
        return this.endPoint;
    }

    public getConstructor() {
        return SDGClusterVisualisation;
    }

}