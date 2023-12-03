<script lang="ts">
    import { vec3 } from "gl-matrix";
    import ContinuousTube from "../objects/ContinuousTube.svelte";
    import Spline from "../objects/Spline.svelte";
    import { lineToSpline } from "../utils/lineToSpline";
    import Viewport3D from "./Viewport3D.svelte";

    // Array of arrays is used because chromosome can be of multiple parts (even though current data is only one part)
    export let chromatinParts: vec3[][] = null;
    export let approximateCurve: boolean = false;
    export let radius : number = 0.03;
    export let multicolored: boolean = false;

    let pathlines: vec3[][] | null = null;
    let colors: vec3[] | null = null;

    $: if (chromatinParts) {
        pathlines = chromatinParts;
    }

    // $: In svelte runs reactively every time some inner value is changed, in this case it updates when chromatinParts is updated
    $: if (chromatinParts) {
        colors = new Array<vec3>();
        for (let i = 0; i < chromatinParts.length; i++) {
            colors.push(vec3.fromValues(1.0, 1.0, 1.0));
        }
    }

    let splinePathlines: vec3[][] | null = null;
    $: if (pathlines) {
        splinePathlines = pathlines.map((p) => lineToSpline(p));
    }
</script>

<div class="chromatin-viewport">
    <Viewport3D>
        {#if !approximateCurve && pathlines}
            {#each pathlines as chromatinPart, index} 
                <!-- Adds a ContinuousTube for each chromatin part into the scene -->
                <ContinuousTube points={chromatinPart} radius={radius} color={colors[index]} multicolored={multicolored} />
            {/each}
        {/if}
        
        {#if approximateCurve && chromatinParts}
            {#each splinePathlines as chromatinPartSpline, index} 
                <Spline points={chromatinPartSpline} radius={radius} color={colors[index]}  multicolored={multicolored} />
            {/each}
        {/if}
        
    </Viewport3D>
</div>

<style>
    .chromatin-viewport {
        position: relative;
        flex-grow: 1;
    }
</style>