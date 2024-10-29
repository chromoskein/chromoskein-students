import { vec3 } from "gl-matrix"
import { clusterTimestepAsync, VisualisationType } from "./main"
import type { ClusterNode } from "./main"
import ChromatinVisualization from "../uiComponents/ChromatinVisualization.svelte";

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
    selectedVisualization: VisualisationType,
    radius: number,
    alpha: number,
    blobsAmount: number,
    timestep: number,
    color: { r: number, g: number, b: number }
}

export type Chromosome =
{
    id: number,
    name: string,
    visible: boolean,
    points: vec3[][],
    clusters: ClusterNode[][];
    options: ChromosomeVisOptions,
    visualization: ChromatinVisualization
}

let id = 0;
export function initializeChromosome(name: string, points: vec3[][]) { 

    let chromosome = {
        id: id++,
        name: name,
        visible: true,
        points: points,
        clusters: [[], [getEmptyClustering(points[0].length)]],
        color: {r: Math.random(), g: Math.random(), b: Math.random()},
        options: getDefaultOptions(),
        visualization: null,
    }
    return chromosome;
}

function getDefaultOptions() {
    return {
        selectedVisualization: VisualisationType.Pathline,
        radius: 0.1,
        alpha: 1.0,
        color: {r: Math.random(), g: Math.random(), b: Math.random()},
        timestep: 0,
        blobsAmount: 1,
    }
}

function getEmptyClustering(length: number): ClusterNode {
    return {
        k: 1,
        i: 0,
        from: 0,
        to: length - 1,
        delimiters: [],
        children: [0, 1],
        points: [],
        visible: true,
        color: {
            h: 0,
            c: 0,
            l: 0,
            rgb: [Math.random(), Math.random(), Math.random()]
        }
    }
}