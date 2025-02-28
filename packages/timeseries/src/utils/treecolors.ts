import chroma from "chroma-js";
import { vec3 } from "gl-matrix";
import type { ClusterNode } from "./main";
export const staticColors: vec3[] = [vec3.fromValues(0.0159, 0.9294, 0), vec3.fromValues(0.9294, 0, 0.0157), vec3.fromValues(0, 0.0157, 0.9294), vec3.fromValues(0.9294, 0.9137, 0), vec3.fromValues(0, 0.9294, 0.9137), vec3.fromValues(0.9137, 0, 0.9294)];

const ep: number = 1e-15;

let children = 'children';
let color = 'color';
let range: [number, number] = [0, 360];
let fraction = 0.75;
let permutate = true;
let reverse = false;
let luminanceStart = 45;
let luminanceDelta = 8;
let chromaStart = 85;
let chromaDelta = -5;
let rootColor = { h: 0, c: 0, l: 70, rgb: vec3 };

function getChildren(root: ClusterNode[][], node: ClusterNode): ClusterNode[] {
  if (node.k + 1 >= root.length) return [];

  const children = root[node.k + 1].filter((c: ClusterNode) => node.children.includes(c.i));

  return children;
}

function setColor(node: ClusterNode, c: { h: number, c: number, l: number }) {
  const rgb: chroma.Color = chroma.hcl(c.h, c.c, c.l);

  const rgbArray: number[] = rgb.gl().slice(0, 3);

  node.color = vec3.fromValues(rgbArray[0], rgbArray[1], rgbArray[2]);
}

function doPermutation(r: number[]) {
  var n = r.length,
    sequence = getPermutationSequence(n),
    permutated = new Array(n);

  r.forEach(function (value: number, index: number) {
    permutated[sequence[index]] = value;
  });

  return permutated;
}

export function assignHue(root: ClusterNode[][], node: ClusterNode, range: [number, number], level: number = 0, colorLevel: number) {
  // select the middle hue value in range as the hue value of node
  if (level >= 15) {
    return;
  }

  if (level === 0) { // node is the root
    setColor(node, rootColor);
  } else {
    
    setColor(node, { h: (range[0] + range[1]) / 2, c: chromaStart + chromaDelta * colorLevel, l: luminanceStart + luminanceDelta * colorLevel });
  }

  // Let N be the number of child nodes of v. If N > 0 :
  const n: number = getChildren(root, node) ? getChildren(root, node).length : 0;

  if (n === 0) return;
  if (n === 1) { 
    assignHue(root, getChildren(root, node)[0], range, level + 1, colorLevel); 
    return;
  }

  const delta = (range[1] - range[0]) / n;

  //1. divide range in N equal parts ri with i = 1, ... ,N;
  //   For convenience, we will use i = 0, ... , n - 1 instead of i = 1, ..., n
  var r: number[] = Array.apply(null, Array(n)).map((val, idx) => idx);

  //2. if perm then permute the ri’s;
  if (permutate) {
    r = doPermutation(r);
  }

  //3. convert each ri to a hue range (e.g. [30, 50])

  let ranges: [number, number][] = r.map(i => [
      range[0] + i * delta,
      range[0] + (i + 1) * delta
  ]);


  //4. reduce each ri by keeping its middle fraction ;
  //   In the algorithm described in the paper, we reverse each ri first.
  //   However, now, we reverse them later.
  /*
  r = r.map(function (range) {
    return [
      range[0] + (range[1] - range[0]) * ((1 - fraction) / 2.0),
      range[1] - (range[1] - range[0]) * ((1 - fraction) / 2.0)
    ];
  });
  */

  //5. if rev then reverse the even-numbered ri’s;
  if (reverse) {
    ranges = ranges.map((range: [number, number], i: number) => (i % 2 === 0) ? [range[1], range[0]] : range);
  }

  //6. for each child node vi call assignHue recursively.
  getChildren(root, node).forEach(function (child: ClusterNode, i: number) {
    assignHue(root, child, ranges[i], level + 1, colorLevel + 1);
  });
}

export function treeColor(root: ClusterNode[][]) {
  assignHue(root, root[1][0], range, 0, 0);
}


export function getPermutationSequence(n: number) {
  if (n === 0) return [];
  if (n === 1) return [0];
  if (n === 2) return [0, 1];
  if (n === 3) return [0, 2, 1];
  if (n === 4) return [0, 2, 1, 3];

  // 144 is not a magic number. It is because the used permutation order is based on five-elements-permutation.
  var unitAngle = 360 / n,
    pickingAngle = Math.floor(144 / unitAngle) * unitAngle,
    sequence = new Array(n),
    picked = new Array(n),
    angle = 0
    ;

  for (var i = 0; i < n; ++i) {
    var index = Math.floor(angle / unitAngle + ep);

    sequence[i] = index;
    picked[index] = true;

    angle = (angle + pickingAngle) % 360;

    if (i < n - 1) {
      while (picked[Math.floor(angle / unitAngle + ep)]) {
        angle = (angle + unitAngle) % 360;
      }
    }
  }

  return sequence;
};

