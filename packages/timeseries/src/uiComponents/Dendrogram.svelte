
<script lang="ts">
    import {VisualisationType} from "../utils/main";
    import type { ClusterNode } from "../utils/main";
    import { staticColors } from "../utils/treecolors";
    import InteractiveCluster from "../visalizations/InteractiveCluster.svelte";


    export let visualizationSelected: VisualisationType = VisualisationType.Pathline;
    export let dataClustersGivenK: ClusterNode[][] = [];
    export let modelSize: number = 0;
    export let blobsAmount: number = 1;
    export let action: string;
    export let experimental: boolean = false;
    export let matryoshkaVisibility: boolean[] = [];
    export let interactiveCluster: InteractiveCluster | null;
    export let update:boolean;

    function onDendrogramClick(depth: number, cluster: ClusterNode | null) {
        if (visualizationSelected == VisualisationType.Matryoshka || visualizationSelected == VisualisationType.Test) {
            dendrogramClickMatryoshka(depth);
        }
        else if (cluster != null && visualizationSelected == VisualisationType.Composite) {
            callSplitClusters(cluster);
        } else {
            dendrogramClick(depth);
        }
    }

    function dendrogramClick(depth: number) {
        blobsAmount = depth + 1;
    }

    function dendrogramClickMatryoshka(depth: number) {
        matryoshkaVisibility[depth] = !matryoshkaVisibility[depth];
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
        let clusterComposite = interactiveCluster?.getClusterComposite(cluster);
        switch (action) {
            case "Split":
            interactiveCluster?.splitClusters(clusterComposite);
            break;
            case "Merge":
            interactiveCluster?.mergeClusters(clusterComposite);
        }
    }

    function findNodeWithTwoChildren(node: ClusterNode) {
        while (node.children.length == 1 && node.k + 1 < dataClustersGivenK.length - 1) { 
            let originalRowIndex = node.k + 1;
            let originalColumnIndex = node.children[0];
            node = dataClustersGivenK[originalRowIndex][originalColumnIndex];
        }
        return node;
    }

    function addChildren(list: ClusterNode[][], node: ClusterNode, i: number) {
        for (let c = 0; c < node.children.length; c++) {
            let originalRowIndex = node.k + 1;
            let originalColumnIndex = node.children[c];
            let child = dataClustersGivenK[originalRowIndex][originalColumnIndex];
            list[i + 1].push(child);
        }
        return list;
    }

    let sparseDataClustersGivenK: ClusterNode[][] = [];

    $: if (visualizationSelected == VisualisationType.Composite && dataClustersGivenK) {
        sparseDataClustersGivenK = [];
        sparseDataClustersGivenK.push([]);
        sparseDataClustersGivenK.push(dataClustersGivenK[1]);
        
        let i = 1;
        
        while (sparseDataClustersGivenK[i][0].k < dataClustersGivenK.length - 1) {
            sparseDataClustersGivenK.push([]);
            for(let j = 0; j < sparseDataClustersGivenK[i].length; j++){
            let node = findNodeWithTwoChildren(sparseDataClustersGivenK[i][j]);
            if(node.k == dataClustersGivenK.length - 1){
                sparseDataClustersGivenK[i + 1].push(node);
                continue;
            }
            sparseDataClustersGivenK = addChildren(sparseDataClustersGivenK, node, i);
            }
            i++;
        }
    }

</script>

<div>
    {#if dataClustersGivenK && (visualizationSelected != VisualisationType.Composite && visualizationSelected != VisualisationType.None)}
      <div class="cluster-dendogram">
        {#each dataClustersGivenK.slice(1, 16) as clustersAtLevel, clusterLevel}
          <div role="gridcell" tabindex="{clusterLevel}" class="cluster-dendogram-row" on:click={() => onDendrogramClick(clusterLevel, null)} on:keydown={() => { }}>
            {#each clustersAtLevel as cluster, i}
              <div
                style={`
                  width: ${100.0 * ((cluster.to - cluster.from + 1) / modelSize)}%;
                  background-color: rgb(${fetchColor(cluster, i, experimental)});
                  border: 2px solid ${((visualizationSelected == VisualisationType.Test || visualizationSelected == VisualisationType.Matryoshka) && matryoshkaVisibility[clusterLevel]) || (visualizationSelected != VisualisationType.Matryoshka && blobsAmount == clusterLevel + 1) ? "white" : "black"}
                `}
              > </div>
            {/each}
          </div>
        {/each}
      </div>
    {/if}
    {#key update}
        {#if sparseDataClustersGivenK && visualizationSelected == VisualisationType.Composite}
        <div class="cluster-dendogram">
            {#each sparseDataClustersGivenK.slice(1, 16) as clustersAtLevel, clusterLevel}
            <div class="cluster-dendogram-row">
                {#each clustersAtLevel as cluster, i}
                <div role="gridcell" tabindex="{clusterLevel}" on:click={() => onDendrogramClick(clusterLevel, cluster)} on:keydown={() => { }}
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