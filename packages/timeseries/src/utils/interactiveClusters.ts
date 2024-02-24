import type { vec3 } from "gl-matrix";
import * as Graphics from "lib-graphics";
import type { Viewport3D } from "lib-graphics";
import type { ClusterNode } from "./main";

export class InteractiveClusters {
    root: ClusterLeaf;
    
    constructor(clustersGivenK: ClusterNode[][], points: vec3[], viewport: Viewport3D) {
        this.root = new ClusterLeaf(1, 0, clustersGivenK, points, viewport, null);
    }

    rayIntersection(ray: Graphics.Ray): ClusterLeaf {
        let inorder = this.root.getInorder();

        let bestDistance = Infinity;
        let closestCluster = null;
        for (let cluster of inorder) {
            let distance = cluster.rayIntersection(ray);
            if (distance != null && distance < bestDistance) {
                bestDistance = distance;
                closestCluster = cluster;
            }
        }

        return closestCluster;
    }

    update(points: vec3[]) {
        let inorder = this.root.getInorder();
        for (let cluster of inorder) {
            cluster.updatePoints(points);
        }
    }

    delete() {
        let inorder = this.root.getInorder();
        inorder.forEach((x : AbstractClusterComposite) => x.deleteVisualization());
    }
}

export abstract class AbstractClusterComposite {
    depth: number;
    clusterIdx: number;
    parent: AbstractClusterComposite;

    constructor(depth: number, clusterIdx: number) {
        this.depth = depth;
        this.clusterIdx = clusterIdx;
        this.parent = null;
    }

    abstract rayIntersection(ray: Graphics.Ray);
    abstract updatePoints(points: vec3[]);
    abstract deleteVisualization();
    abstract getInorder(): AbstractClusterComposite[];
}

export class ClusterLeaf extends AbstractClusterComposite {
    cluster: ClusterNode;
    children: AbstractClusterComposite[];
    isLeaf: boolean;
    viewport: Viewport3D;

    object: Graphics.Sphere;
    objectID: number;

    constructor(depth: number, clusterIdx: number, clustersGivenK: ClusterNode[][], points: vec3[], viewport: Viewport3D,  parent: AbstractClusterComposite) {
        super(depth, clusterIdx);
        this.parent = parent;
        this.cluster = clustersGivenK[depth][clusterIdx]
        this.children = [];
        this.isLeaf = true;
        this.viewport = viewport;

        [this.object, this.objectID] = viewport.scene.addObject(Graphics.Sphere);
        this.object.properties.radius = 0.2;  
        this.updatePoints(points);
    }

    getInorder() {
        if (this.isLeaf) {
            return [this];
        }

        let inorder: AbstractClusterComposite[] = this.children[0].getInorder();
        for (let i = 1; i < this.children.length; i++) {
            inorder = inorder.concat(this.children[i].getInorder());
        }
        return inorder;
    }

    updatePoints(points: vec3[]) {
        if (!this.isLeaf) return;
        
        let bb = Graphics.boundingBoxFromPoints(points.slice(this.cluster.from, this.cluster.to + 1));
        this.object.properties.center = [bb.center[0], bb.center[1], bb.center[2]];
        this.object.properties.color = [this.cluster.color.rgb[0], this.cluster.color.rgb[1], this.cluster.color.rgb[2], 1];
        this.object.setDirtyCPU();
    }

    split(clustersGivenK: ClusterNode[][], points: vec3[]) {
        if (!this.isLeaf || this.depth + 1 == clustersGivenK.length) return;

        this.isLeaf = false;
        this.deleteVisualization();

        for (let clusterIdx of this.cluster.children) {
            this.children.push(new ClusterLeaf(this.depth + 1, clusterIdx, clustersGivenK, points, this.viewport, this));
        }
    }

    rayIntersection(ray: Graphics.Ray) {
        if (!this.isLeaf) {
            return Infinity;
        }

        return this.object.rayIntersection(ray);
    }

    deleteVisualization() {
        if (this.objectID) {
            this.viewport.scene.removeObjectByID(this.objectID);
        }
    }
}