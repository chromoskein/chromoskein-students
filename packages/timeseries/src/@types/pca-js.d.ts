declare module 'pca-js' {
    // Not declaring types of the entire library
    function getEigenVectors(array: vec3[]): {eigenvalue: number, vector: vec3}[];
    
    export = {
        getEigenVectors
    }
}