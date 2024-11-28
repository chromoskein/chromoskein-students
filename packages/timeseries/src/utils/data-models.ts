import { vec3 } from "gl-matrix"
import { VisualisationType } from "./main"
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

export type Chromosome =
{
    id: number,
    name: string,
    visible: boolean,
    points: vec3[][],
    clusters: ClusterNode[][],
    visualization: ChromatinVisualization,
}

let id = 0;
export function initializeChromosome(name: string, points: vec3[][]) { 

    let chromosome = {
        id: id++,
        name: name,
        visible: true,
        points: points,
        clusters: [[], [getEmptyClustering(points[0].length - 1)]],
        visualization: null,
    }
    return chromosome;
}


export function getClustering(from: number, to: number, k: number, i: number) {
    return {
        k: k,
        i: i,
        from: from,
        to: to,
        delimiters: [],
        children: [],
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

export function getEmptyClustering(length: number): ClusterNode {
    return {
        k: 1,
        i: 0,
        from: 0,
        to: length,
        delimiters: [],
        children: [],
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

// This is disgusting
export type VisOptions = {
    visType: VisualisationType
    abstractVolumes: boolean
    volumeColormapChoice: string 
    volumeColormap: ImageBitmap | null
    volumeFunction: number 
    radius: number 
    blobsAmount: number 
    alpha: number
    showConnectors: boolean
    timestep: number
    matryoshkaBlobsVisible:boolean[]
    preciseQuills: boolean
    hedgehogDistance: number
    hedgehogThreshold: number,
    secondPoint: boolean,
    outlines: boolean,
    abstractionMultiplier: number,
}

export function defaultVisOptions() {
    return {
        visType: VisualisationType.Pathline,
        abstractVolumes: false,
        volumeColormapChoice: "Cool Warm", 
        volumeColormap: null,
        volumeFunction: 0 ,
        radius: 0.05,
        blobsAmount: 1, 
        alpha: 1,
        showConnectors: false,
        timestep: 0,
        matryoshkaBlobsVisible: [true],
        preciseQuills: false,
        hedgehogDistance: 0.5,
        hedgehogThreshold: 0.5,
        secondPoint: false,
        outlines: false,
        abstractionMultiplier: 4.0,
    }
}