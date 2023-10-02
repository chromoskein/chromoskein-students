import Papa from "papaparse";
import { toNumber } from "lodash";
import { BEDModel, FrequencyMatrixModel, Sparse1DModel, SparseDistanceMatrixModel, XYZModel } from "./models";


export const enum CsvDelimiter {
    Comma = ',',
    Tabulator = '\t',
    Space = ' ',
}

export type ParseConfiguration = {
    delimiter: CsvDelimiter,
    hasHeader: boolean,
};


export interface ParseResult {
    columns: Array<string | number>;
    rows: Array<Record<string, string>>;
}


function parseCsvToObjects(content: string, config: ParseConfiguration): ParseResult {
    const result: ParseResult = {
        columns: [],
        rows: [],
    };

    let delimiter;
    const header = config.hasHeader;
    switch (config.delimiter) {
        case CsvDelimiter.Comma: delimiter = ','; break;
        case CsvDelimiter.Space: delimiter = ' '; break;
        case CsvDelimiter.Tabulator: delimiter = '\t'; break;
    }

    const papaResults = Papa.parse(content, {
        delimiter,
        header,
    });

    if (header && papaResults.meta['fields']) {
        result.columns = papaResults.meta['fields'];
    } else {
        const row = papaResults.data[0] as Array<unknown>;
        result.columns = Array.from({ length: row.length }, (_, i) => i + 1);
    }

    if (header) {
        for (let i = 0; i < papaResults.data.length; i++) {
            result.rows.push(papaResults.data[i] as unknown as Record<string, string>);
        }
    } else {
        for (let i = 0; i < papaResults.data.length; i++) {
            const row = papaResults.data[i] as Array<unknown>;
            const entries = new Map<string, string>();
            for (let i = 0; i < row.length; i++) {
                const value = row[i];
                entries.set(String(i + 1), String(value));
            }
            result.rows.push(Object.fromEntries(entries));
        }
    }

    return result;
}

type TsvHeaderElement = {
    bin: number;
    organism: string;
    chromosome: string;
    range: {
        from: number;
        to: number
    }
}
const regexTsvHeaderElement = /bin(\d*)\|([a-z]*)\|(chr\w+):(\d+)-(\d+)/
function parseTsvHeaderElement(content: string): TsvHeaderElement {
    const parsedContent = regexTsvHeaderElement.exec(content);
    if (parsedContent == null) {
        throw "Crappy Tsv header element";
    }
    return {
        bin: Number(parsedContent[1]),
        organism: parsedContent[2],
        chromosome: parsedContent[3],
        range: {
            from: Number(parsedContent[4]),
            to: Number(parsedContent[5])
        }
    }
}

export function parseTsvFrequencyMatrix(content: string): FrequencyMatrixModel {
    const config = {
        delimiter: CsvDelimiter.Tabulator,
        hasHeader: false //will be manually removed, as also contains first column headers
    }

    const parseResult = Papa.parse<string[]>(content, config);
    const table = parseResult.data;
    const interactions: number[][] = [];
    //skip first row and column
    for (let row = 1; row < table.length; row++) {
        interactions.push([])
        for (let column = 1; column < table[row].length; column++) {
            let value = Number(table[row][column]);
            if (isNaN(value)) {
                value = 0;
            }
            interactions[row - 1].push(value);
        }
    }


    const ranges: { name: string, from: number, to: number }[] = [];
    const firstBin = parseTsvHeaderElement(table[0][1]);
    let range = {
        name: firstBin.chromosome,
        from: 0,
        to: 1
    }
    ranges.push(range);
    for (let column = 2; column < table[0].length; column++) {
        const bin = parseTsvHeaderElement(table[0][column]);
        if (bin.chromosome != range.name) {
            debugger;
            range = {
                name: bin.chromosome,
                from: column - 1,
                to: column
            }
            ranges.push(range);
        }
        range.to = column;
    }

    return {
        interactions,
        ranges
    }
}

export function parseXyz(content: string, config: ParseConfiguration, columns = [0, 1, 2]): XYZModel {
    const parseResult = parseCsvToObjects(content, config);
    const positions: Array<{ x: number, y: number, z: number }> = [];

    for (let i = 0; i < parseResult.rows.length; i++) {
        const row = parseResult.rows[i];

        const x = parseFloat(row[parseResult.columns[columns[0]]]);
        const y = parseFloat(row[parseResult.columns[columns[1]]]);
        const z = parseFloat(row[parseResult.columns[columns[2]]]);

        if (isFinite(x) && isFinite(y) && isFinite(z) && !isNaN(x) && !isNaN(y) && !isNaN(z)) {
            positions.push({
                x,
                y,
                z,
            });
        }
    }

    return { positions };
}

export function parseSparse1D(content: string, config: ParseConfiguration): Sparse1DModel {
    const parseResult = parseCsvToObjects(content, config);

    const data: Array<{ from: number, to: number, value: number }> = [];

    for (let i = 0; i < parseResult.rows.length; i++) {
        const row = parseResult.rows[i];
        data.push({
            from: parseFloat(row[parseResult.columns[0]]),
            to: parseFloat(row[parseResult.columns[1]]),
            value: parseFloat(row[parseResult.columns[2]])
        });
    }

    return { annotations: data };
}

export function parseSparseDistanceMatrix(content: string, config: ParseConfiguration): SparseDistanceMatrixModel {
    const parseResult = parseCsvToObjects(content, config);

    const data: Array<{ from: number, to: number, distance: number }> = [];

    for (let i = 0; i < parseResult.rows.length; i++) {
        const row = parseResult.rows[i];
        data.push({
            from: parseFloat(row[parseResult.columns[0]]),
            to: parseFloat(row[parseResult.columns[1]]),
            distance: parseFloat(row[parseResult.columns[2]])
        });
    }

    return { connections: data };
}

export function parseBed(content: string, delimiter: CsvDelimiter.Space | CsvDelimiter.Tabulator): BEDModel {

    const parseResults = parseCsvToObjects(content, {
        hasHeader: false,
        delimiter: delimiter,
    }) as ParseResult;

    const annotations = parseResults.rows.filter(r => r[1] != "browser" && r[1] != "track" && Object.keys(r).length != 1)

    return {
        annotations: annotations.map(
            a => {
                return {
                    chromosome: a[1],
                    from: toNumber(a[2]),
                    to: toNumber(a[3]),
                    fields: Object.values(a).filter(v => v !== ""),
                }
            }
        )
    }
}