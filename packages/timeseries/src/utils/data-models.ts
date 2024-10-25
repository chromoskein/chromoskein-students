import { vec3 } from "gl-matrix"
import { ClusterNode, clusterTimestep, clusterTimestepAsync, VisualisationType } from "./main"
import ChromatinViewport from "../viewports/ChromatinViewport.svelte"

export interface HiCMapModel
{
    frequencies: number[][],
    resolution: number
}


export interface BEDLineModel
{
    chrom: string,
    chromStart: number,
    chromEnd: number,
    optionalFields: string[]
}

export interface BEDModel
{
    lines: BEDLineModel[]
}


export interface ArmatusModel
{
    lines: ArmatusLineModel[]
}

export interface ArmatusLineModel
{
    name: string,
    start: number,
    end: number
}


export interface StandardBEDModel
{
    lines: StandardBEDLineModel[]
}

export interface StandardBEDLineModel
{
    chrom: string,
    chromStart: number,
    chromEnd: number,
    optionalFields: StandardBEDOptionalFields
}

export interface StandardBEDOptionalFields
{
    name: string | null,
    score: number | null,
    strand: string | null,
    thickStart: number | null,
    thickEnd: number | null,
    itemRgb: { r: number, g: number, b: number } | null,
    blockCount: number | null,
    blockSizes: number[] | null,
    blockStarts: number[] | null
}


export type ChromosomeVisOptions = {
    visualizationType: VisualisationType,
    radius: number,
    alpha: number,
    blobsAmount: number,
}

export type Chromosome =
{
    id: number,
    name: string,
    visible: boolean,
    points: vec3[],
    clusters: ClusterNode[][];
    color: { r: number, g: number, b: number }
}

let id = 0;
export function initializeChromosome(name, points) { 
    let chromosome = {
        id: id++,
        name: name,
        visible: true,
        points: points,
        clusters: [],
        color: {r: Math.random(), g: Math.random(), b: Math.random()}
    }

    clusterTimestepAsync(points).then(result => {
        chromosome.clusters = result.slice(0, 16);
    });
    return chromosome;
}