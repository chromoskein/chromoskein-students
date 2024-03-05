import type { vec3 } from "gl-matrix";
import type * as Graphics from "lib-graphics";
import type { Viewport3D } from "lib-graphics";
import type { ClusterNode } from "../utils/main";
import { ClusterComposite } from "./clusterComposite";
import { ClusterConnector } from "./clusterConnector";

export class InteractiveClusters {
    private root: ClusterComposite;
    private device: GPUDevice;
    private viewport: Viewport3D;
    private showConnectors: Boolean = false;
    private highlightedClusters: ClusterComposite[] = [];

    constructor(clustersGivenK: ClusterNode[][], points: vec3[], viewport: Viewport3D, device: GPUDevice) {
        this.root = new ClusterComposite(clustersGivenK[1][0], points, viewport, null, this);
        this.root.updatePoints(points);
        this.viewport = viewport;
        this.device = device;
    }

    public getRoot() {
        return this.root;
    }

    public rayIntersection(ray: Graphics.Ray): ClusterComposite {
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

    public updateClusters(points: vec3[], clustersGivenK: ClusterNode[][]) {
        let inorder = this.root.getInorder();
        for (let cluster of inorder) {
            cluster.updateCluster(clustersGivenK);
        }
    }

    public updatePoints(points: vec3[]) {
        let inorder = this.root.getInorder();
        for (let cluster of inorder) {
            cluster.updatePoints(points);
        }
    }

    // Used for notifying other clusters of changed elsewhere in the tree
    public eventUpdate(newNodes: ClusterComposite[], points: vec3[]) {
        let inorder: ClusterComposite[] = this.root.getInorder();

        for (let i = 0; i < inorder.length; i++) {
            let cluster: ClusterComposite = inorder[i];
            if (!newNodes.includes(cluster)) {
                cluster.eventUpdate(points);
            }
        }
    }

    private createConnectors() {
        // This assumes that the connectors do not exist on nodes
        let inorder: ClusterComposite[] = this.root.getInorder();
        for (let i = 0; i < inorder.length - 1; i++) {
            new ClusterConnector(inorder[i] as ClusterComposite, inorder[i + 1] as ClusterComposite, this.viewport);
        }
    }

    private destroyConnectors() {
        let inorder: ClusterComposite[] = this.root.getInorder();
        for (let i = 0; i < inorder.length - 1; i++) {
            let cluster = inorder[i];
            cluster.outConnector?.destroy(this.viewport);
            cluster.inConnector?.destroy(this.viewport);
        }
    }

    public delete() {
        let inorder = this.root.getInorder();
        inorder.forEach((cluster : ClusterComposite) => { 
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
        return this.root.getInorder().map((c: ClusterComposite) => c.cluster);
    }
}