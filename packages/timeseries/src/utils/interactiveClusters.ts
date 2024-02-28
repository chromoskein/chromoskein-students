import { vec3 } from "gl-matrix";
import * as Graphics from "lib-graphics";
import type { Viewport3D } from "lib-graphics";
import type { ClusterNode } from "./main";
import { blobFromPoints } from "./main";
import PCA from 'pca-js';

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


export abstract class AbstractClusterVisualisation {
    protected manager: InteractiveClusters;
    protected center: vec3 = vec3.fromValues(0, 0, 0);

    constructor(manager: InteractiveClusters, points: vec3[], cluster: ClusterNode, viewport: Viewport3D) {
        this.manager = manager;
    }
    
    abstract rayIntersection(ray: Graphics.Ray) : Graphics.Intersection;
    abstract updatePoints(points: vec3[]);
    abstract updateCluster(cluster: ClusterNode);
    abstract delete(viewport: Viewport3D);
    abstract setColor(color: vec3);
    abstract getConstructor();  

    public getCenter(): vec3 { return this.center; }
    public eventUpdate(points: vec3[]) { /* For most subclasses this is unnecessary */ }
}


export class SphereClusterVisualisation extends AbstractClusterVisualisation {
    private sphere: Graphics.Sphere;
    private sphereID: number;
    private cluster: ClusterNode;

    constructor(manager: InteractiveClusters, points: vec3[], cluster: ClusterNode, viewport: Viewport3D) {
        super(manager, points, cluster, viewport);

        [this.sphere, this.sphereID] = viewport.scene.addObject(Graphics.Sphere);
        this.updateCluster(cluster);
        this.setColor(cluster.color.rgb);
    }

    public updateCluster(cluster: ClusterNode) {
        this.cluster = cluster;
    }

    public updatePoints(points: vec3[]) {
        let objectPoints = points.slice(this.cluster.from, this.cluster.to + 1);
        // It is rather inefficient to create an entire axis aligned bounding box
        // just to calculate the mean position of a bunch of points...
        let bb = Graphics.boundingBoxFromPoints(objectPoints);
        this.sphere.properties.center = [bb.center[0], bb.center[1], bb.center[2]];
        this.center = bb.center;
        this.sphere.properties.radius = objectPoints.length / 1000.0 * 2;

        this.sphere.setDirtyCPU();
    }

    public setColor(color: vec3) {
        this.sphere.properties.color = [color[0], color[1], color[2], 1];
        this.sphere.setDirtyCPU();
    }

    public rayIntersection(ray: Graphics.Ray): Graphics.Intersection {
        return this.sphere.rayIntersection(ray);
    }
    
    public delete(viewport: Graphics.Viewport3D) {
        viewport.scene.removeObjectByID(this.sphereID);
        this.sphereID = null;
        this.sphere = null;
    }

    public getConstructor() {
        return SphereClusterVisualisation;
    }
}

export class HedgehogClusterVisualisation extends AbstractClusterVisualisation {
    private cluster: ClusterNode;
    private viewport: Viewport3D;
    private cones: Graphics.RoundedCone[] = [];
    private conesIDs: number[] = [];
    private sphere: Graphics.Sphere = null;
    private sphereID: number = null;

    constructor(manager: InteractiveClusters, points: vec3[], cluster: ClusterNode, viewport: Viewport3D) {
        super(manager, points, cluster, viewport);

        this.viewport = viewport;

        this.updateCluster(cluster);
        this.setColor(cluster.color.rgb);
    }

    public updateCluster(cluster: ClusterNode) {
        this.cluster = cluster;
    }

