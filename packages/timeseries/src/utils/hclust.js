// get euclidean distance between two equal-dimension vectors
export const euclideanDistance = (a, b) => {
    const size = Math.min(a.length, b.length);
    let sum = 0;
    for (let index = 0; index < size; index++)
      sum += (a[index] - b[index]) * (a[index] - b[index]);
    return Math.sqrt(sum);
  };
  
  // get average distance between sets of indexes, given distance matrix
  export const averageDistance = (setA, setB, distances) => {
    let distance = 0;
    for (const a of setA) {
      for (const b of setB)
        distance += distances[a][b];
    }
  
    return distance / setA.length / setB.length;
  };
  
  // update progress by calling user onProgress and postMessage for web workers
  const updateProgress = (stepNumber, stepProgress, onProgress) => {
    // currently only two distinct steps: computing distance matrix and clustering
    const progress = stepNumber / 2 + stepProgress / 2;
  
    // if onProgress is defined and is a function, call onProgress
    if (typeof onProgress === 'function')
      onProgress(progress);
  
    // if this script is being run as a web worker, call postMessage
    if (
      typeof WorkerGlobalScope !== 'undefined' &&
      self instanceof WorkerGlobalScope
    )
      postMessage(progress);
  };
  
  // default onProgress function. console logs progress
  const logProgress = (progress) =>
    console.log('Clustering: ', (progress * 100).toFixed(1) + '%');
  
  // the main clustering function
  export const clusterData = ({
    data = [],
    key = '',
    distance = euclideanDistance,
    linkage = averageDistance,
    onProgress = logProgress
  }) => {
    // extract values from specified key
    if (key)
      data = data.map((datum) => datum[key]);
  
    // compute distance between each data point and every other data point
    // N x N matrix where N = data.length
    const distances = data.map((datum, index) => {
      updateProgress(0, index / (data.length - 1), onProgress);
  
      // get distance between datum and other datum
      return data.map((otherDatum) => distance(datum, otherDatum));
    });
  
    // initialize clusters to match data
    const clusters = data.map((datum, index) => ({
      height: 0,
      indexes: [Number(index)]
    }));
  
    // keep track of all tree slices
    let clustersGivenK = [];
  
    // iterate through data
    for (let iteration = 0; iteration < data.length; iteration++) {
      updateProgress(1, (iteration + 1) / data.length, onProgress);
  
      // add current tree slice
      clustersGivenK.push(clusters.map((cluster) => cluster.indexes));
  
      // dont find clusters to merge when only one cluster left
      if (iteration >= data.length - 1)
        break;
  
      // initialize smallest distance
      let nearestDistance = Infinity;
      let nearestRow = 0;
      let nearestCol = 0;
  
      // upper triangular matrix of clusters
      for (let row = 0; row < clusters.length; row++) {
        for (let col = row + 1; col < clusters.length; col++) {
          // calculate distance between clusters
          const distance = linkage(
            clusters[row].indexes,
            clusters[col].indexes,
            distances
          );
          // update smallest distance
          if (distance < nearestDistance) {
            nearestDistance = distance;
            nearestRow = row;
            nearestCol = col;
          }
        }
      }
  
      // merge nearestRow and nearestCol clusters together
      const newCluster = {
        indexes: [
          ...clusters[nearestRow].indexes,
          ...clusters[nearestCol].indexes
        ],
        height: nearestDistance,
        children: [clusters[nearestRow], clusters[nearestCol]]
      };
  
      // remove nearestRow and nearestCol clusters
      // splice higher index first so it doesn't affect second splice
      clusters.splice(Math.max(nearestRow, nearestCol), 1);
      clusters.splice(Math.min(nearestRow, nearestCol), 1);
  
      // add new merged cluster
      clusters.push(newCluster);
    }
  
    // assemble full list of tree slices into array where index = k
    clustersGivenK = [[], ...clustersGivenK.reverse()];
  
    // return useful information
    return {
      clusters: clusters[0],
      distances: distances,
      order: clusters[0].indexes,
      clustersGivenK: clustersGivenK
    };
  };

    // So far just a modified copy of the original due to not being sure if its going to be further modified
    export const clusterDataSequential = ({
      data = [],
      key = '',
      distance = euclideanDistance,
      linkage = averageDistance,
    }) => {
      // extract values from specified key
      if (key)
        data = data.map((datum) => datum[key]);
    
      // compute distance between each data point and every other data point
      // N x N matrix where N = data.length
      const distances = data.map((datum, index) => {
        // get distance between datum and other datum
        return data.map((otherDatum) => distance(datum, otherDatum));
      });
    
      // initialize clusters to match data
      const clusters = data.map((datum, index) => ({
        height: 0,
        indexes: [Number(index)]
      }));
    
      let clusterDistnaces = [];
      for (let i = 0; i < clusters.length - 1; i++) {
        clusterDistnaces.push(distance(data[i], data[i + 1]));
      }

      // keep track of all tree slices
      let clustersGivenK = [];
    
      // iterate through data
      for (let iteration = 0; iteration < data.length; iteration++) {
        // add current tree slice
        clustersGivenK.push(clusters.map((cluster) => cluster.indexes));
    
        // dont find clusters to merge when only one cluster left
        if (iteration >= data.length - 1)
          break;
    
        // initialize smallest distance
        let nearestDistance = Infinity;
        let nearest = 0;

        // upper triangular matrix of clusters
        for (let row = 0; row < clusters.length - 1; row++) {
          let col = row + 1;
          // calculate distance between clusters
          const distance = clusterDistnaces[row];
  
          // update smallest distance
          if (distance < nearestDistance) {
            nearestDistance = distance;
            nearest = row;
          }
        }

        // merge nearestRow and nearestCol clusters together
        const newCluster = {
          indexes: [
            ...clusters[nearest].indexes,
            ...clusters[nearest + 1].indexes
          ],
          height: nearestDistance,
          children: [clusters[nearest], clusters[nearest + 1]]
        };
        
        if (clusters.length == 2) {
          // Base case when only two clusters remain --(AB)--
          clusterDistnaces = [0]
        }
        else if (nearest == 0) {
          // Splicing the first cluster at start --A(BC)
          const rightDistance = linkage(clusters[nearest + 2].indexes, newCluster.indexes, distances); // This is dist (BC)D
          clusterDistnaces.splice(nearest, 2, rightDistance);
        }
        else if (nearest + 1 == clusters.length - 1) {
          // Splicing the last cluster at end A(BC)--
          const leftDistance = linkage(clusters[nearest - 1].indexes, newCluster.indexes, distances); // This is dist A(BC)
          clusterDistnaces.splice(nearest - 1, 2, leftDistance);
        }
        else {
          // Inner splice in situation A(BC)D
          const leftDistance = linkage(clusters[nearest - 1].indexes, newCluster.indexes, distances); // This is dist A(BC)
          const rightDistance = linkage(clusters[nearest + 2].indexes, newCluster.indexes, distances); // This is dist (BC)D
          clusterDistnaces.splice(nearest - 1, 3, leftDistance, rightDistance);
        }
    
        // Remove the original clusters and insert the new cluster in their place
        clusters.splice(nearest, 2, newCluster);
      }
    
      // assemble full list of tree slices into array where index = k
      clustersGivenK = [[], ...clustersGivenK.reverse()];
    
      // return useful information
      return {
        clusters: clusters[0],
        distances: distances,
        order: clusters[0].indexes,
        clustersGivenK: clustersGivenK
      };
    };