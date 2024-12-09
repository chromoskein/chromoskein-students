import type { vec3 } from "gl-matrix";
import { clusterPathlines, clusterTimestep, type ClusterNode } from "./main";
import { treeColor } from "./treecolors";

self.onmessage = (event: MessageEvent) => {
    const pointTimesteps: vec3[][] = event.data;
    console.log("Started", event.data);

    let clusters: ClusterNode[][] = null;
    // If there is more than a single timestep cluster it as pathlines
    if (pointTimesteps.length > 1) {
        clusters = clusterPathlines(pointTimesteps).slice(0, 16);
    } else {
        clusters = clusterTimestep(pointTimesteps[0]).slice(0, 16);
        console.log(clusters);
    }
    treeColor(clusters);
    console.log("Ended");
    self.postMessage(clusters);
};