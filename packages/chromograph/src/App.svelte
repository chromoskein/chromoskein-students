<script lang="ts">
  import { CsvDelimiter, parseBed, parsePdb, parseTsvFrequencyMatrix, parseXyz } from "lib-dataloader";

  const testPdb = `
ATOM     21  N  ALEU A 392      64.898 118.959  40.827  0.60 24.19           N  
ATOM     22  N  BLEU A 392      64.981 118.958  40.769  0.45 24.73           N  
ATOM     23  CA ALEU A 392      64.818 117.251  41.235  0.60 22.53           C  
ATOM     24  CA BLEU A 392      64.908 117.527  41.044  0.45 23.55           C 
`;

  const resultPdb = parsePdb(testPdb);
  console.log(resultPdb);

  const testBed = `
chr7  127471196  127472363  Pos1  0  +  127471196  127472363  255,0,0
chr7  127472363  127473530  Pos2  0  +  127472363  127473530  255,0,0
`;

  const resultBed = parseBed(testBed, CsvDelimiter.Space);
  console.log(resultBed);

  const testXyz = `x\ty\tz
1\t2\t3
4\t5\t6`;

  const resultXyz = parseXyz(testXyz, {
    delimiter: CsvDelimiter.Tabulator,
    hasHeader: true,
  });
  console.log(resultXyz);

  console.log(parseTsvFrequencyMatrix)
</script>

<main>
  <h1>Chromograph</h1>

  <div class="card" />
</main>

<style>
</style>
