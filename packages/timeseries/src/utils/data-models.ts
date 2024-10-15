import { vec3 } from "gl-matrix"

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
    name: string,
    visible: boolean,
    points: vec3[],
    color: { r: number, g: number, b: number }
}