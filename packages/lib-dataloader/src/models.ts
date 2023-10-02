/**
 * @param bins - List of all atom positions in 3D space
 * @param ranges - Objects with `from` and `to` indices to `bins`, representing chromosomes
 * @param connectivityBitset - Binary array. 1 signifying a bin form `bins` on the same index is connected to the bin in the next index (belongig to the same chromosome).  
 */
export interface ChromatinModel {
    bins: Array<{ x: number, y: number, z: number }>;
    ranges: Array<{ name: string, from: number, to: number }>;
    connectivityBitset: Array<0 | 1>;
};

/**
 * @param interactions - 2D array of all interactions
 * @param ranges - Objects with `from` and `to` indices to `interactions`, representing chromosomes
 */
export interface FrequencyMatrixModel {
    interactions: number[][];
    ranges: Array<{ name: string, from: number, to: number }>;
}

/**
 * @param chromosome - Identification of a chromosome
 * @param from - begining of the feature, given in base pairs from the start of the chromosome 
 * @param to - end of the feature, given in base pairs from the start of the chromosome 
 * @param fields - a list of all fields of the feature

 */
export interface BEDAnnotationModel {
    chromosome: string,
    from: number,
    to: number,
    fields: string[]
}

/**
 * @param annotations - List of {@link BEDAnnotationModel}
 */
export interface BEDModel {
    annotations: BEDAnnotationModel[]
}

/**
 * @param positions - List of all positions in 3D space
 */
export interface XYZModel {
    positions: Array<{ x: number, y: number, z: number }>;
}

/**
 * @param connections - List of all `from`-`to` annotations with a value  
 */
export interface Sparse1DModel {
    annotations: Array<{ from: number, to: number, value: number }>
}

/**
 * @param connections - List of all `from`-`to` pairs with a `distance` value  
 */
export interface SparseDistanceMatrixModel {
    connections: Array<{ from: number, to: number, distance: number }>
}

