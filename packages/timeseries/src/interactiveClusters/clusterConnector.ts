import { vec3 } from "gl-matrix";
import * as Graphics from "lib-graphics";
import type { Viewport3D } from "lib-graphics";
import type { ClusterCompositeNode } from "./clusterCompositeNode";

/**
 * Represents a tube connection between two clustercompositenodes
 */
export class ClusterConnector {
    private start: ClusterCompositeNode;
    private end: ClusterCompositeNode;

    private cone: Graphics.RoundedCone;
    private coneID: number | null = null;

    constructor(start: ClusterCompositeNode, end: ClusterCompositeNode, viewport: Viewport3D) {
        this.start = start;
        this.end = end;

        start.setOutConnector(this);
        end.setInConnector(this);

        [this.cone, this.coneID] = viewport.scene.addObject(Graphics.RoundedCone);
        this.cone.properties.startRadius = 0.02;
        this.cone.properties.endRadius = 0.02;
        this.setColor(vec3.fromValues(0.9, 0.9, 0.9));
        this.update();
    }

    public update() {
        let start = this.start.getVisualisation().getOutConnectionPoint();
        let end = this.end.getVisualisation().getInConnectionPoint();

        this.cone.properties.start = [start[0], start[1], start[2]];
        this.cone.properties.end = [end[0], end[1], end[2]];
        this.cone.setDirtyCPU();
    }

    public setColor(color: vec3) {
        this.cone.properties.color = [color[0], color[1], color[2], 1];
        this.cone.setDirtyCPU();
    }

    public setStart(start: ClusterCompositeNode) {
        this.start = start;
        start.setOutConnector(this);
        this.update();
    }

    public setEnd (end: ClusterCompositeNode) {
        this.end = end;
        end.setInConnector(this);
        this.update();
    }

    public destroy(viewport: Viewport3D) {
        viewport.scene.removeObjectByID(this.coneID);
        this.coneID = null;
        this.cone = null;
        this.start.setOutConnector(null);
        this.end.setInConnector(null);
    }
}