    public updatePoints(points: vec3[]) {
        let clusters: ClusterNode[] = this.manager.getClusters();
        let centers = [];
        for (let cluster of clusters) {
            if (cluster != this.cluster) {
                let bb = Graphics.boundingBoxFromPoints(points.slice(cluster.from, cluster.to + 1))
                centers.push(bb.center);
            }
        }
        let box = Graphics.boundingBoxFromPoints(points.slice(this.cluster.from, this.cluster.to + 1))
        let coneCenter = box.center;
        this.center = box.center;

        // Would be faster if there was some way to get cluster centers efficiently
        let nearbyDirections = this.getDirections(coneCenter, centers);

        // I would rather prefer to ad-hoc add/remove the objects only as needed
        // and update the existing ones instead of deleting everything and starting over every time
        this.delete(this.viewport);

        const coneStartRadius = 0.1;
        const coneHeight = 0.3;
        for (let i = 0; i < nearbyDirections.length; i++) {
            [this.cones[i], this.conesIDs[i]] = this.viewport.scene.addObject(Graphics.RoundedCone);     
            this.cones[i].properties.start = [coneCenter[0], coneCenter[1], coneCenter[2]];
            this.cones[i].properties.end = [
                coneCenter[0] + coneHeight * nearbyDirections[i][0],
                coneCenter[1] + coneHeight * nearbyDirections[i][1],
                coneCenter[2] + coneHeight * nearbyDirections[i][2],
            ];
            this.cones[i].properties.startRadius = coneStartRadius;
            this.cones[i].properties.endRadius = 0.0001;
            this.cones[i].setDirtyCPU();
        }

        if (nearbyDirections.length == 0) {
            [this.sphere, this.sphereID] = this.viewport.scene.addObject(Graphics.Sphere);
            this.sphere.properties.center = [coneCenter[0], coneCenter[1], coneCenter[2]];
            this.sphere.properties.radius = coneStartRadius;    
            this.sphere.setDirtyCPU();
        }

        this.setColor(this.cluster.color.rgb);
    }

    public eventUpdate(points: vec3[]): void {
        this.updatePoints(points);
    }

    private getDirections(center: vec3, otherCenters: vec3[]): vec3[] {
        let directions = [];
        for (let otherCenter of otherCenters) {
            let direction = vec3.sub(vec3.fromValues(0, 0, 0), otherCenter, center);
            
            // Here the code decides how far to create octopi tentacles
            const nearbyDistanceValue = 0.9;
            if (vec3.len(direction) < nearbyDistanceValue) {
                let normalizedDirection = vec3.normalize(vec3.fromValues(0, 0, 0), direction);
                directions.push(normalizedDirection);
            }
        }
        return directions;
    }

    public setColor(color: vec3) {
        for (let i = 0; i < this.cones.length; i++) {
            this.cones[i].properties.color = [color[0], color[1], color[2], 1.0];
            this.cones[i].setDirtyCPU();
        }

        if (this.sphereID) {
            this.sphere.properties.color = [color[0], color[1], color[2], 1.0];
            this.sphere.setDirtyCPU();
        }
    }

    public rayIntersection(ray: Graphics.Ray): Graphics.Intersection {
        if (this.sphereID != null) {
            return this.sphere.rayIntersection(ray);
        }
        
        let bestT = Infinity
        let bestIntersection = null;
        for (let object of this.cones) {
            let intersection = object.rayIntersection(ray);
            if (intersection != null && intersection.t < bestT) {
                bestT = intersection.t;
                bestIntersection = intersection;
            }
        }

        return bestIntersection;
    }
    
    public delete(viewport: Graphics.Viewport3D) {
        for (let i = 0; i < this.conesIDs.length; i++) {
            viewport.scene.removeObjectByID(this.conesIDs[i]);
        } 
        this.conesIDs = [];
        this.cones = [];

        if (this.sphereID) {
            viewport.scene.removeObjectByID(this.sphereID);
            this.sphereID = null;
            this.sphere = null;
        }
    }

    public getConstructor() {
        return HedgehogClusterVisualisation;
    }
}

export class PCAClusterVisualisation extends AbstractClusterVisualisation {
    private cluster: ClusterNode;
    private coneUp: Graphics.RoundedCone;
    private coneUpID: number | null = null;
    private coneDown: Graphics.RoundedCone;
    private coneDownID: number | null = null;

