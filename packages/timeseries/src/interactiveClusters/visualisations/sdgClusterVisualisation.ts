import type { vec3 } from "gl-matrix";
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
        let blob = blobFromPoints(points.slice(this.cluster.from, this.cluster.to + 1))
        this.center = blob.center;
        this.sdgObject.translate([blob.center[0], blob.center[1], blob.center[2]], 0);
        this.sdgObject.scale(blob.scale, 0);
        this.sdgObject.fromPoints(this.manager.getDevice(), [blob.normalizedPoints], [0.03]);
        this.sdgObject.setDirtyCPU();
    }

    public setColor(color: vec3) {
        if (this.sdgObjectID) {
            this.sdgObject.properties[0].color = [color[0], color[1], color[2], 1.0];
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

    public getConstructor() {
        return SDGClusterVisualisation;
    }

}