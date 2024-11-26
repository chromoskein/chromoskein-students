import { vec3 } from "gl-matrix";
import * as Graphics from "@chromoskein/lib-graphics";
import type { Viewport3D } from "@chromoskein/lib-graphics";
import type { ClusterBlob, ClusterNode } from "../../utils/main";
import type { CompositeClusters } from "../compositeClusters";
import { AbstractClusterVisualisation } from "./abstractVisualization";
import { blobFromPoints } from "../../utils/main";
import PCA from 'pca-js';
import type { VisOptions } from "../../utils/data-models";
import { calculateSphereParameters } from "../../utils/abstractClustersUtils";

export class PCAClusterVisualisation extends AbstractClusterVisualisation {
    private cluster: ClusterNode;
    private coneUp: Graphics.RoundedCone;
    private coneUpID: number | null = null;
    private coneDown: Graphics.RoundedCone;
    private coneDownID: number | null = null;
    private center: vec3 = vec3.fromValues(0, 0, 0);

    constructor(manager: CompositeClusters, cluster: ClusterNode, viewport: Viewport3D) {
        super(manager, cluster, viewport);

        [this.coneUp, this.coneUpID] = viewport.scene.addObject(Graphics.RoundedCone);
        this.coneUp.setDirtyCPU();
  
        [this.coneDown, this.coneDownID] = viewport.scene.addObject(Graphics.RoundedCone);
        this.coneDown.setDirtyCPU();

        this.updateCluster(cluster);
        this.setColor(cluster.color.rgb);
    }

    public updateParameters(options: VisOptions) {
        // Do nothing 
    }

    public updateCluster(cluster: ClusterNode) {
        this.cluster = cluster;
    }

    public updatePoints(pointsAtTimestep: vec3[][], selectedTimestep: number) {
        let points: vec3[] = pointsAtTimestep[selectedTimestep].slice(this.cluster.from, this.cluster.to + 1);
        let blob: ClusterBlob = blobFromPoints(points);
        this.center = calculateSphereParameters(points).center;

        let result = PCA.getEigenVectors(blob.normalizedPoints);
        let firstPCVec = result[0].vector;
        let firstPCVal =  result[0].eigenvalue / 10.0;
        let secondPCVal = result[1].eigenvalue / 10.0;  
       
        this.coneUp.properties.start = [this.center[0], this.center[1], this.center[2]];
        this.coneUp.properties.end = [
            this.center[0] + firstPCVal * firstPCVec[0],
            this.center[1] + firstPCVal * firstPCVec[1],
            this.center[2] + firstPCVal * firstPCVec[2],
        ];
        this.coneUp.properties.startRadius = secondPCVal;
        this.coneUp.properties.endRadius = 0.0001;
        this.coneUp.setDirtyCPU();
  
        this.coneDown.properties.start = [this.center[0], this.center[1], this.center[2]];
        this.coneDown.properties.end = [
            this.center[0] - firstPCVal * firstPCVec[0],
            this.center[1] - firstPCVal * firstPCVec[1],
            this.center[2] - firstPCVal * firstPCVec[2],
        ];
        this.coneDown.properties.startRadius = secondPCVal;
        this.coneDown.properties.endRadius = 0.0001;
        this.coneDown.setDirtyCPU();
    }

    public setColor(color: vec3) {
        this.color = color;
        let c = vec3.copy(vec3.create(), this.color);
        if (this.highlighted) {
            vec3.scale(c, c, 1.8);
        }

        if (this.coneDownID && this.coneUpID) {
            this.coneUp.properties.color = [c[0], c[1], c[2], 1.0];
            this.coneDown.properties.color = [c[0], c[1], c[2], 1.0];
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
        
        return (downIntersection == null || (upIntersection != null && upIntersection.t < downIntersection.t)) ? upIntersection : downIntersection;
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