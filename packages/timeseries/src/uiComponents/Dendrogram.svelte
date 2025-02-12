<script lang="ts">
    import type { ClusterCompositeNode } from "../interactiveClusters/clusterCompositeNode";
    import { staticColors } from "../utils/treecolors";
    import type { ClusterNode } from "@chromoskein/components/types";
    import { VisualisationType, type AllOptions } from "../types";

    interface DendrogramProps {
        options: AllOptions;
        clusterTree: ClusterNode[][],
        modelSize: number,
        action: string,
        experimental: boolean,
        update: boolean,
        onmatryoshkaclick: () => void,
        onclick: (amount: number) => void
    }

    let {
        options = $bindable(),
        clusterTree = [],
        modelSize = 0,
        action,
        experimental = false,
        update,
        onmatryoshkaclick = () => {},
        onclick = () => {},
    }: DendrogramProps = $props();

    function onDendrogramClick(depth: number, cluster: ClusterNode | null) {
        if (options.type == VisualisationType.Matryoshka || options.type == VisualisationType.Test) {
            dendrogramClickMatryoshka(depth);
        } else if (cluster != null && options.type == VisualisationType.Composite) {
            callSplitClusters(cluster);
        } else {
            dendrogramClick(depth);
        }
    }

    function dendrogramClick(depth: number) {
        options.blobsAmount = depth + 1;
        onclick(options.blobsAmount);
    }

    function dendrogramClickMatryoshka(depth: number) {
        options.matryoshkaBlobsVisible[depth] = !options.matryoshkaBlobsVisible[depth];
        onmatryoshkaclick()
    }

    function fetchColor(cluster: ClusterNode, i: number, experimental: boolean) {
        let color = [];
        if (experimental) { 
            color = [255 * staticColors[i % staticColors.length][0], 255 * staticColors[i % staticColors.length][1], 255 * staticColors[i % staticColors.length][2]];
        } else {
            color = [255 * cluster.color[0], 255 * cluster.color[1], 255 * cluster.color[2]]
        }
        return color[0] + " " + color[1] + " " + color[2];
    }

    function callSplitClusters(cluster: ClusterNode) {
        let clusterComposite: ClusterCompositeNode | null | undefined = options.interactiveCluster?.getClusterComposite(cluster);
        if (!options.interactiveCluster || !clusterComposite) return;
        switch (action) {
            case "Split":
            options.interactiveCluster.splitClusters(clusterComposite);
            break;
            case "Merge":
            options.interactiveCluster.mergeClusters(clusterComposite);
        }
    }

    function findNodeWithTwoChildren(node: ClusterNode) {
        while (node.children.length == 1 && node.k + 1 < clusterTree.length - 1) { 
            let originalRowIndex = node.k + 1;
            let originalColumnIndex = node.children[0];
            node = clusterTree[originalRowIndex][originalColumnIndex];
        }
        return node;
    }

    function addChildren(list: ClusterNode[][], node: ClusterNode, i: number) {
        for (let c = 0; c < node.children.length; c++) {
            let originalRowIndex = node.k + 1;
            let originalColumnIndex = node.children[c];
            let child = clusterTree[originalRowIndex][originalColumnIndex];
            list[i + 1].push(child);
        }
        return list;
    }

    let sparseDataClustersGivenK: ClusterNode[][] = $derived.by(() => {
        if (options.type != VisualisationType.Composite || !clusterTree) {
            return [];
        }
        let sparseDataClustersGivenK = [];
        sparseDataClustersGivenK.push([]);
        sparseDataClustersGivenK.push(clusterTree[1]);
        
        let i = 1;
        
        while (sparseDataClustersGivenK[i][0].k < clusterTree.length - 1) {
            sparseDataClustersGivenK.push([]);
            for(let j = 0; j < sparseDataClustersGivenK[i].length; j++){
            let node = findNodeWithTwoChildren(sparseDataClustersGivenK[i][j]);
            if(node.k == clusterTree.length - 1){
                sparseDataClustersGivenK[i + 1].push(node);
                continue;
            }
            sparseDataClustersGivenK = addChildren(sparseDataClustersGivenK, node, i);
            }
            i++;
        }
        return sparseDataClustersGivenK;
    });

</script>

<div>
    {#if clusterTree && (options.type != VisualisationType.Composite && options.type != VisualisationType.None)}
      <div class="cluster-dendogram">
        {#each clusterTree.slice(1, 16) as clustersAtLevel, clusterLevel}
          <div role="gridcell" tabindex="{clusterLevel}" class="cluster-dendogram-row" onclick={() => onDendrogramClick(clusterLevel, null)} onkeydown={() => { }}>
            {#each clustersAtLevel as cluster, i}
              <div
                style={`
                  width: ${100.0 * ((cluster.to - cluster.from + 1) / modelSize)}%;
                  background-color: rgb(${fetchColor(cluster, i, experimental)});
                  border: 2px solid ${((options.type == VisualisationType.Test || options.type == VisualisationType.Matryoshka) && options.matryoshkaBlobsVisible[clusterLevel]) || (options.type != VisualisationType.Matryoshka && options.blobsAmount == clusterLevel + 1) ? "white" : "black"}
                `}
              > </div>
            {/each}
          </div>
        {/each}
      </div>
    {/if}
    {#key update}
        {#if sparseDataClustersGivenK && options.type == VisualisationType.Composite}
        <div class="cluster-dendogram">
            {#each sparseDataClustersGivenK.slice(1, 16) as clustersAtLevel, clusterLevel}
            <div class="cluster-dendogram-row">
                {#each clustersAtLevel as cluster, i}
                <div role="gridcell" tabindex="{clusterLevel}" onclick={() => onDendrogramClick(clusterLevel, cluster)} onkeydown={() => { }}
                    style={`
                        width: ${100.0 * ((cluster.to - cluster.from + 1) / modelSize)}%;
                        background-color: rgb(${fetchColor(cluster, i, experimental)});
                        border: 2px solid black
                    `}
                > </div>
                {/each}
            </div>
            {/each}
        </div>
        {/if}
    {/key}
</div>


<style> 
    .cluster-dendogram {
      width: 100%;
      display: flex;
      flex-direction: column;
      border: 1px solid black;
    }
  
    .cluster-dendogram-row {
      height: 20px;
      display: flex;
      flex-direction: row;
      border-bottom: 2px solid black;
    }
  
    .cluster-dendogram:last-child {
      border-bottom: 0px;
    }
  
    .cluster-dendogram-row div {
      border-right: 4px solid black;
      display: block;
    }
  
    .cluster-dendogram-row:last-child {
      border: 0px;
    }
</style>