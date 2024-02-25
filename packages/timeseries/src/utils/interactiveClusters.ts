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
            let intersection = cluster.rayIntersection(ray);
            if (intersection != null && intersection.t < bestDistance) {
                bestDistance = intersection.t;
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
    parent: AbstractClusterComposite;

    constructor() {
        this.parent = null;
    }

    abstract rayIntersection(ray: Graphics.Ray) : Graphics.Intersection;
    abstract updatePoints(points: vec3[]);
    abstract deleteVisualization();
    abstract getInorder(): AbstractClusterComposite[];
}

export class ClusterLeaf extends AbstractClusterComposite {
    cluster: ClusterNode;
    children: AbstractClusterComposite[];
    isLeaf: boolean;
    viewport: Viewport3D;

    visualisation: AbstractClusterVisualisation;

    constructor(depth: number, clusterIdx: number, clustersGivenK: ClusterNode[][], points: vec3[], viewport: Viewport3D,  parent: AbstractClusterComposite) {
        super();
        this.parent = parent;
        this.cluster = clustersGivenK[depth][clusterIdx]
        this.children = [];
        this.isLeaf = true;
        this.viewport = viewport;

        this.setVisualisation(SphereClusterVisualisation, points);
    }

    setVisualisation<T extends AbstractClusterVisualisation>(visualisationType: new(points: vec3[], cluster: ClusterNode, viewport: Viewport3D) => T, points: vec3[]) {
        this.deleteVisualization();
        this.visualisation = new visualisationType(points, this.cluster, this.viewport);
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
        if (this.isLeaf && this.visualisation)
            this.visualisation.updatePoints(points);
    }

    split(clustersGivenK: ClusterNode[][], points: vec3[]) {
        if (!this.isLeaf || this.cluster.k + 1 >= clustersGivenK.length) return;

        let k = this.cluster.k;
        let i = this.cluster.i;
        while (clustersGivenK[k][i].children.length == 1) {
            i = clustersGivenK[k][i].children[0];
            k++;
            
            if (k + 1 >= clustersGivenK.length) return;
        }

        this.isLeaf = false;
        this.deleteVisualization();
        
        for (let clusterIdx of clustersGivenK[k][i].children) {
            this.children.push(new ClusterLeaf(k + 1, clusterIdx, clustersGivenK, points, this.viewport, this));
        }
    }

    rayIntersection(ray: Graphics.Ray): Graphics.Intersection | null {
        if (!this.isLeaf) {
            return null;
        }

        return this.visualisation.rayIntersection(ray);
    }

    deleteVisualization() {
        if (this.visualisation) {
            this.visualisation.delete(this.viewport);
            this.visualisation = null;
        }
    }
}


export abstract class AbstractClusterVisualisation {
    abstract rayIntersection(ray: Graphics.Ray) : Graphics.Intersection;

    constructor(points: vec3[], cluster: ClusterNode, viewport: Viewport3D) {
        // Keep empty
    }

    abstract updatePoints(points: vec3[]);
    abstract updateCluster(points: vec3[], cluster: ClusterNode);
    abstract delete(viewport: Viewport3D);
    abstract setColor(color: vec3);
}


export class SphereClusterVisualisation extends AbstractClusterVisualisation {
    sphere: Graphics.Sphere;
    sphereID: number;
    cluster: ClusterNode;

    constructor(points: vec3[], cluster: ClusterNode, viewport: Viewport3D) {
        super(points, cluster, viewport);

        [this.sphere, this.sphereID] = viewport.scene.addObject(Graphics.Sphere);
        this.updateCluster(points, cluster);
        this.setColor(cluster.color.rgb);
    }

    updateCluster(points: vec3[], cluster: ClusterNode) {
        this.cluster = cluster;
        this.updatePoints(points);
    }

    updatePoints(points: vec3[]) {
        let objectPoints = points.slice(this.cluster.from, this.cluster.to + 1);
        // It is rather inefficient to create an entire AABB just for its center...
        let bb = Graphics.boundingBoxFromPoints(objectPoints);
        this.sphere.properties.center = [bb.center[0], bb.center[1], bb.center[2]];
        this.sphere.properties.radius = objectPoints.length / 1000.0 * 2;

        this.sphere.setDirtyCPU();
    }

    setColor(color: vec3) {
        this.sphere.properties.color = [color[0], color[1], color[2], 1];
        this.sphere.setDirtyCPU();
    }

    rayIntersection(ray: Graphics.Ray): Graphics.Intersection {
        return this.sphere.rayIntersection(ray);
    }
    
    delete(viewport: Graphics.Viewport3D) {
        viewport.scene.removeObjectByID(this.sphereID);
        this.sphereID = null;
        this.sphere = null;
    }
}