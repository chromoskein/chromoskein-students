import { ChromatinModel } from "./models";

const ATOM_NAME = 'ATOM  ';
const ATOM_NAME_ALT = 'HETATM';
const isAtomName = (name: string) => name == ATOM_NAME || name == ATOM_NAME_ALT;



/**
 * Parses the given PDB string into atoms 
 * and ranges representing chromosomes 
 * based on ATOM, HETATM and CONECT remarks
 * @param {String} pdb
 * @returns {ChromatinModel}
 */
export function parsePdb(pdb: string): ChromatinModel {
  const pdbLines = pdb.split('\n');
  let bins: Array<{ x: number, y: number, z: number }> = [];

  // Connectivity
  let connectivityBitset: Array<0 | 1> = new Array(pdbLines.length).fill(0);
  let names: Array<string> = [];
  // Iterate each line looking for atoms
  let stop = false;
  pdbLines.forEach((pdbLine) => {
    if (pdbLine.length < 6) {
      return;
    }

    const identification = pdbLine.substring(0, 6);
    if (isAtomName(identification)) {
      if (!stop) {
        bins.push({
          x: parseFloat(pdbLine.substring(30, 38)),
          y: parseFloat(pdbLine.substring(38, 46)),
          z: parseFloat(pdbLine.substring(46, 54))
        });
      }
      names.push(`chr${pdbLine.substring(17, 21).trim()}`)
    } else if (identification === 'CONECT') {
      const from = parseInt(pdbLine.substring(6, 11)) - 1;
      const to = parseInt(pdbLine.substring(11, 16)) - 1;

      if (to - from == 1) {
        connectivityBitset[from] = 1;
      }
    } else if (identification === 'ENDMDL') {
      stop = true;
    }
  });

  const ranges: Array<{ name: string, from: number, to: number }> = [];

  connectivityBitset = connectivityBitset.slice(0, bins.length);
  let expandingRange = false;
  for (let i = 0; i < connectivityBitset.length; i++) {
    const currentValue = connectivityBitset[i];

    if (expandingRange && i == connectivityBitset.length - 1 && currentValue === 1) {
      ranges[ranges.length - 1].to = connectivityBitset.length;
      break;
    }

    if (currentValue === 0 && !expandingRange) continue;
    if (currentValue === 1 && expandingRange) continue;

    if (currentValue === 1 && !expandingRange) {
      // Start new range
      ranges.push({
        name: names[i],
        from: i,
        to: i + 1
      });
      expandingRange = true;
    }

    if (currentValue === 0 && expandingRange) {
      // End the range
      ranges[ranges.length - 1].to = i;
      expandingRange = false;
    }
  }

  return {
    bins,
    ranges,
    connectivityBitset
  };
}
