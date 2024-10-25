
<script lang="ts">

import { Checkbox } from "carbon-components-svelte";

export let visible: boolean;
export let name: string;


</script>


<div class="itemStyle">
    <p> Name: {name} </p>
    <Checkbox bind:checked={visible} labelText="Visible" /> 
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