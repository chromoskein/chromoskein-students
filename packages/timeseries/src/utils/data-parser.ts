import Papa from "papaparse";
import { toNumber } from "lodash";

import { type ArmatusLineModel, type ArmatusModel, type BEDLineModel, type BEDModel, type StandardBEDLineModel, type StandardBEDModel, type HiCMapModel, initializeChromosome } from "./data-models";
import { parsePdb } from "lib-dataloader";
import { vec3 } from "gl-matrix";


export enum DSVDelimiter
{
    Comma = ",",
    Tab = "\t",
    Space = " "
}

interface DSVParseConfiguration
{
    delimiter: DSVDelimiter;
    hasHeaderRow: boolean;
    hasHeaderColumn: boolean;
}

interface DSVParseResult
{
    headerRow: string[];
    headerColumn: string[];
    data: string[][];
}

function parseDSVString(dsvContent: string, config: DSVParseConfiguration): DSVParseResult
{
    let result: DSVParseResult = {
        headerRow: [],
        headerColumn: [],
        data: []
    }

    let papaParseResult = Papa.parse<string[]>(dsvContent, { delimiter: config.delimiter });

    if (papaParseResult.data.length == 0)
    {
        return result;
    }

    let dataRowOffset: number = 0;
    let dataColumnOffset: number = 0;

    if (config.hasHeaderRow)
    {
        result.headerRow = papaParseResult.data[0].slice();

        dataRowOffset = 1;
    }

    if (config.hasHeaderColumn)
    {
        result.headerColumn = papaParseResult.data.map(row => row[0]);

        dataColumnOffset = 1;
    }

    result.data = papaParseResult.data.slice(dataRowOffset).map(row => row.slice(dataColumnOffset));

    return result;
}


export function parseHiCMapString(hicMapContent: string, resolution: number, hasHeaderRow: boolean, hasHeaderColumn: boolean): HiCMapModel
{
    let result: HiCMapModel = {
        frequencies: [],
        resolution: resolution
    }

    let tsvParseResult: DSVParseResult = parseDSVString(hicMapContent, { delimiter: DSVDelimiter.Tab, hasHeaderRow: hasHeaderRow, hasHeaderColumn: hasHeaderColumn })

    result.frequencies = tsvParseResult.data.map(row => row.map(cell => toNumber(cell)));

    return result;
}


export function parseBEDString(bedContent: string, delimiter: DSVDelimiter): BEDModel
{
    let result: BEDModel = {
        lines: []
    }

    let dsvParseResult: DSVParseResult = parseDSVString(bedContent, { delimiter: delimiter, hasHeaderRow: false, hasHeaderColumn: false });

    result.lines = dsvParseResult.data.map(row => parseBEDLineString(row));

    return result;
}

function parseBEDLineString(bedLine: string[]): BEDLineModel
{
    let result: BEDLineModel = {
        chrom: bedLine[0],
        chromStart: toNumber(bedLine[1]),
        chromEnd: toNumber(bedLine[2]),
        optionalFields: bedLine.slice(3)
    };

    return result;
}


export function parseArmatusString(armatusContent: string): ArmatusModel
{
    let result: ArmatusModel = {
        lines: []
    }

    let tsvParseResult: DSVParseResult = parseDSVString(armatusContent, { delimiter: DSVDelimiter.Tab, hasHeaderRow: false, hasHeaderColumn: false });

    result.lines = tsvParseResult.data.map(row => parseArmatusLineString(row));

    return result;
}

function parseArmatusLineString(armatusLine: string[]): ArmatusLineModel
{
    return {
        name: armatusLine[0],
        start: toNumber(armatusLine[1]),
        end: toNumber(armatusLine[2])
    };
}


export function parseStandardBEDString(bedContent: string, delimiter: DSVDelimiter): StandardBEDModel
{
    let result: StandardBEDModel = {
        lines: []
    }

    let dsvParseResult: DSVParseResult = parseDSVString(bedContent, { delimiter: delimiter, hasHeaderRow: false, hasHeaderColumn: false });

    result.lines = dsvParseResult.data.map(row => parseStandardBEDLineString(row));

    return result;
}

function parseStandardBEDLineString(bedLine: string[]): StandardBEDLineModel
{
    let result: StandardBEDLineModel = {
        chrom: bedLine[0],
        chromStart: toNumber(bedLine[1]),
        chromEnd: toNumber(bedLine[2]),
        optionalFields: {
            name: (bedLine.length >= 4 ? bedLine[3] : null),
            score: (bedLine.length >= 5 ? toNumber(bedLine[4]) : null),
            strand: (bedLine.length >= 6 ? bedLine[5] : null),
            thickStart: (bedLine.length >= 7 ? toNumber(bedLine[6]) : null),
            thickEnd: (bedLine.length >= 8 ? toNumber(bedLine[7]) : null),
            itemRgb: (bedLine.length >= 9 ? parseRGBString(bedLine[8]) : null),
            blockCount: (bedLine.length >= 10 ? toNumber(bedLine[9]) : null),
            blockSizes: (bedLine.length >= 11 ? parseNumberListString(bedLine[10]) : null),
            blockStarts: (bedLine.length >= 12 ? parseNumberListString(bedLine[11]) : null)
        }
    };

    return result;
}

function parseRGBString(rgbString: string): { r: number, g: number, b: number }
{
    let papaParseResult = Papa.parse<string[]>(rgbString, { delimiter: "," });

    return {
        r: toNumber(papaParseResult.data[0][0]),
        g: toNumber(papaParseResult.data[0][1]),
        b: toNumber(papaParseResult.data[0][2])
    }
}

function parseNumberListString(numberListString: string): number[]
{
    let papaParseResult = Papa.parse<number[]>(numberListString, { delimiter: "," });

    return papaParseResult.data[0].slice();
}

export function loadNewPdbModels(pdbText) {
    let loadedModels = [];
    let model = parsePdb(pdbText);
    if (model.ranges.length == 0) {
      loadedModels.push(initializeChromosome("0", model.bins.map((v) => vec3.fromValues(v.x, v.y, v.z))));
    } else {
      for (let i = 0; i < model.ranges.length; i++) {
        loadedModels.push(initializeChromosome(i.toString(), model.bins.slice(model.ranges[i].from, model.ranges[i].to).map((v) => vec3.fromValues(v.x, v.y, v.z))));
      }
    }
    return loadedModels;
  }

