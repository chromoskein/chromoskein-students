import type { vec3 } from "gl-matrix";
import type * as Graphics from "lib-graphics";
import type { Viewport3D } from "lib-graphics";
import type { ClusterNode } from "../utils/main";
import type { AbstractClusterVisualisation } from "./visualisations/abstractVisualization";
import type { InteractiveClusters } from "./interactiveClusters";
import { ClusterConnector } from "./clusterConnector";
import { SphereClusterVisualisation } from "./visualisations/sphereClusterVisualisation";


export class ClusterComposite {
    private children: ClusterComposite[];
    private isLeaf: boolean;
    private viewport: Viewport3D;
    private manager: InteractiveClusters;
    
    // TODO: This should probably not be public
    public parent: ClusterComposite = null;
    public cluster: ClusterNode;
    public inConnector: ClusterConnector = null;
    public outConnector: ClusterConnector = null;

    private visualisation: AbstractClusterVisualisation;

    constructor(cluster: ClusterNode, viewport: Viewport3D,  parent: ClusterComposite, manager: InteractiveClusters) {
        this.parent = parent;
        this.cluster = cluster;
        this.children = [];
        this.isLeaf = true;
        this.viewport = viewport;
        this.manager = manager;

        this.setVisualisation(SphereClusterVisualisation);
        this.setVisible(true);
    }

    public setVisualisation<T extends AbstractClusterVisualisation>(visualisationType: new(manager: InteractiveClusters, cluster: ClusterNode, viewport: Viewport3D) => T) {
        this.deleteVisualization();
        this.visualisation = new visualisationType(this.manager, this.cluster, this.viewport);
    }

    public setInConnector(connector: ClusterConnector) {
        this.inConnector = connector;
    }

    public setOutConnector(connector: ClusterConnector) {
        this.outConnector = connector;
    }

    public setVisible(visible: boolean) {
        this.cluster.visible = visible;
    }

    public getVisualisation() {
        return this.visualisation;
    }

    public getInorder() {
        if (this.isLeaf) {
            return [this];
        }

        let inorder: ClusterComposite[] = this.children[0].getInorder();
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

    public updatePoints(pointsAtTimesteps: vec3[][], selectedTimestep: number) {
        if (this.isLeaf && this.visualisation)
            this.visualisation.updatePoints(pointsAtTimesteps, selectedTimestep);
            // This causes double updates on all connectors during major update
            // but im currently too lazy to do it correctly
            if (this.inConnector) this.inConnector.update();
            if (this.outConnector) this.outConnector.update();
    }

    public eventUpdate(pointsAtTimesteps: vec3[][], selectedTimestep: number) {
        if (this.isLeaf && this.visualisation)
            this.visualisation.eventUpdate(pointsAtTimesteps, selectedTimestep);
    }

    public split(clustersGivenK: ClusterNode[][], pointsAtTimesteps: vec3[][], selectedTimestep: number) {
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
            this.children.push(new ClusterComposite(clustersGivenK[k + 1][clusterIdx], this.viewport, this, this.manager));
        }

        for (let child of this.children) {
            child.setVisualisation(visualizationType);
            child.updatePoints(pointsAtTimesteps, selectedTimestep);
            child.setVisible(true);
        }
        
        this.inConnector?.setEnd(this.children[0])
        this.outConnector?.setStart(this.children[this.children.length - 1]);
        this.inConnector = null;
        this.outConnector = null;
        // Create new connectors between all created nodes
        if (this.manager.getShowConnectors()) {
            for (let i = 0; i < this.children.length - 1; i++) {
                new ClusterConnector(this.children[i], this.children[i + 1], this.viewport);
            }
        }

        this.manager.eventUpdate(this.children, pointsAtTimesteps, selectedTimestep);
        this.setVisible(false);
    }

    private mergeWithVisualization<T extends AbstractClusterVisualisation>(visualisationType: new(manager: InteractiveClusters, cluster: ClusterNode, viewport: Viewport3D) => T, clustersGivenK: ClusterNode[][], pointsAtTimesteps: vec3[][], selectedTimestep: number) {
        let inorderChildren = this.getInorder();
        for (let child of inorderChildren) {
            child.deleteVisualization();
            child.setVisible(false);
        }

        if (this.manager.getShowConnectors()) {
            inorderChildren[0].outConnector?.destroy(this.viewport);
            inorderChildren[inorderChildren.length - 1].inConnector?.destroy(this.viewport);
            for (let i = 1; i < inorderChildren.length - 1; i++) {
                inorderChildren[i].inConnector?.destroy(this.viewport);
                inorderChildren[i].outConnector?.destroy(this.viewport);
            }
        }

        this.isLeaf = true;
        this.updateCluster(clustersGivenK);
        this.setVisualisation(visualisationType);
        this.updatePoints(pointsAtTimesteps, selectedTimestep);
        this.setInConnector(inorderChildren[0].inConnector);
        this.setOutConnector(inorderChildren[inorderChildren.length - 1].outConnector);
        this.inConnector?.setEnd(this)
        this.outConnector?.setStart(this);
        this.children = [];
        this.manager.eventUpdate([this], pointsAtTimesteps, selectedTimestep);
    }

    public merge(clustersGivenK: ClusterNode[][],  pointsAtTimesteps: vec3[][], selectedTimestep: number) {
        if (this.isLeaf && this.parent != null) {
            this.parent.mergeWithVisualization(this.visualisation?.getConstructor(), clustersGivenK, pointsAtTimesteps, selectedTimestep);
            this.parent.setVisible(true);
        }
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