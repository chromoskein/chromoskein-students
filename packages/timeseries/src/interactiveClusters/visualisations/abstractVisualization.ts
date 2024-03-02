import type { vec3 } from "gl-matrix";
import type * as Graphics from "lib-graphics";
import type { Viewport3D } from "lib-graphics";
import type { ClusterNode } from "../../utils/main";
import type { InteractiveClusters } from "../interactiveClusters";

export abstract class AbstractClusterVisualisation {
    protected manager: InteractiveClusters;

    constructor(manager: InteractiveClusters, points: vec3[], cluster: ClusterNode, viewport: Viewport3D) {
        this.manager = manager;
    }
    
    abstract rayIntersection(ray: Graphics.Ray) : Graphics.Intersection;
    abstract updatePoints(points: vec3[]);
    abstract updateCluster(cluster: ClusterNode);
    abstract delete(viewport: Viewport3D);
    abstract setColor(color: vec3);
    abstract getConstructor();  

    abstract getInConnectionPoint();
    abstract getOutConnectionPoint();
    public eventUpdate(points: vec3[]) { /* For most subclasses this is unnecessary */ }
}