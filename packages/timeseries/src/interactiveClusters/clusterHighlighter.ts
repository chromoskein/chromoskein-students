import type { ClusterComposite } from "./clusterComposite";

export class ClusterHighlighter {
    private highlightedClusters: ClusterComposite[];

    constructor() {
        this.highlightedClusters = [];
    }

    public updateHighlightedClusters(hitCluster: ClusterComposite, type: String) {
        if (hitCluster == null) {
            this.removeHighlights();
            return;
        }

        switch (type) {
            case "Normal":
                let found = false;
                for (let cluster of this.highlightedClusters) {
                    if (cluster != hitCluster) {
                        cluster.getVisualisation()?.setHighlighted(false);
                    } else {
                        found = true;
                    }
                }

                if (!found) hitCluster.getVisualisation()?.setHighlighted(true);
                this.highlightedClusters = [hitCluster];
                break;
            case "Merge":
                let toHightlight = [];
                if (hitCluster.parent == null) {
                    toHightlight = [hitCluster];
                } else {
                    toHightlight = hitCluster.parent.getInorder();
                }

                for (let cluster of this.highlightedClusters) {
                    if (!toHightlight.includes(cluster)) {
                        cluster.getVisualisation()?.setHighlighted(false);
                    }
                }

                toHightlight.forEach((cluster: ClusterComposite) => cluster.getVisualisation()?.setHighlighted(true));
                this.highlightedClusters = toHightlight;
                break;
        } 
        // Do something here
    }

    public removeHighlights() {
        this.highlightedClusters.forEach((cluster: ClusterComposite) => cluster.getVisualisation()?.setHighlighted(false));
        this.highlightedClusters = [];
    }

    public addHighlightedClusters(newHighlightedClusters: ClusterComposite[]) {
        // This is probably useless, but might not be.
    }
}