    constructor(manager: InteractiveClusters, points: vec3[], cluster: ClusterNode, viewport: Viewport3D) {
        super(manager, points, cluster, viewport);

        [this.coneUp, this.coneUpID] = viewport.scene.addObject(Graphics.RoundedCone);
        this.coneUp.setDirtyCPU();
  
        [this.coneDown, this.coneDownID] = viewport.scene.addObject(Graphics.RoundedCone);
        this.coneDown.setDirtyCPU();

        this.updateCluster(cluster);
        this.setColor(cluster.color.rgb);
    }

    public updateCluster(cluster: ClusterNode) {
        this.cluster = cluster;
    }

    public updatePoints(points: vec3[]) {
        let blob = blobFromPoints(points.slice(this.cluster.from, this.cluster.to + 1))
        let result = PCA.getEigenVectors(blob.normalizedPoints);
        this.center = blob.center;
       
        const coneHeight = result[0].eigenvalue / 40.0 + 0.1;
        const coneOrientation = vec3.fromValues(result[0].vector[0], result[0].vector[1], result[0].vector[2]);
        const coneStartRadius = result[1].eigenvalue / 40.0 + 0.1;

        this.coneUp.properties.start = [blob.center[0], blob.center[1], blob.center[2]];
        this.coneUp.properties.end = [
            blob.center[0] + coneHeight * coneOrientation[0],
            blob.center[1] + coneHeight * coneOrientation[1],
            blob.center[2] + coneHeight * coneOrientation[2],
        ];
        this.coneUp.properties.startRadius = coneStartRadius;
        this.coneUp.properties.endRadius = 0.0001;
        this.coneUp.setDirtyCPU();
  
        this.coneDown.properties.start = [blob.center[0], blob.center[1], blob.center[2]];
        this.coneDown.properties.end = [
            blob.center[0] - coneHeight * coneOrientation[0],
            blob.center[1] - coneHeight * coneOrientation[1],
            blob.center[2] - coneHeight * coneOrientation[2],
        ];
        this.coneDown.properties.startRadius = coneStartRadius;
        this.coneDown.properties.endRadius = 0.0001;
        this.coneDown.setDirtyCPU();
    }

    public setColor(color: vec3) {
        if (this.coneDownID && this.coneUpID) {
            this.coneUp.properties.color = [color[0], color[1], color[2], 1.0];
            this.coneDown.properties.color = [color[0], color[1], color[2], 1.0];
            this.coneUp.setDirtyCPU();
            this.coneDown.setDirtyCPU();
        }
    }

    public rayIntersection(ray: Graphics.Ray): Graphics.Intersection {
        let upIntersection = this.coneDown.rayIntersection(ray);
        let downIntersection = this.coneUp.rayIntersection(ray);

        if (upIntersection == null && downIntersection == null) {
            return null;
        }
        
        return (downIntersection == null || upIntersection.t < downIntersection.t) ? upIntersection : downIntersection;
    }
    
    public delete(viewport: Graphics.Viewport3D) {
        if (this.coneDownID && this.coneUpID) {
            viewport.scene.removeObjectByID(this.coneUpID);
            viewport.scene.removeObjectByID(this.coneDownID);
            
            this.coneDownID = null;
            this.coneDown = null;
            this.coneUpID = null;
            this.coneUp = null;
        }
    }

    public getConstructor() {
        return PCAClusterVisualisation;
    }
}

export class SDGClusterVisualisation extends AbstractClusterVisualisation {
    private cluster: ClusterNode;
    private sdgObject: Graphics.SignedDistanceGrid;
    private sdgObjectID: number | null = null;

    constructor(manager: InteractiveClusters, points: vec3[], cluster: ClusterNode, viewport: Viewport3D) {
        super(manager, points, cluster, viewport);

        [this.sdgObject, this.sdgObjectID] = viewport.scene.addObject(Graphics.SignedDistanceGrid);
        this.sdgObject.setDirtyCPU();

        this.updateCluster(cluster);
        this.setColor(cluster.color.rgb);
    }

