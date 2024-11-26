import type { vec3 } from "gl-matrix";
import type * as Graphics from "@chromoskein/lib-graphics";
import type { Viewport3D } from "@chromoskein/lib-graphics";
import type { ClusterNode } from "../utils/main";
import { ClusterCompositeNode } from "./clusterCompositeNode";
import { ClusterConnector } from "./clusterConnector";
import type { VisOptions } from "../utils/data-models";

export class CompositeClusters {
    private root: ClusterCompositeNode;
    private device: GPUDevice;
    private viewport: Viewport3D;
    private showConnectors: Boolean = false;
    private highlightedClusters: ClusterCompositeNode[] = [];
    private options: VisOptions;
    private points: vec3[][] = [];
    private timestep: number = 0;

    constructor(clustersGivenK: ClusterNode[][], pointsAtTimeStep: vec3[][], selectedTimestep: number, viewport: Viewport3D, device: GPUDevice, options: VisOptions) {
        this.points = pointsAtTimeStep;
        this.timestep = selectedTimestep;
        this.options = options;
        this.root = new ClusterCompositeNode(clustersGivenK[1][0], viewport, null, this);
        this.root.updatePoints(pointsAtTimeStep, selectedTimestep);
        this.viewport = viewport;
        this.device = device;
    }

    /**
     * @returns The root of the cluster composite tree
     */
    public getRoot() {
        return this.root;
    }

    public getOptions() {
        return this.options;
    }

    public getTimestep() {
        return this.timestep;
    }

    public getPoints() {
        return this.points;
    }

    public updateOptions(options: VisOptions) {
        this.options = options;
        let inorder = this.root.getInorder();
        for (let cluster of inorder) {
            cluster.updateParameters(options);
        }
    }

    /**
     * Attempts to intersect all objects contained in this composite cluster visualization
     * @param ray Ray to intersect the scene
     * @returns Closest intersected object or null
     */
    public rayIntersection(ray: Graphics.Ray): ClusterCompositeNode {
        let inorder = this.root.getInorder();

        let bestDistance = Infinity;
        let closestCluster = null;
        for (let cluster of inorder) {
            let intersection = cluster.rayIntersection(ray);
            if (intersection != null && intersection.t < bestDistance) {
                bestDistance = intersection.t;
                closestCluster = cluster;
            }
        }

        return closestCluster;
    }

    /**
     * Updates the clusters of all nodes
     * @param clustersGivenK Hierarchical clustering tree 
     */
    public updateClusters(clustersGivenK: ClusterNode[][]) {
        let inorder = this.root.getInorder();
        for (let cluster of inorder) {
            cluster.updateCluster(clustersGivenK);
        }
    }

    /**
     * Updates points of all clusters
     * @param pointsAtTimestep All points over all timesteps
     * @param selectedTimestep Current selected timestep
     */
    public updatePoints(pointsAtTimesteps: vec3[][], selectedTimestep: number) {
        this.points = pointsAtTimesteps;
        this.timestep = selectedTimestep;
        let inorder = this.root.getInorder();
        for (let cluster of inorder) {
            cluster.updatePoints(pointsAtTimesteps, selectedTimestep);
        }
    }

    // Used for notifying other clusters of changed elsewhere in the tree
    public eventUpdate(newNodes: ClusterCompositeNode[], pointsAtTimestep: vec3[][], selectedTimestep: number) {
        let inorder: ClusterCompositeNode[] = this.root.getInorder();

        for (let i = 0; i < inorder.length; i++) {
            let cluster: ClusterCompositeNode = inorder[i];
            if (!newNodes.includes(cluster)) {
                cluster.eventUpdate(pointsAtTimestep, selectedTimestep);
            }
        }
    }

    /**
     * Creates clusterConnector objects between all neighboring leaves in the tree
     */
    private createConnectors() {
        // This assumes that the connectors do not exist on nodes
        let inorder: ClusterCompositeNode[] = this.root.getInorder();
        for (let i = 0; i < inorder.length - 1; i++) {
            new ClusterConnector(inorder[i] as ClusterCompositeNode, inorder[i + 1] as ClusterCompositeNode, this.viewport);
        }
    }

    /**
     * Destroys all cluster connector objects
     */
    private destroyConnectors() {
        let inorder: ClusterCompositeNode[] = this.root.getInorder();
        for (let i = 0; i < inorder.length - 1; i++) {
            let cluster = inorder[i];
            cluster.outConnector?.destroy(this.viewport);
            cluster.inConnector?.destroy(this.viewport);
        }
    }

    /**
     * Deletes all leaves, connectors and this object
     */
    public delete() {
        let inorder = this.root.getInorder();
        inorder.forEach((cluster : ClusterCompositeNode) => { 
            cluster.outConnector?.destroy(this.viewport);
            cluster.inConnector?.destroy(this.viewport);
            cluster.deleteVisualization()
        });
    }

    public getShowConnectors() {
        return this.showConnectors;
    }

    public setShowConnectors(show: Boolean) {
        let previousValue = this.showConnectors;
        this.showConnectors = show;

        // Handling code when connectors were hidden and are being shown
        if (!previousValue && this.showConnectors) {
            this.createConnectors();
        }
        else if (previousValue && !this.showConnectors) {
            this.destroyConnectors();
        }
    }

    public getViewport() {
        return this.viewport
    }

    public getDevice() {
        return this.device;
    }

    public getClusters() {
        return this.root.getInorder().map((c: ClusterCompositeNode) => c.cluster);
    }
}