var seed = 1;
function random() {
    var x = Math.sin(seed++) * 10000;
    return x - Math.floor(x);
}

function randomDouble(min: number, max: number) {
  return random() * (max - min) + min;
}

function disturbColor(color: chroma.Color, hcl_disturb_offset: [number, number, number]) {
  let lumi_scope = [45, 85];
  let chroma_scope = [45, 85];
  let hue_scope = [0, 180]

  let hcl = color.hcl();
  let chrom = randomDouble(
    Math.max(Math.round(hcl[1] - hcl_disturb_offset[1]), chroma_scope[0]),
    Math.min(Math.round(hcl[1] + hcl_disturb_offset[1]), chroma_scope[1])
  );
  let lumi = randomDouble(
    Math.max(Math.round(hcl[2] - hcl_disturb_offset[2]), lumi_scope[0]),
    Math.min(Math.round(hcl[2] + hcl_disturb_offset[2]), lumi_scope[1])
  );

  let hue = randomDouble(
    Math.max(Math.round(hcl[0] - hcl_disturb_offset[0]), hue_scope[0]),
    Math.min(Math.round(hcl[0] + hcl_disturb_offset[0]), hue_scope[1])
  );
  
  /*
  if (hue > 84 && hue < 115) {
      if (hue < 99.5) hue = 84;
      else hue = 115;
  }
  */
  
  return chroma.hcl(hue, chrom, lumi);
}

function deg2rad(degrees: number): number {
  return (degrees * Math.PI) / 180;
}

function rad2deg(radians: number): number {
  return (radians * 180) / Math.PI;
}

function ciede2000(lab1: [number, number, number], lab2: [number, number, number]): number {
  const [L1, a1, b1] = lab1;
  const [L2, a2, b2] = lab2;
  
  const avgLp = (L1 + L2) / 2;
  const C1 = Math.sqrt(a1 * a1 + b1 * b1);
  const C2 = Math.sqrt(a2 * a2 + b2 * b2);
  const avgCp = (C1 + C2) / 2;
  
  const G = 0.5 * (1 - Math.sqrt(Math.pow(avgCp, 7) / (Math.pow(avgCp, 7) + Math.pow(25, 7))));
  const a1p = (1 + G) * a1;
  const a2p = (1 + G) * a2;
  const C1p = Math.sqrt(a1p * a1p + b1 * b1);
  const C2p = Math.sqrt(a2p * a2p + b2 * b2);
  const avgCpp = (C1p + C2p) / 2;
  
  let h1p = rad2deg(Math.atan2(b1, a1p));
  if (h1p < 0) h1p += 360;
  let h2p = rad2deg(Math.atan2(b2, a2p));
  if (h2p < 0) h2p += 360;
  
  let dHp = h2p - h1p;
  if (dHp > 180) dHp -= 360;
  if (dHp < -180) dHp += 360;
  
  const dLp = L2 - L1;
  const dCp = C2p - C1p;
  dHp = 2 * Math.sqrt(C1p * C2p) * Math.sin(deg2rad(dHp) / 2);
  
  const avgHp = (Math.abs(h1p - h2p) > 180) ? (h1p + h2p + 360) / 2 : (h1p + h2p) / 2;
  
  const T = 1 - 0.17 * Math.cos(deg2rad(avgHp - 30)) + 
                0.24 * Math.cos(deg2rad(2 * avgHp)) + 
                0.32 * Math.cos(deg2rad(3 * avgHp + 6)) - 
                0.20 * Math.cos(deg2rad(4 * avgHp - 63));
  
  const dTheta = 30 * Math.exp((-1 * ((avgHp - 275) / 25)) ** 2);
  const Rc = 2 * Math.sqrt(Math.pow(avgCpp, 7) / (Math.pow(avgCpp, 7) + Math.pow(25, 7)));
  const Sl = 1 + ((0.015 * (avgLp - 50) ** 2) / Math.sqrt(20 + (avgLp - 50) ** 2));
  const Sc = 1 + 0.045 * avgCpp;
  const Sh = 1 + 0.015 * avgCpp * T;
  const Rt = -Math.sin(deg2rad(2 * dTheta)) * Rc;
  
  return Math.sqrt(
      (dLp / Sl) ** 2 + (dCp / Sc) ** 2 + (dHp / Sh) ** 2 + Rt * (dCp / Sc) * (dHp / Sh)
  );
}