import { vec3 } from "gl-matrix";
import * as Graphics from "lib-graphics";
import type { Viewport3D } from "lib-graphics";
import type { ClusterLeaf } from "./clusterNode";

export class ClusterConnector {
    private start: ClusterLeaf;
    private end: ClusterLeaf;

    private cone: Graphics.RoundedCone;
    private coneID: number | null = null;

    constructor(start: ClusterLeaf, end: ClusterLeaf, viewport: Viewport3D) {
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
        let start = this.start.getCenter();
        let end = this.end.getCenter();

        this.cone.properties.start = [start[0], start[1], start[2]];
        this.cone.properties.end = [end[0], end[1], end[2]];
        this.cone.setDirtyCPU();
    }

    public setColor(color: vec3) {
        this.cone.properties.color = [color[0], color[1], color[2], 1];
        this.cone.setDirtyCPU();
    }

    public setStart(start: ClusterLeaf) {
        this.start = start;
        this.update();
    }

    public setEnd (end: ClusterLeaf) {
        this.end = end;
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
