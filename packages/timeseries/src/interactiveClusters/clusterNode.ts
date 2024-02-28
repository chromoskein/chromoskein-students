import type { vec3 } from "gl-matrix";
import type * as Graphics from "lib-graphics";
import type { Viewport3D } from "lib-graphics";
import type { ClusterNode } from "../utils/main";
import type { AbstractClusterVisualisation } from "./visualisations/abstractVisualization";
import type { InteractiveClusters } from "./interactiveClusters";
import type { ClusterConnector } from "./clusterConnector";
import { SphereClusterVisualisation } from "./visualisations/sphereClusterVisualisation";

export abstract class AbstractClusterComposite {
    protected parent: AbstractClusterComposite;

    constructor() {
        this.parent = null;
    }

    abstract rayIntersection(ray: Graphics.Ray) : Graphics.Intersection;
    abstract updateCluster(clustersGivenK: ClusterNode[][], points: vec3[]);
    abstract updatePoints(points: vec3[]);
    abstract setVisualisation<T extends AbstractClusterVisualisation>(visualisationType: new(manager: InteractiveClusters, points: vec3[], cluster: ClusterNode, viewport: Viewport3D) => T, points: vec3[]);
    abstract eventUpdate(points: vec3[]);
    abstract deleteVisualization();
    abstract getInorder(): AbstractClusterComposite[];
}

export class ClusterLeaf extends AbstractClusterComposite {
    public cluster: ClusterNode;
    private children: AbstractClusterComposite[];
    private isLeaf: boolean;
    private viewport: Viewport3D;
    private manager: InteractiveClusters;

    // TODO: Remove this teribleness
    public inConnector: ClusterConnector = null;
    public outConnector: ClusterConnector = null;

    private visualisation: AbstractClusterVisualisation;

    constructor(cluster: ClusterNode, points: vec3[], viewport: Viewport3D,  parent: AbstractClusterComposite, manager: InteractiveClusters) {
        super();
        this.parent = parent;
        this.cluster = cluster;
        this.children = [];
        this.isLeaf = true;
        this.viewport = viewport;
        this.manager = manager;

        this.setVisualisation(SphereClusterVisualisation, points);
    }

    public setVisualisation<T extends AbstractClusterVisualisation>(visualisationType: new(manager: InteractiveClusters, points: vec3[], cluster: ClusterNode, viewport: Viewport3D) => T, points: vec3[]) {
        this.deleteVisualization();
        this.visualisation = new visualisationType(this.manager, points, this.cluster, this.viewport);
    }

    public setInConnector(connector: ClusterConnector) {
        this.inConnector = connector;
    }

    public setOutConnector(connector: ClusterConnector) {
        this.outConnector = connector;
    }

    public getCenter(): vec3 {
        return this.visualisation.getCenter();
    }

    public getInorder() {
        if (this.isLeaf) {
            return [this];
        }

        let inorder: AbstractClusterComposite[] = this.children[0].getInorder();
        for (let i = 1; i < this.children.length; i++) {
            inorder = inorder.concat(this.children[i].getInorder());
        }
        return inorder;
    }

    public updateCluster(clustersGivenK: ClusterNode[][]) {
        this.cluster = clustersGivenK[this.cluster.k][this.cluster.i];
        if (this.isLeaf && this.visualisation) 
            this.visualisation.updateCluster(this.cluster);        
    }

    public updatePoints(points: vec3[]) {
        if (this.isLeaf && this.visualisation)
            this.visualisation.updatePoints(points);
            // This causes double updates on all connectors during major update
            // but im currently too lazy to do it correctly
            if (this.inConnector) this.inConnector.update();
            if (this.outConnector) this.outConnector.update();
    }

    public eventUpdate(points: vec3[]) {
        if (this.isLeaf && this.visualisation)
            this.visualisation.eventUpdate(points);
    }

    public split(clustersGivenK: ClusterNode[][], points: vec3[]) {
        if (!this.isLeaf || this.cluster.k + 1 >= clustersGivenK.length) return;

        let k = this.cluster.k;
        let i = this.cluster.i;
        while (clustersGivenK[k][i].children.length == 1) {
            i = clustersGivenK[k][i].children[0];
            k++;
            
            if (k + 1 >= clustersGivenK.length) return;
        }

        this.isLeaf = false;
        let visualizationType = this.visualisation.getConstructor();
        this.deleteVisualization();
        
        for (let clusterIdx of clustersGivenK[k][i].children) {
            this.children.push(new ClusterLeaf(clustersGivenK[k + 1][clusterIdx], points, this.viewport, this, this.manager));
        }

        for (let child of this.children) {
            child.setVisualisation(visualizationType, points)
            child.updatePoints(points);
        }

        if (this.inConnector != null) {
            this.inConnector.setEnd(this.children[0] as ClusterLeaf)
        }

        if (this.outConnector != null) {
            this.outConnector.setStart(this.children[this.children.length - 1] as ClusterLeaf);
        }

        this.manager.eventUpdate(this.children, points);
    }

    public rayIntersection(ray: Graphics.Ray): Graphics.Intersection | null {
        if (!this.isLeaf) {
            return null;
        }

        return this.visualisation.rayIntersection(ray);
    }

    public deleteVisualization() {
        if (this.visualisation) {
            this.visualisation.delete(this.viewport);
            this.visualisation = null;
        }
    }
}