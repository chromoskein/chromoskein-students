# Chromoskein Students
Offshoot of the Chromoskein tool for visualizing genomic data with a special focus 3D chromatin structures predicted from Hi-C.
Currently used for developing its timeseries visualization. 

#### Timeseries project initialization
- `git clone`
- `cd chromoskein-students`
- `npm install`
- `npm run timeseries-dev`
- Go to repsective localhost server to open application

## Missing Data
Unfortunately, the data used by the thesis is not freely avaliable and thus cannot be freely shared. For this reason, the application cannot run as the data is baked in to the implementation and
it is missing. To fix this, the dataset must be readded into the application, more specifically the *timeseries* folder containing the *timestep_n.XYZ* files must be added into the */timeseries/public* folder of the application. 

## Application controls
**3D View**: The 3D view can be controlled via the mouse, specficially pressing the RMB allows rotation of the camera and the scroll wheel can be user to zoom in and out. Furthermore, the bottom of the 3D view contains a slider, which can be used to change the currently selected timestep shown in the 3D view (Data contains timesteps from 0 to 599)

**Sidebar**: The sidebar contains options to change the properties of the 3D view. Most commonly it can be used to change the hierarchical clustering level shown via a slider or by clicking on the denrogram visualizing the clustering. The sidebar also contains a dropdown menu labeled *Visualization* which allows switching between the different avaliable techniques. The selected visualization technique also changes the options avaliable in the sidebar. For example, the volume allows changes of colormap, transfer function, property, radius, etc.

**Composite**: The composite visualization can be accessed via the *Composite* option in the visualisation selection drowdown menu. It currently allows selection between three different interactions. Regardless of the selected interaction, the iteraction is used by pressing the RMB on a hovered cluster.
Interaction types:
- Change representation: Enables a dropdown menu which allows changing the visualization type of a clicked cluster
- Merge: Clicking a cluster will merge it into its parent in the hierarchical clustering tree. The parent cluster also merges all of its other clusters and gains the visualization type of the clicked cluster.
- Split: Clicking a cluster will split it into its children in the hierarchical clustering tree. The children will have the same visualization type as was their parents.

The split and merge functionality can also be accessed by clicking directly on the highlighted cluster in the sidebards dendrogram. Lastly, the show connections button creates tubes that connect neighboring clusters in the original chomatin sequence.

## Where to find implemented files:
This section serves to define where to find files changed and implemented during the making of this thesis. Although this list is incomplete as many changes were forgotten :d

**Adam Rychly**:

GUI Work: 
- /timeseries/src/App.svelte - All work related to the SDF, Matryoshka, Volumes, Pathline, Spheres, Splines, and clustering as very little of the original implementation remains unchanged
- /timeseries/src/objects/SignedDistanceGrid.svelte - Some changes to the code
- /timeseries/src/objects/SignedDistanceGridBlended.svelte - Contains the frontend implementation of the Matryoshka visualization
- /timeseries/src/visualizations/MatryoshkaClusters.svelte - Contains the frontend preprocessing of data for the Matryoshka visualization
- /timeseries/src/visualizations/InteractiveClusters.svelte - Setup of the composite visualization framework and events related to mouseclicking and mousemove were done by me

Clustering and composite visualization:
- /timeseries/src/utils/hclust.ts - Contains the hierarchical clustering implementation including the sequential alternative
- /timeseries/src/interactiveClusters/* - Contains the entire class decomposition and every implementation of the composite cluster visualization

Graphics backend work:
- /lib-graphics/src/scene.ts - Contains part of the pipeline changes allowing multiple volumes to be rendered
- /lib-graphics/src/rendering/objects/parametric/dynamicVolume.ts - Contains the pipeline setup, data overhead, changes and the fragment shader implmenetation of the rendering of the clusters for dynamic volumes (code is a changed adaptation of /lib-graphics/src/rendering/objects/parametric/volume.ts)
- /lib-graphics/src/rendering/objects/parametric/dynamicVolumeFromPathlines.ts - Contains the compute shader code for the property grid calculation, it is a change of the original implementation
- /lib-graphics/src/rendering/objects/parametric/signedDistanceGrid.ts - Contains the pipeline setup, data overhead, changes and the fragment shader implementation of the rendering of the clusters for SDF and matryoshka (the code is a very adapted version of an existing implementation)
- /lib-graphics/src/rendering/objects/parametric/signedDistanceGridFromPoints.ts - Contains the compute shader code for the SDF calculation for both single SDF and Matryoshka SDF (changed scaling and allowed multiple objects from original implementation)
- And many more that I forget or are too small changes to mention