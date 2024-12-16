import type { vec3 } from "gl-matrix";
import { clusterPathlines, clusterTimestep, timestepsToPathlines, type ClusterNode } from "./main";
import { treeColor } from "./treecolors";

self.onmessage = (event: MessageEvent) => {
    const pointTimesteps: vec3[][] = event.data;

    let clusters: ClusterNode[][];
    // If there is more than a single timestep cluster it as pathlines
    if (pointTimesteps.length > 1) {
        const pathlines = timestepsToPathlines(pointTimesteps);
        clusters = clusterPathlines(pathlines).slice(0, 16);
    } else {
        clusters = clusterTimestep(pointTimesteps[0]).slice(0, 16);
        console.log(clusters);
    }
    treeColor(clusters);
    self.postMessage(clusters);
};