    public updateCluster(cluster: ClusterNode) {
        this.cluster = cluster;
    }

    public updatePoints(points: vec3[]) {
        let blob = blobFromPoints(points.slice(this.cluster.from, this.cluster.to + 1))
        this.center = blob.center;
        this.sdgObject.translate([blob.center[0], blob.center[1], blob.center[2]], 0);
        this.sdgObject.scale(blob.scale, 0);
        this.sdgObject.fromPoints(this.manager.getDevice(), [blob.normalizedPoints], [0.03]);
        this.sdgObject.setDirtyCPU();
    }

    public setColor(color: vec3) {
        if (this.sdgObjectID) {
            this.sdgObject.properties[0].color = [color[0], color[1], color[2], 1.0];
            this.sdgObject.setDirtyCPU();
        }
    }

    public rayIntersection(ray: Graphics.Ray): Graphics.Intersection {
        return this.sdgObject.rayIntersection(ray);
    }
    
    public delete(viewport: Graphics.Viewport3D) {
        if (this.sdgObjectID) {
            viewport.scene.removeObjectByID(this.sdgObjectID);
            
            this.sdgObjectID = null;
            this.sdgObject = null;
        }
    }

    public getConstructor() {
        return SDGClusterVisualisation;
    }

}

export class PathlineClusterVisualization extends AbstractClusterVisualisation {
    private cluster: ClusterNode;
    private viewport: Viewport3D;
    private pathline: Graphics.RoundedConeInstanced;
    private pathlineID: number | null = null;
    private n_instances: number = 0;

    constructor(manager: InteractiveClusters, points: vec3[], cluster: ClusterNode, viewport: Viewport3D) {
        super(manager, points, cluster, viewport);

        this.viewport = viewport;
        this.updateCluster(cluster);
    }

    public updateCluster(cluster: ClusterNode) {
        this.cluster = cluster;
    }

    public updatePoints(points: vec3[]) {
        let clusterPoints = points.slice(this.cluster.from, this.cluster.to + 1);
        
        // Again here the really inefficient way to get center of points
        let box = Graphics.boundingBoxFromPoints(clusterPoints)
        this.center = box.center;

        if (this.pathlineID == null || this.n_instances != clusterPoints.length - 1) {
            this.delete(this.viewport);
            [this.pathline, this.pathlineID] = this.viewport.scene.addObjectInstanced(
                Graphics.RoundedConeInstanced,
                clusterPoints.length - 1
            );
            this.n_instances = clusterPoints.length - 1;
            this.setColor(this.cluster.color.rgb);
        }

        for (let i = 0; i < clusterPoints.length - 1; i++) {
            this.pathline.properties[i].start = [clusterPoints[i][0], clusterPoints[i][1], clusterPoints[i][2]];
            this.pathline.properties[i].end = [
                clusterPoints[i + 1][0],
                clusterPoints[i + 1][1],
                clusterPoints[i + 1][2],
            ];
      
            this.pathline.properties[i].startRadius = 0.04;
            this.pathline.properties[i].endRadius = 0.04;
      
          }
          this.pathline.setDirtyCPU();
    }

    public setColor(color: vec3) {
        if (this.pathlineID) {
            for (let i = 0; i < this.n_instances - 1; i++) {
                this.pathline.properties[i].startColor = [color[0], color[1], color[2], 1.0];
                this.pathline.properties[i].endColor = [color[0], color[1], color[2], 1.0];
            }
            this.pathline.setDirtyCPU();
        }
    }

    public rayIntersection(ray: Graphics.Ray): Graphics.Intersection {
        return this.pathline.rayIntersection(ray);
    }
    
    public delete(viewport: Graphics.Viewport3D) {
        if (this.pathlineID) {
            viewport.scene.removeObjectByID(this.pathlineID);
            
            this.pathlineID = null;
            this.pathline = null;
        }
    }

    public getConstructor() {
        return PathlineClusterVisualization;
    }
}

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
