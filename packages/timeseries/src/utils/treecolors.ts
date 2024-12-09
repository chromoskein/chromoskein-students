import chroma from "chroma-js";
import { vec3 } from "gl-matrix";
import type { ClusterNode } from "./main";

export const staticColors: vec3[] = [vec3.fromValues(0.0159, 0.9294, 0), vec3.fromValues(0.9294, 0, 0.0157), vec3.fromValues(0, 0.0157, 0.9294), vec3.fromValues(0.9294, 0.9137, 0), vec3.fromValues(0, 0.9294, 0.9137), vec3.fromValues(0.9137, 0, 0.9294)];

const ep: number = 1e-15;

let children = 'children',
  color = 'color',
  range = [0, 360],
  fraction = 0.75,
  permutate = true,
  reverse = false,
  luminanceStart = 40,
  luminanceDelta = 10,
  chromaStart = 75,
  chromaDelta = -5,
  rootColor = { h: 0, c: 0, l: 70, rgb: vec3 }
  ;

function getChildren(root: ClusterNode[][], node: ClusterNode): ClusterNode[] {
  if (node.k + 1 >= root.length) return [];

  const children = root[node.k + 1].filter((c: ClusterNode) => node.children.includes(c.i));

  return children;
}

function setColor(node: ClusterNode, c: { h: number, c: number, l: number }) {
  const rgb = chroma.hcl(c.h, c.c, c.l);

  node[color] = rgb.gl().slice(0, 3);
}

function doPermutation(r) {
  var n = r.length,
    sequence = getPermutationSequence(n),
    permutated = new Array(n);

  r.forEach(function (value, index) {
    permutated[sequence[index]] = value;
  });

  return permutated;
}

export function assignHue(root: ClusterNode[][], node: ClusterNode, range, level: number = 0, colorLevel: number) {
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
  var r = Array.apply(null, { length: n }).map(Number.call, Number);

  //2. if perm then permute the ri’s;
  if (permutate) {
    r = doPermutation(r);
  }

  //3. convert each ri to a hue range (e.g. [30, 50])

  r = r.map(function (i) {
    return [
      range[0] + i * delta,
      range[0] + (i + 1) * delta
    ];
  });


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
    r = r.map(function (range, i) {
      if (i % 2 === 0) {
        return [range[1], range[0]];
      }
      return range;
    });
  }

  //6. for each child node vi call assignHue recursively.
  getChildren(root, node).forEach(function (child: ClusterNode, i: number) {
    assignHue(root, child, r[i], level + 1, colorLevel + 1);
  });
}

export function treeColor(root: ClusterNode[][]) {
  assignHue(root, root[1][0], range, 0, 0);
}

// switch (preset) {
//   case 'add':
//   case 'additive':
//     // nothing to do. additive is the default
//     break;
//   case 'sub':
//   case 'subtractive':
//     luminanceStart = 40;
//     luminanceDelta = 10;
//     chromaStart = 75;
//     chromaDelta = -5;
//     break;
// }

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
