<script lang="ts">
    import { Button, Modal } from "carbon-components-svelte";
  
    export let open = false;


    let loadedFiles: FileList = null;


    function loadFiles() {
        console.log("Henlo")
    }

</script>
  
<div>

  <Modal
    bind:open
    modalHeading="Load Models"
    primaryButtonText="Confirm"
    secondaryButtonText="Cancel"
    on:click:button--secondary={() => (open = false)}
    on:open
    on:close
    on:submit={() => open = false}
  >


    <input type="file"  accept=".pdb,.PDB" id="file-input" bind:files={loadedFiles} on:change={loadFiles}/>
    <Button
        kind="secondary"
        size="field"
        on:click={() => document.getElementById("file-input").click()}
    >  
        Load File
    </Button>
  </Modal>
</div>


<style> 
    #file-input {
      display: none;
    }
</style>
  