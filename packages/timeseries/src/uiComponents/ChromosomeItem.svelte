
<script lang="ts">

import { Checkbox } from "carbon-components-svelte";
import type { Chromosome } from "../utils/data-models";

export let chromosome: Chromosome;

let checked = true;

$: if (chromosome) {
    chromosome.visible = checked;
    console.log(chromosome);
}

</script>


<div class="itemStyle">
    <p> Name: {chromosome.name} </p>
    <Checkbox bind:checked labelText="Visible" /> 
</div>


<style>  
    .itemStyle {
      width: 100%;
      border: 2px solid darkgray;
      margin-top: 4px;
      padding: 2px;
      padding-left: 4px;
      display: grid;
      grid-template-columns: auto auto;
    }
</style>