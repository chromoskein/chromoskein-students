<script lang="ts">
    import {blobFromPoints, timestepsToPathlines, VisualisationType} from "../utils/main";
    import type { ClusterBlob, ClusterNode } from "../utils/main";

    import TimeVolume from "../objects/TimeVolume.svelte";
    import SignedDistanceGrid from "../objects/SignedDistanceGrid.svelte";
    import Sphere from "../objects/Sphere.svelte";
    import Spline from "../objects/Spline.svelte";;
    import MatryoshkaClusters from "../visalizations/MatryoshkaClusters.svelte";
    import Hedgehog from "../objects/Hedgehog.svelte";
    import ContinuousTube from "../objects/ContinuousTube.svelte";
    import PcaCone from "../objects/PCACone.svelte";

    import { vec3 } from "gl-matrix";
    import type { VisOptions } from "../utils/data-models";
    import { calculateSphereParameters } from "../utils/abstractClustersUtils";
    import InteractiveCluster from "../visalizations/InteractiveCluster.svelte";

    export let visible: boolean = true;
    export let points: vec3[][];
    export let dataClustersGivenK: ClusterNode[][] = [];
    export let ops: VisOptions;
    export let interactiveCluster: InteractiveCluster | null = null;

    let visType: VisualisationType;
    let clustersAmount: number = 1;
    let alpha: number = 1.0;
    let radius: number = 0.2;
    let abstractVolumes: boolean;
    let volumeColormap;
    let volumeFunction: number;
    let timestep: number = 0;
    let options: VisOptions;
    let outlines: boolean = false;
    let showConnectors: boolean = false;
    let abstractionMultiplier: number = 2.0;
    let secondaryVis: VisualisationType;

    $: options = ops;
    $: visType = ops.visType;
    $: clustersAmount = ops.blobsAmount;
    $: alpha = ops.alpha;
    $: radius = ops.radius;
    $: abstractVolumes = ops.abstractVolumes;
    $: volumeColormap = ops.volumeColormap;
    $: volumeFunction = ops.volumeFunction;
    $: timestep = ops.timestep;
    $: outlines = ops.outlines;
    $: showConnectors = ops.showConnectors;
    $: abstractionMultiplier = ops.abstractionMultiplier;
    $: secondaryVis = ops.secondaryVis;

    $: if (dataClustersGivenK) {
        ops.matryoshkaBlobsVisible = new Array(dataClustersGivenK.length - 1).fill(false);
        ops.matryoshkaBlobsVisible[0] = true;
    }


    // Stores the average point in each cluster and radius that encapsulates all points
    let clusterCenters: {
        center: vec3,
        radius: number,
    }[] = [];
    $: {
        clusterCenters = [];
        dataClustersGivenK[clustersAmount].forEach(cluster => {
            clusterCenters.push(calculateSphereParameters(points[timestep].slice(cluster.from, cluster.to + 1)));
        });
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

    {#if visType == VisualisationType.Pathline && dataClustersGivenK && dataClustersGivenK[clustersAmount]}
        {#each dataClustersGivenK[clustersAmount] as cluster, _}
            <ContinuousTube
                points={points[timestep].slice(cluster.from, cluster.to + 1)}
                radius={radius}
                color={vec3.fromValues(cluster.color.rgb[0], cluster.color.rgb[1], cluster.color.rgb[2])}
                multicolored={false}
            />
        {/each}
    {/if}

    {#if visType == VisualisationType.Spline && dataClustersGivenK && dataClustersGivenK[clustersAmount]}
        {#each dataClustersGivenK[clustersAmount] as cluster, _}
            <Spline
                points={points[timestep].slice(cluster.from, cluster.to + 1)}
                radius={radius}
                color={vec3.fromValues(cluster.color.rgb[0], cluster.color.rgb[1], cluster.color.rgb[2])}
                multicolored={false}
            />
        {/each}
    {/if}

    {#if visType == VisualisationType.Spheres && dataClustersGivenK && dataClustersGivenK[clustersAmount]}
        {#each dataClustersGivenK[clustersAmount] as cluster, _}
            {#each points[timestep].slice(cluster.from, cluster.to + 1) as point, _}
                <Sphere
                    radius={radius}
                    center={point}
                    color={[cluster.color.rgb[0], cluster.color.rgb[1], cluster.color.rgb[2], 1.0]} 
                />
            {/each}
        {/each}
    {/if}

    
    {#if visType == VisualisationType.Matryoshka}
        <MatryoshkaClusters
            selectedTimestep={timestep}
            dataClustersGivenK={dataClustersGivenK}
            dataTimesteps={points}
            dataPathlines={timestepsToPathlines(points)}
            blobAlpha={alpha}
            blobsRadius={radius}
            experimentalColors={false}
            matryoshkaBlobsVisible={ops.matryoshkaBlobsVisible} 
            outlines={false}
        />
    {/if}
    

    
    {#if visType == VisualisationType.Composite}
        <InteractiveCluster
            dataClustersGivenK={dataClustersGivenK}
            options={options}
            pointsAtTimesteps={points}
            selectedTimestep={timestep}
            clustersUpdated={false}
            updateClustersUpdated={() => {}}
            bind:this={interactiveCluster}
        />
    {/if}

    {#if blobs[timestep] && visType == VisualisationType.Implicit}
    {#each blobs[timestep] as blob, i}
        <SignedDistanceGrid
            points={blob.normalizedPoints}
            translate={blob.center}
            scale={blob.scale}
            radius={radius}
            visible={true}
            color={vec3.fromValues(dataClustersGivenK[clustersAmount][i].color.rgb[0], dataClustersGivenK[clustersAmount][i].color.rgb[1], dataClustersGivenK[clustersAmount][i].color.rgb[2])}
            outline={false}
        />
    {/each}
    {/if}
    {#if visType == VisualisationType.AbstractSpheres} 
        {#each dataClustersGivenK[clustersAmount] as cluster, i}
            <Sphere
                radius={clusterCenters[i].radius / abstractionMultiplier}
                center={clusterCenters[i].center}
                color={[dataClustersGivenK[clustersAmount][i].color.rgb[0], dataClustersGivenK[clustersAmount][i].color.rgb[1], dataClustersGivenK[clustersAmount][i].color.rgb[2], 1.0]}
            />
        {/each}
        {#if showConnectors && clustersAmount > 1}
            <ContinuousTube
                radius={(1.0 / clustersAmount) / 15.0}
                points={clusterCenters.map(cluster => cluster.center)}
                color={[0.9, 0.9, 0.9]}
                multicolored={false}
            />
        {/if}
    {/if}
    {#if visType == VisualisationType.Cones}
        {#each dataClustersGivenK[clustersAmount] as cluster, _}
            <PcaCone 
                points={points[timestep].slice(cluster.from, cluster.to + 1)}
                radiusMultiplier={abstractionMultiplier}
                color={[cluster.color.rgb[0], cluster.color.rgb[1], cluster.color.rgb[2]]}
            />
        {/each}
        {#if showConnectors && clustersAmount > 1}
            <ContinuousTube
                radius={(1.0 / clustersAmount) / 15.0}
                points={clusterCenters.map(cluster => cluster.center)}
                color={[0.9, 0.9, 0.9]}
                multicolored={false}
            />
        {/if}  
    {/if}
    {#if visType == VisualisationType.Hedgehog}
        {#each dataClustersGivenK[clustersAmount] as cluster, i}
            <Hedgehog
                points = {points[timestep]}
                clusters = {dataClustersGivenK[clustersAmount]}
                clusterID = {i}
                precise = {ops.preciseQuills}
                minDistance = {ops.hedgehogDistance}
                radiusMultiplier={abstractionMultiplier}
                secondPoint = {ops.secondPoint}
                threshold={ops.hedgehogThreshold}
                color={[dataClustersGivenK[clustersAmount][i].color.rgb[0], dataClustersGivenK[clustersAmount][i].color.rgb[1], dataClustersGivenK[clustersAmount][i].color.rgb[2]]}
            />
        {/each}
        {#if showConnectors && clustersAmount > 1}
            <ContinuousTube
                radius={(1.0 / clustersAmount) / 15.0}
                points={clusterCenters.map(cluster => cluster.center)}
                color={[0.9, 0.9, 0.9]}
                multicolored={false}
            />
        {/if}
    {/if}
    {#if outlines}
        {#each blobs[timestep] as blob, i}
        <SignedDistanceGrid
            points={blob.normalizedPoints}
            translate={blob.center}
            scale={blob.scale}
            radius={radius}
            visible={true}
            color={vec3.fromValues(dataClustersGivenK[clustersAmount][i].color.rgb[0], dataClustersGivenK[clustersAmount][i].color.rgb[1], dataClustersGivenK[clustersAmount][i].color.rgb[2])}
            outline={true}
        />
        {/each} 
    {/if}
    {#if visType == VisualisationType.Test}
        <MatryoshkaClusters
            selectedTimestep={timestep}
            dataClustersGivenK={dataClustersGivenK}
            dataTimesteps={points}
            dataPathlines={timestepsToPathlines(points)}
            blobAlpha={alpha}
            blobsRadius={radius}
            experimentalColors={false}
            matryoshkaBlobsVisible={ops.matryoshkaBlobsVisible} 
            outlines={true}
        />
        {#if secondaryVis == VisualisationType.AbstractSpheres} 
            {#each dataClustersGivenK[clustersAmount] as cluster, i}
                <Sphere
                    radius={clusterCenters[i].radius / abstractionMultiplier}
                    center={clusterCenters[i].center}
                    color={[dataClustersGivenK[clustersAmount][i].color.rgb[0], dataClustersGivenK[clustersAmount][i].color.rgb[1], dataClustersGivenK[clustersAmount][i].color.rgb[2], 1.0]}
                />
            {/each}
        {/if}
        {#if secondaryVis == VisualisationType.Cones}
            {#each dataClustersGivenK[clustersAmount] as cluster, _}
                <PcaCone 
                    points={points[timestep].slice(cluster.from, cluster.to + 1)}
                    radiusMultiplier={abstractionMultiplier}
                    color={[cluster.color.rgb[0], cluster.color.rgb[1], cluster.color.rgb[2]]}
                />
            {/each} 
        {/if}
        {#if secondaryVis == VisualisationType.Hedgehog}
            {#each dataClustersGivenK[clustersAmount] as cluster, i}
                <Hedgehog
                    points = {points[timestep]}
                    clusters = {dataClustersGivenK[clustersAmount]}
                    clusterID = {i}
                    precise = {ops.preciseQuills}
                    minDistance = {ops.hedgehogDistance}
                    radiusMultiplier={abstractionMultiplier}
                    secondPoint = {ops.secondPoint}
                    threshold={ops.hedgehogThreshold}
                    color={[dataClustersGivenK[clustersAmount][i].color.rgb[0], dataClustersGivenK[clustersAmount][i].color.rgb[1], dataClustersGivenK[clustersAmount][i].color.rgb[2]]}
                />
            {/each}
        {/if}
    {/if}
    {/if}
</div>


