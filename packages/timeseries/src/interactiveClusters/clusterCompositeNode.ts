import type { vec3 } from "gl-matrix";
import type * as Graphics from "@chromoskein/lib-graphics";
import type { Viewport3D } from "@chromoskein/lib-graphics";
import type { ClusterNode } from "../utils/main";
import type { AbstractClusterVisualisation } from "./visualisations/abstractVisualization";
import type { CompositeClusters } from "./compositeClusters";
import { ClusterConnector } from "./clusterConnector";
import { SphereSimplificationClusterVisualisation } from "./visualisations/sphereSimplificationClusterVisualisation";
import { PathlineClusterVisualization } from "./visualisations";
import type { AllOptions } from "../types";

/**
 * Represents a single node in the clusternode tree maintaned for the composite visualization
 */
export class ClusterCompositeNode {
    private children: ClusterCompositeNode[];
    private isLeaf: boolean;
    private viewport: Viewport3D;
    private manager: CompositeClusters;
    private visible: boolean = true;

    public parent: ClusterCompositeNode | null;
    public cluster: ClusterNode;
    public inConnector: ClusterConnector | null = null;
    public outConnector: ClusterConnector | null = null;

    private visualisation: AbstractClusterVisualisation | null = null;

    constructor(cluster: ClusterNode, viewport: Viewport3D,  parent: ClusterCompositeNode | null, manager: CompositeClusters) {
        this.parent = parent;
        this.cluster = cluster;
        this.children = [];
        this.isLeaf = true;
        this.viewport = viewport;
        this.manager = manager;

        this.setVisualisation(PathlineClusterVisualization);
    }

    /**
     * Enables changing of the visualization which represents this cluster
     * @param visualisationType New visualization
     */
    public setVisualisation<T extends AbstractClusterVisualisation>(visualisationType: new(manager: CompositeClusters, cluster: ClusterNode, viewport: Viewport3D) => T) {
        this.deleteVisualization();
        this.visualisation = new visualisationType(this.manager, this.cluster, this.viewport);
    }

    public setInConnector(connector: ClusterConnector | null) {
        this.inConnector = connector;
    }

    public setOutConnector(connector: ClusterConnector | null) {
        this.outConnector = connector;
    }

    public setVisible(visible: boolean) {
        this.visible = visible;
    }

    public getVisualisation() {
        return this.visualisation;
    }

    /**
     * Returns the inorder array of this node and its children
     * @returns Inorder array of this node and its children
     */
    public getInorder() {
        if (this.isLeaf) {
            return [this];
        }

        let inorder: ClusterCompositeNode[] = this.children[0].getInorder();
        for (let i = 1; i < this.children.length; i++) {
            inorder = inorder.concat(this.children[i].getInorder());
        }
        return inorder;
    }

    /**
     * Updates the cluster represented by this node when changing clustering
     * @param clustersGivenK Hierarchical clustering tree
     */
    public updateCluster(clustersGivenK: ClusterNode[][]) {
        this.cluster = clustersGivenK[this.cluster.k][this.cluster.i];
        if (this.isLeaf && this.visualisation) 
            this.visualisation.updateCluster(this.cluster);        
    }

    public updateParameters(options: AllOptions) {
        if (this.isLeaf && this.visualisation) 
            this.visualisation.updateParameters(options);  
    }

    /**
     * Updates the positions of points of this cluster when timestep is changed
     * @param pointsAtTimestep All points over all timesteps
     * @param selectedTimestep Current selected timestep
     */
    public updatePoints(pointsAtTimesteps: vec3[][], selectedTimestep: number) {
        if (this.isLeaf && this.visualisation)
            this.visualisation.updatePoints(pointsAtTimesteps, selectedTimestep);
            // This causes double updates on all connectors during major update
            // but im currently too lazy to do it correctly
            if (this.inConnector) this.inConnector.update();
            if (this.outConnector) this.outConnector.update();
    }

    /**
     * This function is called when a different cluster is updated
     * Used by clusters whose form depends on positions/sizes etc. of other clusters
     * @param pointsAtTimestep All points over all timesteps
     * @param selectedTimestep Current selected timestep
     */
    public eventUpdate(pointsAtTimesteps: vec3[][], selectedTimestep: number) {
        if (this.isLeaf && this.visualisation)
            this.visualisation.eventUpdate(pointsAtTimesteps, selectedTimestep);
    }

    /**
     * Splits this cluster into its children nodes while retaining the visualization type of this cluster
     * @param clustersGivenK Hierarchical clustering tree
     * @param pointsAtTimestep All points over all timesteps
     * @param selectedTimestep Current selected timestep
     */
    public split(clustersGivenK: ClusterNode[][], pointsAtTimesteps: vec3[][], selectedTimestep: number) {
        if (!this.visualisation || !this.isLeaf || this.cluster.k + 1 >= clustersGivenK.length) return;

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
            this.children.push(new ClusterCompositeNode(clustersGivenK[k + 1][clusterIdx], this.viewport, this, this.manager));
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

    /**
     * Merges this cluster into parent along with all children of the parent while setting the parents visualization type

     * @param visualisationType The visualization type constructor to set for parent node
     * @param clustersGivenK Hierarchical clustering tree
     * @param pointsAtTimestep All points over all timesteps
     * @param selectedTimestep Current selected timestep
     */
    private mergeWithVisualization<T extends AbstractClusterVisualisation>(visualisationType: new(manager: CompositeClusters, cluster: ClusterNode, viewport: Viewport3D) => T, clustersGivenK: ClusterNode[][], pointsAtTimesteps: vec3[][], selectedTimestep: number) {
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

    /**
     * Merges this cluster into parent along with all children of the parent while retaining the visualization type of this cluster
     * @param clustersGivenK Hierarchical clustering tree
     * @param pointsAtTimestep All points over all timesteps
     * @param selectedTimestep Current selected timestep
     */
    public merge(clustersGivenK: ClusterNode[][],  pointsAtTimesteps: vec3[][], selectedTimestep: number) {
        if (this.isLeaf && this.parent != null) {
            this.parent.mergeWithVisualization(this.visualisation?.getConstructor(), clustersGivenK, pointsAtTimesteps, selectedTimestep);
            this.parent.setVisible(true);
        }
    }

    /**
     * Attempts to intersect the object defined this clusters visualization type 
     * @param ray Ray to intersect the object 
     * @returns intersection or null
     */
    public rayIntersection(ray: Graphics.Ray): Graphics.Intersection | null {
        if (!this.visualisation || !this.isLeaf) {
            return null;
        }

        return this.visualisation.rayIntersection(ray);
    }

    /**
     * Deletes this object from the scene
     */
    public deleteVisualization() {
        if (this.visualisation) {
            this.visualisation.delete(this.viewport);
            this.visualisation = null;
        }
    }
}