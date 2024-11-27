import { vec3 } from "gl-matrix";

export function calculateSphereParameters(points: vec3[]) {
    let center: vec3 = vec3.fromValues(0, 0, 0);
    points.forEach(point => { vec3.add(center, center, point) });
    vec3.div(center, center, vec3.fromValues(points.length, points.length, points.length));

    let maxDist = 0;
    points.forEach(point => {
        const dist = vec3.dist(point, center); 
        if (dist > maxDist) maxDist = dist;
    });

    return {
        center: center,
        radius: maxDist,
    };
}

export function findClosestPoints(cluster1: vec3[], cluster2: vec3[], minDistance: number, threshold: number, secondPoint: boolean): vec3[] {
    let closestPoints: {
      point: vec3,
      dist: number
    }[] = [];

    for (let i = 0; i < cluster1.length; i++) {
        for (let j = 0; j < cluster2.length; j++) {
            let distance = vec3.dist(cluster1[i], cluster2[j]);

            if (distance < minDistance) {
              closestPoints.push({
                point: (secondPoint) ? cluster2[j] : vec3.lerp(vec3.create(), cluster1[i], cluster2[j], 0.25),
                dist: distance,
              });  
            }
        } 
    }

    // Sorts the found points in descending order
    closestPoints.sort((a, b) => { return a.dist - b.dist });
    let result: vec3[] = [];
    
    for (let candidate of closestPoints) {
      if (result.filter(a => vec3.dist(candidate.point, a) < threshold).length == 0) {
        result.push(candidate.point);
      }
    }

    return result;
  }