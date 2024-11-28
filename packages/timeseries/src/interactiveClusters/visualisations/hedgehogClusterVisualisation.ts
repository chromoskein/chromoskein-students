import { vec3 } from "gl-matrix";
import * as Graphics from "@chromoskein/lib-graphics";
import type { Viewport3D } from "@chromoskein/lib-graphics";
import type { ClusterNode } from "../../utils/main";
import type { CompositeClusters } from "../compositeClusters";
import { AbstractClusterVisualisation } from "./abstractVisualization";
import type { VisOptions } from "../../utils/data-models";
import { calculateSphereParameters, findClosestPoints } from "../../utils/abstractClustersUtils";

export class HedgehogClusterVisualisation extends AbstractClusterVisualisation {
    private cluster: ClusterNode;
    private viewport: Viewport3D;
    private cones: Graphics.RoundedCone[] = [];
    private conesIDs: number[] = [];
    private sphere: Graphics.Sphere = null;
    private sphereID: number = null;
    private center: vec3 = vec3.fromValues(0, 0, 0);
    private radius: number = 0.1;
    private threshold: number = 0.5;
    private secondPoint: boolean = false;
    private minDistance = 0.1;
    private precise: boolean = false;
    private radiusMultiplier: number = 4.0;

    constructor(manager: CompositeClusters, cluster: ClusterNode, viewport: Viewport3D) {
        super(manager, cluster, viewport);
        this.minDistance = manager.getOptions().hedgehogDistance;
        this.precise = manager.getOptions().preciseQuills;
        this.secondPoint = manager.getOptions().secondPoint;    
        this.threshold = manager.getOptions().hedgehogThreshold;    
        this.viewport = viewport;
        this.radiusMultiplier = manager.getOptions().abstractionMultiplier;

        this.updateCluster(cluster);
        this.setColor(cluster.color.rgb);
    }

    public updateCluster(cluster: ClusterNode) {
        this.cluster = cluster;
    }

    
    public updateParameters(options: VisOptions) {
        this.minDistance = options.hedgehogDistance;
        this.precise = options.preciseQuills;
        this.secondPoint = options.secondPoint;        
        this.threshold = options.hedgehogThreshold;
        this.radiusMultiplier = options.abstractionMultiplier;
        this.updatePoints(this.manager.getPoints(), this.manager.getTimestep());
        // Do nothing 
    }

    public updatePoints(pointsAtTimestep: vec3[][], selectedTimestep: number) {

        let quills = [];
        let clusterPoints = pointsAtTimestep[selectedTimestep].slice(this.cluster.from, this.cluster.to + 1);
        let params = calculateSphereParameters(clusterPoints);
        this.radius = params.radius / this.radiusMultiplier;
        this.center = params.center;
  
        let clusters: ClusterNode[] = this.manager.getClusters();
        for (let i = 0; i < clusters.length; i++) {
          if (clusters[i] == this.cluster) continue;
  
          let otherClusterPoints = pointsAtTimestep[selectedTimestep].slice(clusters[i].from, clusters[i].to + 1);
          let closestPoints = findClosestPoints(clusterPoints, otherClusterPoints, this.minDistance, this.threshold, this.secondPoint); 
          if (this.precise) {
            closestPoints.forEach(element => quills.push(element));
          }
          else if (closestPoints.length > 0) {
            quills.push(vec3.lerp(vec3.create(), this.center, calculateSphereParameters(otherClusterPoints).center, 0.5));
          }
        }

        // I would rather prefer to ad-hoc add/remove the objects only as needed
        // and update the existing ones instead of deleting everything and starting over every time
        this.delete(this.viewport);

        for (let i = 0; i < quills.length; i++) {  
            [this.cones[i], this.conesIDs[i]] = this.viewport.scene.addObject(Graphics.RoundedCone);           
            this.cones[i].properties.start = [this.center[0], this.center[1], this.center[2]];
            this.cones[i].properties.end = [
                quills[i][0],
                quills[i][1],
                quills[i][2],
            ]
            
            this.cones[i].properties.startRadius = this.radius;
            this.cones[i].properties.endRadius = 0.001;
            this.cones[i].properties.color = [this.color[0], this.color[1], this.color[2], 1.0];
            this.cones[i].setDirtyCPU();
          }
    
          if (quills.length == 0) {
            [this.sphere, this.sphereID] = this.viewport.scene.addObject(Graphics.Sphere);
            this.sphere.properties.radius = this.radius;
            this.sphere.properties.center = [this.center[0], this.center[1], this.center[2]];
            this.sphere.properties.color = [this.color[0], this.color[1], this.color[2], 1.0];
            this.sphere.setDirtyCPU();
          }

        this.setColor(this.cluster.color.rgb);
    }

    public eventUpdate(pointsAtTimestep: vec3[][], selectedTimestep: number): void {
        this.updatePoints(pointsAtTimestep, selectedTimestep);
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