import type { vec3 } from "gl-matrix";
import type * as Graphics from "@chromoskein/lib-graphics";
import type { Viewport3D } from "@chromoskein/lib-graphics";
import type { ClusterNode } from "../../utils/main";
import type { CompositeClusters } from "../compositeClusters";
import type { AllOptions } from "../../types";

/**
 * This class holds the scene objects used by ClusterCompositeNodes to render clusters
 * Essentially represents the strategy object of the strategy pattern
 */
export abstract class AbstractClusterVisualisation {
    protected manager: CompositeClusters;
    protected highlighted: Boolean = false;
    protected color: vec3;

    constructor(manager: CompositeClusters, cluster: ClusterNode, viewport: Viewport3D) {
        this.manager = manager;
        this.color = cluster.color;
    }
    
    /**
     * Allows application to intersect the object
     * @param ray Ray which intersects objects
     */
    abstract rayIntersection(ray: Graphics.Ray) : Graphics.Intersection | null;
    /**
     * Updates the points when timestep is changed
     * @param pointsAtTimestep All points over all timesteps
     * @param selectedTimestep Current selected timestep
     */
    abstract updatePoints(pointsAtTimestep: vec3[][], selectedTimestep: number): void;
    /**
     * Updates the cluster that defines the points of this object
     * @param cluster Information about the cluster
     */
    abstract updateCluster(cluster: ClusterNode): void;
    /**
     * Deletes the object in the scene
     * @param viewport Viewport that this object resides in
     */
    abstract delete(viewport: Viewport3D): void;
    /**
     * Changes the color of the cluster visualization
     * @param color Color
     */
    abstract setColor(color: vec3): void;
    /**
     * Returns the constructor of this class
     */
    abstract getConstructor(): any;  

    abstract updateParameters(options: AllOptions): void;

    /**
     * Used by the clusterHighlighter to highlight this clusters
     * @param highlight True if object is highlighted
     */
    public setHighlighted(highlight: Boolean) {
        let old = this.highlighted;

        if (old != highlight) {
            this.highlighted = highlight;
            this.setColor(this.color);
        }
    }

    /**
     * Returns the "start" point of this cluster (e.g., first point in sequence) for cluster connectors
     */
    abstract getInConnectionPoint(): vec3;
    /**
     * Returns the "end" point  (e.g., first point in sequence) of this cluster
     */
    abstract getOutConnectionPoint(): vec3;
    /**
     * This function is called when a different cluster is updated
     * Used by clusters whose form depends on positions/sizes etc. of other clusters
     * @param pointsAtTimestep All points over all timesteps
     * @param selectedTimestep Current selected timestep
     */
    public eventUpdate(pointsAtTimestep: vec3[][], selectedTimestep: number) { /* For most subclasses this is unnecessary */ }
}