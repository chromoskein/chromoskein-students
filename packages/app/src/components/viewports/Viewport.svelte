<script lang="ts">
    import Viewport2D from "./Viewport2D.svelte";
    import Viewport3D from "./Viewport3D/Viewport3D.svelte";
    import type { ConfigurationType } from "src/storage/storage";
    import type { Writable } from "svelte/store";

    export let configuration: Writable<ConfigurationType>;
</script>

{#if $configuration.tag === "2D"}
    <Viewport2D bind:configuration={configuration} />
{:else}
    <Viewport3D bind:configuration={configuration} />
{/if}