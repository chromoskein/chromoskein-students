import { vec3 } from "gl-matrix";
import * as Graphics from "@chromoskein/lib-graphics";
import type { Viewport3D } from "@chromoskein/lib-graphics";
import type { ClusterBlob, ClusterNode } from "../../utils/main";
import type { CompositeClusters } from "../compositeClusters";
import { AbstractClusterVisualisation } from "./abstractVisualization";
import { blobFromPoints } from "../../utils/main";
import type { VisOptions } from "../../utils/data-models";

export class SDGClusterVisualisation extends AbstractClusterVisualisation {
    private cluster!: ClusterNode;
    private sdgObject: Graphics.SignedDistanceGrid;
    private sdgObjectID: number | null = null;
    private blob!: ClusterBlob;
    private radius: number = 0.1;
    private startPoint: vec3 = vec3.fromValues(0, 0, 0);
    private endPoint: vec3 = vec3.fromValues(0, 0, 0);

    constructor(manager: CompositeClusters, cluster: ClusterNode, viewport: Viewport3D) {
        super(manager, cluster, viewport);
        this.radius = manager.getOptions().radius;
        
        [this.sdgObject, this.sdgObjectID] = viewport.scene!.addObject(Graphics.SignedDistanceGrid);
        this.sdgObject.setDirtyCPU();

        this.updateCluster(cluster);
        this.setColor(cluster.color);
    }

    
    public updateParameters(options: VisOptions) {
        this.radius = options.radius;
        this.sdgObject.fromPoints(this.manager.getDevice(), [this.blob.normalizedPoints], [this.radius]);
    }

    public updateCluster(cluster: ClusterNode) {
        this.cluster = cluster;
    }

    public updatePoints(pointsAtTimestep: vec3[][], selectedTimestep: number) {
        let clusterPoints = pointsAtTimestep[selectedTimestep].slice(this.cluster.from, this.cluster.to + 1);
        this.startPoint = clusterPoints[0];
        this.endPoint = clusterPoints[clusterPoints.length - 1];
        
        this.blob = blobFromPoints(clusterPoints)
        this.sdgObject.translate([this.blob.center[0], this.blob.center[1], this.blob.center[2]], 0);
        this.sdgObject.scale(this.blob.scale, 0);
        this.sdgObject.fromPoints(this.manager.getDevice(), [this.blob.normalizedPoints], [this.radius]);
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

    public rayIntersection(ray: Graphics.Ray): Graphics.Intersection | null {
        return this.sdgObject.rayIntersection(ray);
    }
    
    public delete(viewport: Graphics.Viewport3D) {
        if (this.sdgObjectID) {
            viewport.scene!.removeObjectByID(this.sdgObjectID);
            
            this.sdgObjectID = null;
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