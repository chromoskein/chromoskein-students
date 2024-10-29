
<script lang="ts">
    import type { Chromosome, ChromosomeVisOptions } from "../utils/data-models";
    import {blobFromPoints, clusterPathlines, clusterTimestep, timestepsToPathlines, VisualisationType} from "../utils/main";
    import type { ClusterBlob, ClusterNode } from "../utils/main";

    import TimeVolume from "../objects/TimeVolume.svelte";
    import SignedDistanceGrid from "../objects/SignedDistanceGrid.svelte";
    import Sphere from "../objects/Sphere.svelte";
    import Spline from "../objects/Spline.svelte";;
    import MatryoshkaClusters from "../visalizations/MatryoshkaClusters.svelte";
    import Hedgehog from "../objects/Hedgehog.svelte";
    import InteractiveCluster from "../visalizations/InteractiveCluster.svelte";
    import ContinuousTube from "../objects/ContinuousTube.svelte";
    import PcaCone from "../objects/PCACone.svelte";

    import { vec3 } from "gl-matrix";
    import { colors } from "../App.svelte";

    export let visible: boolean;
    export let points: vec3[][];
    export let options: ChromosomeVisOptions;
    export let dataClustersGivenK: ClusterNode[][] = [];



    let visualizationType: VisualisationType = VisualisationType.Pathline;


    export function setVisualizationType(type: VisualisationType) {
        visualizationType = type;
        console.log("Set type to " + visualizationType);
    }

    // Splits data pathlines based on clusters
    // Format [cluster][point][timestep]
    let dataClusteredPathlines: vec3[][][] | null = null;
    $: if (dataClustersGivenK && dataClustersGivenK[options.blobsAmount] && points) {
        const clusters = dataClustersGivenK[options.blobsAmount];

        let dataPathlines = timestepsToPathlines(points);
        dataClusteredPathlines = [];
        for (const [clusterIndex, cluster] of clusters.entries()) {
            dataClusteredPathlines[clusterIndex] = dataPathlines.slice(cluster.from, cluster.to + 1);
        }
    }

    // [timestep][blob]
    let blobs: ClusterBlob[][] = [];
    // Process the clustered pathlines [cluster][point][timestep]
    // into normalized blobs in format [timestep][blob]
    $: if (dataClusteredPathlines) {
        // Allocate new ones
        blobs = [];
        for (let timestep = 0; timestep < points.length; timestep++) {
            let blobsPointsAtTimestep: {
                normalizedPoints: vec3[];
                center: vec3;
                scale: number;
            }[] = [];
        for (const [index, clusteredPathline] of dataClusteredPathlines.entries()) {
            const points = clusteredPathline.map((pathline) => pathline[timestep]);

            blobsPointsAtTimestep.push(blobFromPoints(points));
        }

        blobs.push(blobsPointsAtTimestep);
        console.log("Running.");
        }
    }
        
</script>

