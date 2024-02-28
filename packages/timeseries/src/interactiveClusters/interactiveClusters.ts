import type { vec3 } from "gl-matrix";
import type * as Graphics from "lib-graphics";
import type { Viewport3D } from "lib-graphics";
import type { ClusterNode } from "../utils/main";
import { ClusterLeaf } from "./clusterNode";
import { ClusterConnector } from "./clusterConnector";
import type { AbstractClusterComposite } from "./clusterNode";

export class InteractiveClusters {
    private root: ClusterLeaf;
    private device: GPUDevice;
    private viewport: Viewport3D;

    constructor(clustersGivenK: ClusterNode[][], points: vec3[], viewport: Viewport3D, device: GPUDevice) {
        this.root = new ClusterLeaf(clustersGivenK[1][0], points, viewport, null, this);
        this.root.updatePoints(points);
        this.viewport = viewport;
        this.device = device;
    }

    public rayIntersection(ray: Graphics.Ray): ClusterLeaf {
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
            cluster.updateCluster(clustersGivenK, points);
        }
    }

    public updatePoints(points: vec3[]) {
        let inorder = this.root.getInorder();
        for (let cluster of inorder) {
            cluster.updatePoints(points);
        }
    }

    // Used for notifying other clusters of changed elsewhere in the tree
    public eventUpdate(newNodes: AbstractClusterComposite[], points: vec3[]) {
        let inorder: AbstractClusterComposite[] = this.root.getInorder();

        for (let i = 0; i < inorder.length; i++) {
            let cluster: AbstractClusterComposite = inorder[i];
            if (!newNodes.includes(cluster)) {
                cluster.eventUpdate(points);
            }
        }
    }

    public createConnectors() {
        let inorder: AbstractClusterComposite[] = this.root.getInorder();
        for (let i = 0; i < inorder.length - 1; i++) {
            let cluster = inorder[i] as ClusterLeaf;
            cluster.outConnector?.destroy(this.viewport);
            cluster.inConnector?.destroy(this.viewport);
        }

        for (let i = 0; i < inorder.length - 1; i++) {
            new ClusterConnector(inorder[i] as ClusterLeaf, inorder[i + 1] as ClusterLeaf, this.viewport);
        }
    }

    public delete() {
        let inorder = this.root.getInorder();
        inorder.forEach((x : AbstractClusterComposite) => { 
            let cluster = x as ClusterLeaf;
            cluster.outConnector?.destroy(this.viewport);
            cluster.inConnector?.destroy(this.viewport);
            x.deleteVisualization()
        });
    }

    public getViewport() {
        return this.viewport
    }

    public getDevice() {
        return this.device;
    }

    public getClusters() {
        return this.root.getInorder().map((c: ClusterLeaf) => c.cluster);
    }
}