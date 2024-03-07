import { vec3, vec4 } from "gl-matrix";
import * as Graphics from "lib-graphics";
import type { Viewport3D } from "lib-graphics";
import { blobFromPoints, type ClusterNode } from "../../utils/main";
import type { InteractiveClusters } from "../interactiveClusters";
import { AbstractClusterVisualisation } from "./abstractVisualization";

export class VolumeClusterVisualisation extends AbstractClusterVisualisation {
    private cluster: ClusterNode;
    private volumeUnit: Graphics.DynamicVolumeUnit;
    private volumeUnitID: number;
    private volumeCenter: vec3 = vec3.fromValues(0, 0, 0);
    //private pathline: Graphics.RoundedConeInstanced;
    //private pathlineID: number | null = null;
    //private n_instances: number = 0;
    //private startPoint: vec3 = vec3.fromValues(0, 0, 0);
    //private endPoint: vec3 = vec3.fromValues(0, 0, 0);

    constructor(manager: InteractiveClusters, cluster: ClusterNode, viewport: Viewport3D) {
        super(manager, cluster, viewport);

        [this.volumeUnit, this.volumeUnitID] = viewport.scene.addDynamicVolume(Graphics.DynamicVolumeUnit);
        this.updateCluster(cluster);
        this.volumeUnit.transparency = 0.3;
        this.volumeUnit.func = 1;
        this.setColor(this.cluster.color.rgb);
    }

    public updateCluster(cluster: ClusterNode) {
        this.cluster = cluster;
    }

    public updatePoints(pointsAtTimestep: vec3[][], selectedTimestep: number) {
        let slicedPointsAtTimestep: vec3[][] = [];
        for (let timestep of pointsAtTimestep) {
            slicedPointsAtTimestep.push(timestep.slice(this.cluster.from, this.cluster.to));
        }

        let centers: vec3[] = [];
        for (let slicedTimestep of slicedPointsAtTimestep) {
            let blob = blobFromPoints(slicedTimestep);
            centers.push(blob.center);
        }

        this.volumeCenter = blobFromPoints(centers).center;

        let volumePoints: vec3[][] = centers.map(center => [center]);
        let volumeRadius = slicedPointsAtTimestep[0].length / 1000.0 * 2 + 0.02;
        this.volumeUnit.fromPoints(this.manager.getDevice(), volumePoints, volumeRadius);

    }

    public setColor(color: vec3) {
        this.color = color;
        let c = vec3.copy(vec3.create(), this.color);
        if (this.highlighted) {
            vec3.scale(c, c, 1.8);
        }

        this.volumeUnit.setColor(vec4.fromValues(c[0], c[1], c[2], 1.0));
    }

    public rayIntersection(ray: Graphics.Ray): Graphics.Intersection {
        return this.volumeUnit.rayIntersection(ray);
    }
    
    public delete(viewport: Graphics.Viewport3D) {
        if (this.volumeUnitID) {
            viewport.scene.removeDynamicVolumeByID(this.volumeUnitID);
            this.volumeUnit = null;
            this.volumeUnitID = null;
        }
    }

    public getInConnectionPoint() {
        return this.volumeCenter;
    }

    public getOutConnectionPoint() {
        return this.volumeCenter;
    }

    public getConstructor() {
        return VolumeClusterVisualisation;
    }
}