<div>
    {#if visible}

    <!--
    {#if visualizationSelected == VisualisationType.Volume}
    {#each dataClustersGivenK[options.blobsAmount] as cluster, _}
        <TimeVolume
            points={chromosome.points.map(sequence => sequence.slice(cluster.from, cluster.to + 1))}
            transparency={volumeTransparency}
            radius={volumeRadius}
            colormap={volumeColormap}
            usecolormap={volumeUseColormap}
            func={volumeFunction}
            abstract={abstractVolumes}
            color={cluster.color.rgb}
        />
    {/each}
    {/if}
    -->
    {#if visualizationType == VisualisationType.Pathline && dataClustersGivenK && dataClustersGivenK[options.blobsAmount]}
        {#each dataClustersGivenK[options.blobsAmount] as cluster, _}
            <ContinuousTube
            points={points[options.timestep].slice(cluster.from, cluster.to + 1)}
            radius={options.radius}
            color={vec3.fromValues(options.color.r, options.color.g, options.color.b)}
            multicolored={false}
            />
        {/each}
    {/if}

    {#if visualizationType == VisualisationType.Spline && dataClustersGivenK && dataClustersGivenK[options.blobsAmount]}
        {#each dataClustersGivenK[options.blobsAmount] as cluster, _}
            <Spline
                points={points[options.timestep].slice(cluster.from, cluster.to + 1)}
                radius={options.radius}
                color={vec3.fromValues(cluster.color.rgb[0], cluster.color.rgb[1], cluster.color.rgb[2])}
                multicolored={false}
            />
        {/each}
    {/if}

    {#if visualizationType == VisualisationType.Spheres && dataClustersGivenK && dataClustersGivenK[options.blobsAmount]}
        {#each dataClustersGivenK[options.blobsAmount] as cluster, _}
            {#each points[options.timestep].slice(cluster.from, cluster.to + 1) as point, _}
                <Sphere
                    radius={options.radius}
                    center={point}
                    color={[options.color.r, options.color.g, options.color.b, 1.0]} 
                />
            {/each}
        {/each}
    {/if}

    <!--
    {#if options.selectedVisualization == VisualisationType.Matryoshka}
    <MatryoshkaClusters
        selectedTimestep={options.timestep}
        dataClustersGivenK={dataClustersGivenK}
        dataTimesteps={chromosome.points}
        dataPathlines={dataPathlines}
        blobAlpha={options.alpha}
        blobsRadius={options.radius}
        experimentalColors={false}
        matryoshkaBlobsVisible={matryoshkaBlobsVisible} 
    />
    {/if}
    -->

    <!--
    {#if options.selectedVisualization == VisualisationType.Composite}
    <InteractiveCluster
        dataClustersGivenK={dataClustersGivenK}
        pointsAtTimesteps={chromosome.points}
        selectedTimestep={options.timestep}
        clusterVisualization={clusterVisualization}
        showConnections={showConnectors}
        clustersUpdated={clustersUpdated}
        updateClustersUpdated={updateClustersUpdated}
        action={action}
        bind:this={interactiveClusterRef}
    />
    {/if}
    -->

    {#if blobs[options.timestep] && visualizationType == VisualisationType.Implicit}
    {#each blobs[options.timestep] as blob, i}
        <SignedDistanceGrid
        points={blob.normalizedPoints}
        translate={blob.center}
        scale={blob.scale}
        radius={options.radius}
        visible={true}
        color={vec3.fromValues(options.color.r, options.color.g, options.color.b)}
        outline={false}
        />
    {/each}
    {/if}
    {#if blobs[options.timestep] && options.selectedVisualization == VisualisationType.AbstractSpheres} 
        {#each dataClustersGivenK[options.blobsAmount] as cluster, i}
            <Sphere
            radius={(cluster.to - cluster.from + 1) / 1000.0 * 2}
            center={blobFromPoints(points[options.timestep].slice(cluster.from, cluster.to + 1)).center}
            color={[dataClustersGivenK[options.blobsAmount][i].color.rgb[0], dataClustersGivenK[options.blobsAmount][i].color.rgb[1], dataClustersGivenK[options.blobsAmount][i].color.rgb[2], 1.0]}
            />
        {/each}
        {#if options.blobsAmount > 1}
            <ContinuousTube
            radius={(1.0 / options.blobsAmount) / 15.0}
            points={blobs[options.timestep].map(blob => blob.center)}
            color={[0.9, 0.9, 0.9]}
            multicolored={false}
            />
        {/if}
    {/if}
    {#if blobs[options.timestep] && options.selectedVisualization == VisualisationType.Cones}
        {#each dataClustersGivenK[options.blobsAmount] as cluster, _}
            <PcaCone 
            points={points[options.timestep].slice(cluster.from, cluster.to + 1)}
            color={[cluster.color.rgb[0], cluster.color.rgb[1], cluster.color.rgb[2]]}
            />
        {/each}
        {#if options.blobsAmount > 1}
            <ContinuousTube
            radius={(1.0 / options.blobsAmount) / 15.0}
            points={blobs[options.timestep].map(blob => blob.center)}
            color={[0.9, 0.9, 0.9]}
            multicolored={false}
            />
        {/if}  
    {/if}
    {#if blobs[options.timestep] && options.selectedVisualization == VisualisationType.Hedgehog}
        {#each blobs[options.timestep] as blob, i}
            <Hedgehog
            radius = {blob.normalizedPoints.length / 1000.0 * 2}
            blobs = {blobs[options.timestep]}
            blobID = {i}
            precise = {false}
            minDistance = {0.2}
            color={[dataClustersGivenK[options.blobsAmount][i].color.rgb[0], dataClustersGivenK[options.blobsAmount][i].color.rgb[1], dataClustersGivenK[options.blobsAmount][i].color.rgb[2]]}
            />
        {/each}
        {#if options.blobsAmount > 1}
            <ContinuousTube
            radius={(1.0 / options.blobsAmount) / 15.0}
            points={blobs[options.timestep].map(blob => blob.center)}
            color={[0.9, 0.9, 0.9]}
            multicolored={false}
            />
        {/if}
    {/if}
    {/if}
</div>


