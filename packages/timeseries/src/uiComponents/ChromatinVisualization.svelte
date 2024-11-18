<script lang="ts">
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
    import type { HedgehogOptions, StandardOptions, VisOptions, VolumeOptions } from "../utils/data-models";

    export let visible: boolean = true;
    export let points: vec3[][];
    export let dataClustersGivenK: ClusterNode[][] = [];
    export let ops: VisOptions;

    let visType;
    let clustersAmount = 1;
    let alpha = 1.0;
    let radius;
    let abstractVolumes;
    let volumeColormap;
    let volumeFunction;

    $: visType = ops.visType;
    $: clustersAmount = ops.blobsAmount;
    $: alpha = ops.alpha;
    $: radius = ops.radius;
    $: abstractVolumes = ops.abstractVolumes;
    $: volumeColormap = ops.volumeColormap;
    $: volumeFunction = ops.volumeFunction;

    $: if (dataClustersGivenK) {
        ops.matryoshkaBlobsVisible = new Array(dataClustersGivenK.length - 1).fill(false);
        ops.matryoshkaBlobsVisible[0] = true;
    }
    // Splits data pathlines based on clusters
    // Format [cluster][point][timestep]
    let dataClusteredPathlines: vec3[][][] | null = null;
    $: if (dataClustersGivenK && dataClustersGivenK[clustersAmount] && points) {
        const clusters = dataClustersGivenK[clustersAmount];

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
        }
    }
        
</script>

<div>
    {#if visible}


    {#if points.length > 1 && visType == VisualisationType.Volume}
    {#each dataClustersGivenK[clustersAmount] as cluster, _}
        <TimeVolume
            points={points.map(sequence => sequence.slice(cluster.from, cluster.to + 1))}
            transparency={alpha}
            radius={radius}
            colormap={volumeColormap}
            usecolormap={true}
            func={volumeFunction}
            abstract={abstractVolumes}
            color={cluster.color.rgb}
        />
    {/each}
    {/if}

    {#if ops.visType == VisualisationType.Pathline && dataClustersGivenK && dataClustersGivenK[ops.blobsAmount]}
        {#each dataClustersGivenK[ops.blobsAmount] as cluster, _}
            <ContinuousTube
                points={points[ops.timestep].slice(cluster.from, cluster.to + 1)}
                radius={ops.radius}
                color={vec3.fromValues(cluster.color.rgb[0], cluster.color.rgb[1], cluster.color.rgb[2])}
                multicolored={false}
            />
        {/each}
    {/if}

    {#if ops.visType == VisualisationType.Spline && dataClustersGivenK && dataClustersGivenK[ops.blobsAmount]}
        {#each dataClustersGivenK[ops.blobsAmount] as cluster, _}
            <Spline
                points={points[ops.timestep].slice(cluster.from, cluster.to + 1)}
                radius={ops.radius}
                color={vec3.fromValues(cluster.color.rgb[0], cluster.color.rgb[1], cluster.color.rgb[2])}
                multicolored={false}
            />
        {/each}
    {/if}

    {#if ops.visType == VisualisationType.Spheres && dataClustersGivenK && dataClustersGivenK[ops.blobsAmount]}
        {#each dataClustersGivenK[ops.blobsAmount] as cluster, _}
            {#each points[ops.timestep].slice(cluster.from, cluster.to + 1) as point, _}
                <Sphere
                    radius={ops.radius}
                    center={point}
                    color={[cluster.color.rgb[0], cluster.color.rgb[1], cluster.color.rgb[2], 1.0]} 
                />
            {/each}
        {/each}
    {/if}

    
    {#if ops.visType == VisualisationType.Matryoshka}
        <MatryoshkaClusters
            selectedTimestep={ops.timestep}
            dataClustersGivenK={dataClustersGivenK}
            dataTimesteps={points}
            dataPathlines={timestepsToPathlines(points)}
            blobAlpha={ops.alpha}
            blobsRadius={ops.radius}
            experimentalColors={false}
            matryoshkaBlobsVisible={ops.matryoshkaBlobsVisible} 
        />
    {/if}
    

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

    {#if blobs[ops.timestep] && ops.visType == VisualisationType.Implicit}
    {#each blobs[ops.timestep] as blob, i}
        <SignedDistanceGrid
            points={blob.normalizedPoints}
            translate={blob.center}
            scale={blob.scale}
            radius={ops.radius}
            visible={true}
            color={vec3.fromValues(dataClustersGivenK[ops.blobsAmount][i].color.rgb[0], dataClustersGivenK[ops.blobsAmount][i].color.rgb[1], dataClustersGivenK[ops.blobsAmount][i].color.rgb[2])}
            outline={false}
        />
    {/each}
    {/if}
    {#if blobs[ops.timestep] && ops.visType == VisualisationType.AbstractSpheres} 
        {#each dataClustersGivenK[ops.blobsAmount] as cluster, i}
            <Sphere
                radius={(cluster.to - cluster.from + 1) / 1000.0 * 2}
                center={blobFromPoints(points[ops.timestep].slice(cluster.from, cluster.to + 1)).center}
                color={[dataClustersGivenK[ops.blobsAmount][i].color.rgb[0], dataClustersGivenK[ops.blobsAmount][i].color.rgb[1], dataClustersGivenK[ops.blobsAmount][i].color.rgb[2], 1.0]}
            />
        {/each}
        {#if ops.blobsAmount > 1}
            <ContinuousTube
                radius={(1.0 / ops.blobsAmount) / 15.0}
                points={blobs[ops.timestep].map(blob => blob.center)}
                color={[0.9, 0.9, 0.9]}
                multicolored={false}
            />
        {/if}
    {/if}
    {#if blobs[ops.timestep] && ops.visType == VisualisationType.Cones}
        {#each dataClustersGivenK[ops.blobsAmount] as cluster, _}
            <PcaCone 
                points={points[ops.timestep].slice(cluster.from, cluster.to + 1)}
                color={[cluster.color.rgb[0], cluster.color.rgb[1], cluster.color.rgb[2]]}
            />
        {/each}
        {#if ops.blobsAmount > 1}
            <ContinuousTube
                radius={(1.0 / ops.blobsAmount) / 15.0}
                points={blobs[ops.timestep].map(blob => blob.center)}
                color={[0.9, 0.9, 0.9]}
                multicolored={false}
            />
        {/if}  
    {/if}
    {#if blobs[ops.timestep] && ops.visType == VisualisationType.Hedgehog}
        {#each blobs[ops.timestep] as blob, i}
            <Hedgehog
                radius = {blob.normalizedPoints.length / 600.0}
                blobs = {blobs[ops.timestep]}
                blobID = {i}
                precise = {ops.preciseQuills}
                minDistance = {ops.hedgehogDistance}
                color={[dataClustersGivenK[ops.blobsAmount][i].color.rgb[0], dataClustersGivenK[ops.blobsAmount][i].color.rgb[1], dataClustersGivenK[ops.blobsAmount][i].color.rgb[2]]}
            />
        {/each}
        {#if ops.blobsAmount > 1}
                <ContinuousTube
                radius={(1.0 / ops.blobsAmount) / 15.0}
                points={blobs[ops.timestep].map(blob => blob.center)}
                color={[0.9, 0.9, 0.9]}
                multicolored={false}
            />
        {/if}
    {/if}
    {/if}
</div>


