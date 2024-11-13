# Chromoskein Experimental
Offshoot of the Chromoskein tool for visualizing genomic data with a special focus 3D chromatin structures predicted from Hi-C.
Currently used for developing its timeseries visualization. 

#### Timeseries project initialization
- `git clone`
- `cd chromoskein-students`
- Next it is necessary to link the graphics library. There are two options how to do this:
1. Use the library as a npm package
    - Create [a personal access token](https://docs.github.com/en/authentication/keeping-your-account-and-data-secure/managing-your-personal-access-tokens#creating-a-personal-access-token-classic) with at least `read:packages` privileges.
    - Login to the GitHub npm registry with `npm login --registry https://npm.pkg.github.com`. Use the generated token as the **password**.
    - Next specify the source of the library:
        - Either add a `.npmrc` file the the root project directory which contains `@chromoskein:registry=https://npm.pkg.github.com`.
        - Or define the source for your npm user locally using `npm config set @chromoskein:registry=https://npm.pkg.github.com`
    - Then use and install the library like normal `npm install @chromoskein/lib-graphics`.
2. Use a local version of the library
    - Pull the library into a separate folder using git
    - In the library folder use `npm install` and `npm run build` to build the library
    - Next in the library folder run `npm link` to create symlink to the built library
    - Lastly, back in the chromoskein project folder run `npm link @chromoskein/lib-graphics` to link the library into your `node_modules`
- `npm install`
- `npm run timeseries-dev`
- Go to repsective localhost server to open application

## Application controls
**3D View**: The 3D view can be controlled via the mouse, specficially pressing the RMB allows rotation of the camera and the scroll wheel can be user to zoom in and out. Furthermore, the bottom of the 3D view contains a slider, which can be used to change the currently selected timestep shown in the 3D view (Data contains timesteps from 0 to 599)

**Sidebar**: The sidebar contains options to change the properties of the 3D view. Most commonly it can be used to change the hierarchical clustering level shown via a slider or by clicking on the denrogram visualizing the clustering. The sidebar also contains a dropdown menu labeled *Visualization* which allows switching between the different avaliable techniques. The selected visualization technique also changes the options avaliable in the sidebar. For example, the volume allows changes of colormap, transfer function, property, radius, etc.

**Composite**: The composite visualization can be accessed via the *Composite* option in the visualisation selection drowdown menu. It currently allows selection between three different interactions. Regardless of the selected interaction, the iteraction is used by pressing the RMB on a hovered cluster.
Interaction types:
- Change representation: Enables a dropdown menu which allows changing the visualization type of a clicked cluster
- Merge: Clicking a cluster will merge it into its parent in the hierarchical clustering tree. The parent cluster also merges all of its other clusters and gains the visualization type of the clicked cluster.
- Split: Clicking a cluster will split it into its children in the hierarchical clustering tree. The children will have the same visualization type as was their parents.

The split and merge functionality can also be accessed by clicking directly on the highlighted cluster in the sidebards dendrogram. Lastly, the show connections button creates tubes that connect neighboring clusters in the original chomatin sequence.