
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

    export let visible: boolean = true;
    export let points: vec3[][];
    export let dataClustersGivenK: ClusterNode[][] = [];

    let visualizationType: VisualisationType = VisualisationType.Pathline;


    // Volume
    let abstractVolumes = false;
    let volumeColormapChoice = "Cool Warm";
    let volumeColormap: ImageBitmap | null = null;
    let volumeFunction = 0;

    // Blobs
    let radius = 0.01;
    let blobsAmount: number = 1;
    let alpha = 1.0;

    let showConnectors = false;
    let timestep = 0; 

    let matryoshkaBlobsVisible:boolean[] = [false, true, false, true, false, false, false, false, false, false, false, false, false, false, false];

    let preciseQuills: boolean = false;
    let maxDistance = 1.0;


    export function setVisualizationType(type: VisualisationType) {
        visualizationType = type;
        console.log("Set type to " + visualizationType);
    }

    // Splits data pathlines based on clusters
    // Format [cluster][point][timestep]
    let dataClusteredPathlines: vec3[][][] | null = null;
    $: if (dataClustersGivenK && dataClustersGivenK[blobsAmount] && points) {
        const clusters = dataClustersGivenK[blobsAmount];

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


    {#if points.length > 1 && visualizationType == VisualisationType.Volume}
    {#each dataClustersGivenK[blobsAmount] as cluster, _}
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

    {#if visualizationType == VisualisationType.Pathline && dataClustersGivenK && dataClustersGivenK[blobsAmount]}
        {#each dataClustersGivenK[blobsAmount] as cluster, _}
            <ContinuousTube
                points={points[timestep].slice(cluster.from, cluster.to + 1)}
                radius={radius}
                color={vec3.fromValues(cluster.color.rgb[0], cluster.color.rgb[1], cluster.color.rgb[2])}
                multicolored={false}
            />
        {/each}
    {/if}

    {#if visualizationType == VisualisationType.Spline && dataClustersGivenK && dataClustersGivenK[blobsAmount]}
        {#each dataClustersGivenK[blobsAmount] as cluster, _}
            <Spline
                points={points[timestep].slice(cluster.from, cluster.to + 1)}
                radius={radius}
                color={vec3.fromValues(cluster.color.rgb[0], cluster.color.rgb[1], cluster.color.rgb[2])}
                multicolored={false}
            />
        {/each}
    {/if}

    {#if visualizationType == VisualisationType.Spheres && dataClustersGivenK && dataClustersGivenK[blobsAmount]}
        {#each dataClustersGivenK[blobsAmount] as cluster, _}
            {#each points[timestep].slice(cluster.from, cluster.to + 1) as point, _}
                <Sphere
                    radius={radius}
                    center={point}
                    color={[cluster.color.rgb[0], cluster.color.rgb[1], cluster.color.rgb[2], 1.0]} 
                />
            {/each}
        {/each}
    {/if}

    
    {#if visualizationType == VisualisationType.Matryoshka}
        <MatryoshkaClusters
            selectedTimestep={timestep}
            dataClustersGivenK={dataClustersGivenK}
            dataTimesteps={points}
            dataPathlines={timestepsToPathlines(points)}
            blobAlpha={alpha}
            blobsRadius={radius}
            experimentalColors={false}
            matryoshkaBlobsVisible={matryoshkaBlobsVisible} 
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

    {#if blobs[timestep] && visualizationType == VisualisationType.Implicit}
    {#each blobs[timestep] as blob, i}
        <SignedDistanceGrid
            points={blob.normalizedPoints}
            translate={blob.center}
            scale={blob.scale}
            radius={radius}
            visible={true}
            color={vec3.fromValues(dataClustersGivenK[blobsAmount][i].color.rgb[0], dataClustersGivenK[blobsAmount][i].color.rgb[1], dataClustersGivenK[blobsAmount][i].color.rgb[2])}
            outline={false}
        />
    {/each}
    {/if}
    {#if blobs[timestep] && visualizationType == VisualisationType.AbstractSpheres} 
        {#each dataClustersGivenK[blobsAmount] as cluster, i}
            <Sphere
                radius={(cluster.to - cluster.from + 1) / 1000.0 * 2}
                center={blobFromPoints(points[timestep].slice(cluster.from, cluster.to + 1)).center}
                color={[dataClustersGivenK[blobsAmount][i].color.rgb[0], dataClustersGivenK[blobsAmount][i].color.rgb[1], dataClustersGivenK[blobsAmount][i].color.rgb[2], 1.0]}
            />
        {/each}
        {#if blobsAmount > 1}
            <ContinuousTube
                radius={(1.0 / blobsAmount) / 15.0}
                points={blobs[timestep].map(blob => blob.center)}
                color={[0.9, 0.9, 0.9]}
                multicolored={false}
            />
        {/if}
    {/if}
    {#if blobs[timestep] && visualizationType == VisualisationType.Cones}
        {#each dataClustersGivenK[blobsAmount] as cluster, _}
            <PcaCone 
                points={points[timestep].slice(cluster.from, cluster.to + 1)}
                color={[cluster.color.rgb[0], cluster.color.rgb[1], cluster.color.rgb[2]]}
            />
        {/each}
        {#if blobsAmount > 1}
            <ContinuousTube
                radius={(1.0 / blobsAmount) / 15.0}
                points={blobs[timestep].map(blob => blob.center)}
                color={[0.9, 0.9, 0.9]}
                multicolored={false}
            />
        {/if}  
    {/if}
    {#if blobs[timestep] && visualizationType == VisualisationType.Hedgehog}
        {#each blobs[timestep] as blob, i}
            <Hedgehog
                radius = {blob.normalizedPoints.length / 1000.0 * 2}
                blobs = {blobs[timestep]}
                blobID = {i}
                precise = {false}
                minDistance = {0.2}
                color={[dataClustersGivenK[blobsAmount][i].color.rgb[0], dataClustersGivenK[blobsAmount][i].color.rgb[1], dataClustersGivenK[blobsAmount][i].color.rgb[2]]}
            />
        {/each}
        {#if blobsAmount > 1}
                <ContinuousTube
                radius={(1.0 / blobsAmount) / 15.0}
                points={blobs[timestep].map(blob => blob.center)}
                color={[0.9, 0.9, 0.9]}
                multicolored={false}
            />
        {/if}
    {/if}
    {/if}
</div>


