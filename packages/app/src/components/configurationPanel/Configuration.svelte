<script lang="ts">
  import { type Writable } from "svelte/store";
  import Configuration2D from "./Configuration2D.svelte";
  import Configuration3D from "./Configuration3D.svelte";
  import type { ConfigurationType } from "../../storage/storage";

  export let configuraton: Writable<ConfigurationType>;
</script>

{#if $configuraton.tag === "2D"}
  <Configuration2D bind:configuration={configuraton} />
{:else}
  <Configuration3D bind:configuration={configuraton} />
{/if}
