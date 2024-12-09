<script lang="ts">
    import { Button, Checkbox, DataTable, Modal, Toggle } from "carbon-components-svelte";
    import { type ChromatinModel, parsePdb } from "lib-dataloader";
    import { vec3 } from "gl-matrix";
    import { normalizePointClouds } from "../utils/main";
    import { getClustering, getEmptyClustering, initializeChromosome, type Chromosome } from "../utils/data-models";

    export let open = false;
    export let outputChromosomes: Chromosome[] = [];

    let normalize: boolean = false;
    let separate: boolean = false;
    
    type TableItem = {
        id: number,
        name: string,
        from: number,
        to: number,
        include: boolean,
    }

    let loadedData: TableItem[] = [];
    let points: vec3[] = [];

    let id = 0;
    function loadFiles(event: Event) {
        const input = event.target as HTMLInputElement; 
        const loadedFiles = input.files;
        for (let i = 0; i < loadedFiles.length; i++) {
            const file = loadedFiles.item(i);
            file.text().then(pdbText => {
                let chromatinModel: ChromatinModel = parsePdb(pdbText);
                points = chromatinModel.bins.map((v) => vec3.fromValues(v.x, v.y, v.z))

                loadedData = [];
                chromatinModel.ranges.forEach((model, index) => {
                    const name = model.name + " " + (index + 1);
                    loadedData.push({
                        id: id++,
                        name: name,
                        from: model.from,
                        to: model.to,
                        include: true
                    })
                });
            });
        }
        input.value = null;
    }

    function reset() {
        loadedData = [];
        points = [];
        normalize = false;
        separate = false;
    }


    function finalizeData() {
        let filteredData = loadedData.filter((item, index) => item.include);

        let modelPoints = filteredData.map((item, index) => points.slice(item.from, item.to + 1));

        if (normalize) {
            modelPoints = normalizePointClouds(modelPoints);
        }

        let chromosomes = [];
        if (!separate) {
            let concatPoints: vec3[] = modelPoints.flat();
            // Update the from and to indexes of data based on filtering done in selection
            let indexStart = 0;
            for (let i = 0; i < filteredData.length; i++) {
                filteredData[i].from = indexStart;
                filteredData[i].to = indexStart + modelPoints[i].length - 1;
                indexStart = indexStart + modelPoints[i].length;
            }

            let chromosome = initializeChromosome("Chromosome", [concatPoints]);
            let clusters = [[], [getEmptyClustering(points.length - 1)]]
            // Dont create a second hierarchy level if only a single model is selected
            if (filteredData.length > 1) {
                let modelClusterIndices = [];
                let modelClusters = [];
                filteredData.forEach((model, index) => {
                    modelClusters.push(getClustering(model.from, model.to, 2, index));
                    modelClusterIndices.push(index);
                });
                clusters[1][0].children = modelClusterIndices;
                clusters.push(modelClusters);
            }

            chromosome.clusters = clusters;
            chromosomes = [chromosome];
        } else {
            filteredData.forEach((model, index) => {
                chromosomes.push(initializeChromosome(model.name, [modelPoints[index]]));
            });
        }

        outputChromosomes = chromosomes;
    }
</script>
  
<div>
  <Modal
    bind:open
    modalHeading="Load Models"
    primaryButtonText="Add"
    secondaryButtonText="Cancel"
    on:click:button--secondary={() => open = false}
    on:open={() => reset()}
    on:close
    on:submit={() => {finalizeData(); open = false}}
  >

    <input type="file"  accept=".pdb,.PDB" id="file-input" on:change={(event) => loadFiles(event)}/>
    <Button
        kind="secondary"
        size="field"
        on:click={() => { document.getElementById("file-input").click()}}
    >  
        Upload
    </Button>

    <Checkbox labelText="Normalize Data" bind:checked={normalize} />
    <Checkbox labelText="Separate Models" bind:checked={separate} />

    {#if loadedData.length > 0}
        <DataTable
            title="Loaded models:"
            headers={[
            { key: "name", value: "Name" },
            { key: "from", value: "Start" },
            { key: "to", value: "End" },
            { key: "include", value: "Include" },
            ]}
            rows={loadedData}
        >
            <svelte:fragment slot="cell" let:row let:cell>
                {#if cell.key === "include"}
                    <Toggle labelText="Include" hideLabel toggled={cell.value} labelA="No" labelB="Yes"  on:change={() => { 
                        // This seems like quite a disgusting way of doing this, but it works
                        let item = loadedData.filter(item => item.id == row.id)[0];
                        item.include = !item.include;
                    }}
                    />
                {:else}
                    {cell.value}
                {/if}
            </svelte:fragment>
        </DataTable>
    {/if}

  </Modal>
</div>


<style> 
    #file-input {
      display: none;
    }
</style>
  