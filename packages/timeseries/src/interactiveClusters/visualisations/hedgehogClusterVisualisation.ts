import { vec3 } from "gl-matrix";
import * as Graphics from "lib-graphics";
import type { Viewport3D } from "lib-graphics";
import type { ClusterNode } from "../../utils/main";
import type { CompositeClusters } from "../interactiveClusters";
import { AbstractClusterVisualisation } from "./abstractVisualization";

export class HedgehogClusterVisualisation extends AbstractClusterVisualisation {
    private cluster: ClusterNode;
    private viewport: Viewport3D;
    private cones: Graphics.RoundedCone[] = [];
    private conesIDs: number[] = [];
    private sphere: Graphics.Sphere = null;
    private sphereID: number = null;
    private center: vec3 = vec3.fromValues(0, 0, 0);

    constructor(manager: CompositeClusters, cluster: ClusterNode, viewport: Viewport3D) {
        super(manager, cluster, viewport);

        this.viewport = viewport;

        this.updateCluster(cluster);
        this.setColor(cluster.color.rgb);
    }

    public updateCluster(cluster: ClusterNode) {
        this.cluster = cluster;
    }

    public updatePoints(pointsAtTimestep: vec3[][], selectedTimestep: number) {
        let clusters: ClusterNode[] = this.manager.getClusters();
        let centers = [];
        for (let cluster of clusters) {
            if (cluster != this.cluster) {
                let bb = Graphics.boundingBoxFromPoints(pointsAtTimestep[selectedTimestep].slice(cluster.from, cluster.to + 1))
                centers.push(bb.center);
            }
        }
        let box = Graphics.boundingBoxFromPoints(pointsAtTimestep[selectedTimestep].slice(this.cluster.from, this.cluster.to + 1))
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

    public eventUpdate(pointsAtTimestep: vec3[][], selectedTimestep: number): void {
        this.updatePoints(pointsAtTimestep, selectedTimestep);
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
        this.color = color;
        let c = vec3.copy(vec3.create(), this.color);
        if (this.highlighted) {
            vec3.scale(c, c, 1.8);
        }

        for (let i = 0; i < this.cones.length; i++) {
            this.cones[i].properties.color = [c[0], c[1], c[2], 1.0];
            this.cones[i].setDirtyCPU();
        }

        if (this.sphereID) {
            this.sphere.properties.color = [c[0], c[1], c[2], 1.0];
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

    public getInConnectionPoint() {
        return this.center;
    }

    public getOutConnectionPoint() {
        return this.center;
    }

    public getConstructor() {
        return HedgehogClusterVisualisation;
    }
}