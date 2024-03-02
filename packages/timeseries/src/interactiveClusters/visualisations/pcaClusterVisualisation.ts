import { vec3 } from "gl-matrix";
import * as Graphics from "lib-graphics";
import type { Viewport3D } from "lib-graphics";
import type { ClusterNode } from "../../utils/main";
import type { InteractiveClusters } from "../interactiveClusters";
import { AbstractClusterVisualisation } from "./abstractVisualization";
import { blobFromPoints } from "../../utils/main";
import PCA from 'pca-js';

export class PCAClusterVisualisation extends AbstractClusterVisualisation {
    private cluster: ClusterNode;
    private coneUp: Graphics.RoundedCone;
    private coneUpID: number | null = null;
    private coneDown: Graphics.RoundedCone;
    private coneDownID: number | null = null;
    private center: vec3 = vec3.fromValues(0, 0, 0);

    constructor(manager: InteractiveClusters, points: vec3[], cluster: ClusterNode, viewport: Viewport3D) {
        super(manager, points, cluster, viewport);

        [this.coneUp, this.coneUpID] = viewport.scene.addObject(Graphics.RoundedCone);
        this.coneUp.setDirtyCPU();
  
        [this.coneDown, this.coneDownID] = viewport.scene.addObject(Graphics.RoundedCone);
        this.coneDown.setDirtyCPU();

        this.updateCluster(cluster);
        this.setColor(cluster.color.rgb);
    }

    public updateCluster(cluster: ClusterNode) {
        this.cluster = cluster;
    }

    public updatePoints(points: vec3[]) {
        let blob = blobFromPoints(points.slice(this.cluster.from, this.cluster.to + 1))
        let result = PCA.getEigenVectors(blob.normalizedPoints);
        this.center = blob.center;
       
        const coneHeight = result[0].eigenvalue / 40.0 + 0.1;
        const coneOrientation = vec3.fromValues(result[0].vector[0], result[0].vector[1], result[0].vector[2]);
        const coneStartRadius = result[1].eigenvalue / 40.0 + 0.1;

        this.coneUp.properties.start = [blob.center[0], blob.center[1], blob.center[2]];
        this.coneUp.properties.end = [
            blob.center[0] + coneHeight * coneOrientation[0],
            blob.center[1] + coneHeight * coneOrientation[1],
            blob.center[2] + coneHeight * coneOrientation[2],
        ];
        this.coneUp.properties.startRadius = coneStartRadius;
        this.coneUp.properties.endRadius = 0.0001;
        this.coneUp.setDirtyCPU();
  
        this.coneDown.properties.start = [blob.center[0], blob.center[1], blob.center[2]];
        this.coneDown.properties.end = [
            blob.center[0] - coneHeight * coneOrientation[0],
            blob.center[1] - coneHeight * coneOrientation[1],
            blob.center[2] - coneHeight * coneOrientation[2],
        ];
        this.coneDown.properties.startRadius = coneStartRadius;
        this.coneDown.properties.endRadius = 0.0001;
        this.coneDown.setDirtyCPU();
    }

    public setColor(color: vec3) {
        if (this.coneDownID && this.coneUpID) {
            this.coneUp.properties.color = [color[0], color[1], color[2], 1.0];
            this.coneDown.properties.color = [color[0], color[1], color[2], 1.0];
            this.coneUp.setDirtyCPU();
            this.coneDown.setDirtyCPU();
        }
    }

    public rayIntersection(ray: Graphics.Ray): Graphics.Intersection {
        let upIntersection = this.coneDown.rayIntersection(ray);
        let downIntersection = this.coneUp.rayIntersection(ray);

        if (upIntersection == null && downIntersection == null) {
            return null;
        }
        
        return (downIntersection == null || upIntersection.t < downIntersection.t) ? upIntersection : downIntersection;
    }
    
    public delete(viewport: Graphics.Viewport3D) {
        if (this.coneDownID && this.coneUpID) {
            viewport.scene.removeObjectByID(this.coneUpID);
            viewport.scene.removeObjectByID(this.coneDownID);
            
            this.coneDownID = null;
            this.coneDown = null;
            this.coneUpID = null;
            this.coneUp = null;
        }
    }

    public getInConnectionPoint() {
        return this.center;
    }

    public getOutConnectionPoint() {
        return this.center;
    }

    public getConstructor() {
        return PCAClusterVisualisation;
    }
}