<script lang="ts">
  import "../../styles/global.css";
  import "../../styles/tabs.css";
  import "../../styles/splitpanes.css";

  import { Pane, Splitpanes } from "svelte-splitpanes";
  import { v4 as uuidv4 } from "uuid";

  import { configurations, selectedPanelID, layout, type ConfigurationType } from "../../storage/storage";
  import type * as Storage from "../../storage/storage";
  import Viewport from "../viewports/Viewport.svelte";
  import { findAnyPane, findPane, findParent, optimizeTree } from ".";
  import type { Writable } from "svelte/store";

  export let root: Storage.Dockable;
  export let pane: Storage.Dockable;

  let dropPosition = 0;
  let dropZoneClasses = "drop-highlight";
  $: {
    const positionClasses = ["center", "top", "right", "bottom", "left"];

    if (mousePosition.x > 0.25 * dropZoneWidth && mousePosition.y > 0.25 * dropZoneHeight && mousePosition.x < 0.75 * dropZoneWidth && mousePosition.y < 0.75 * dropZoneHeight) {
      // Center
      dropPosition = 0;
    } else if (mousePosition.y < 0.25 * dropZoneHeight && mousePosition.x > 0.25 * dropZoneWidth && mousePosition.x < 0.75 * dropZoneWidth) {
      // Top
      dropPosition = 1;
    } else if (mousePosition.y > 0.75 * dropZoneHeight && mousePosition.x > 0.25 * dropZoneWidth && mousePosition.x < 0.75 * dropZoneWidth) {
      // Bottom
      dropPosition = 3;
    } else if (mousePosition.x > 0.75 * dropZoneWidth && mousePosition.y > 0.25 * dropZoneHeight && mousePosition.y < 0.75 * dropZoneHeight) {
      // Right
      dropPosition = 2;
    } else if (mousePosition.x < 0.25 * dropZoneWidth && mousePosition.y > 0.25 * dropZoneHeight && mousePosition.y < 0.75 * dropZoneHeight) {
      // Left
      dropPosition = 4;
    }
    // Corners
    // Top-Left
    else if (mousePosition.x < 0.25 * dropZoneWidth && mousePosition.y < 0.25 * dropZoneHeight) {
      if (mousePosition.x > mousePosition.y) {
        dropPosition = 1;
      } else {
        dropPosition = 4;
      }
    }
    // Top-Right
    else if (mousePosition.x > 0.25 * dropZoneWidth && mousePosition.y < 0.25 * dropZoneHeight) {
      if (mousePosition.x - dropZoneWidth + mousePosition.y < 1) {
        dropPosition = 1;
      } else {
        dropPosition = 2;
      }
    }
    // Bottom-Left
    else if (mousePosition.x < 0.25 * dropZoneWidth && mousePosition.y > 0.75 * dropZoneHeight) {
      if (mousePosition.y - dropZoneHeight + mousePosition.x < 1) {
        dropPosition = 4;
      } else {
        dropPosition = 3;
      }
    }
    // Bottom-Right
    else if (mousePosition.x > 0.25 * dropZoneWidth && mousePosition.y > 0.75 * dropZoneHeight) {
      if (mousePosition.x - dropZoneWidth < mousePosition.y - dropZoneHeight) {
        dropPosition = 3;
      } else {
        dropPosition = 2;
      }
    }

    dropZoneClasses = `drop-highlight ${isDraggedOver ? "drop-highlight--visible" : "drop-highlight--hidden"} drop-highlight--${positionClasses[dropPosition]}`;
  }

  const mousePosition = {
    x: 0,
    y: 0,
  };

  let dropZoneWidth = 0;
  let dropZoneHeight = 0;

  let isDraggedOver = false;

  function onMouseMove(e) {
    mousePosition.x = e.offsetX;
    mousePosition.y = e.offsetY;
  }

  function handleDragStart(e, childID: number) {
    if (pane.tag !== "pane") return;

    e.dataTransfer.setData("fromPaneID", pane.id);
    e.dataTransfer.setData("childID", childID);
  }

  function onDragEnter() {
    isDraggedOver = true;
  }

  function onDragLeave() {
    isDraggedOver = false;
  }

  function onDragOver(e) {
    mousePosition.x = e.offsetX;
    mousePosition.y = e.offsetY;
  }

  function handleDragDrop(e) {
    e.preventDefault();

    isDraggedOver = false;
    if (pane.tag !== "pane") return;

    const fromPaneID: string = e.dataTransfer.getData("fromPaneID");
    const childID: number = parseInt(e.dataTransfer.getData("childID"), 10);

    const fromPane = findPane(root, fromPaneID);

    if (!fromPane || fromPane.tag !== "pane") return;

    // Remove
    fromPane.children = fromPane.children.filter((v) => v !== childID);

    // Add child or split + child
    if (dropPosition === 0) {
      pane.children = [...pane.children, childID];
    } else {
      const existingChildren = [...pane.children];

      let parent = findParent($layout, pane.id);

      if (parent && parent.tag !== "pane") {
        const childIndex = parent.children.findIndex((c) => c.id === pane.id);
        parent.children[childIndex] = {
          tag: dropPosition === 1 || dropPosition === 3 ? "horizontal" : "vertical",

          id: uuidv4(),

          size: 100,

          children: [
            {
              tag: "pane",

              id: uuidv4(),

              size: 50,

              selectedComponent: 0,
              children: dropPosition === 1 || dropPosition === 4 ? [childID] : existingChildren,
            },
            {
              tag: "pane",

              id: uuidv4(),

              size: 50,

              selectedComponent: 0,
              children: dropPosition === 1 || dropPosition === 4 ? existingChildren : [childID],
            },
          ],
        };
        parent = parent;
      }
    }

    // Optimize the final panes
    root = optimizeTree(root, null);

    const anyPane = findAnyPane(root);
    if ($selectedPanelID && !findPane(root, $selectedPanelID) && anyPane) {
      $selectedPanelID = anyPane.id;
    }
  }

  function onViewportClick() {
    $selectedPanelID = pane.id;
  }

  function onTabClick(tabIndex: number) {
    if (pane.tag === "pane") {
      pane.selectedComponent = tabIndex;
    }
  }

  const configuration: Writable<ConfigurationType> | null = pane.tag === "pane" ? $configurations[pane.children[pane.selectedComponent != null ? pane.selectedComponent : 0]] : null;
</script>

{#if pane.tag === "pane"}
  <!-- <Pane> -->
  <div id={pane.id} class={`wrap ${$selectedPanelID === pane.id ? "panel--selected" : ""}`} on:click={onViewportClick}>
    <ul class="tabs">
      {#each pane.children as child, index}
        <li
          id={child.toString()}
          class={"tabs__tab " + (index === pane.selectedComponent ? "tabs__tab--selected" : "")}
          draggable="true"
          on:dragstart={(e) => handleDragStart(e, child)}
          on:click={() => onTabClick(index)}
        >
          {$configuration?.name}
        </li>
      {/each}
    </ul>

    <div
      class="dropzone"
      on:mousemove={onMouseMove}
      on:drop={handleDragDrop}
      on:dragenter={onDragEnter}
      on:dragover={onDragOver}
      on:dragleave={onDragLeave}
      ondragover={"return false"}
      bind:clientWidth={dropZoneWidth}
      bind:clientHeight={dropZoneHeight}
    >
      {#if configuration !== null}<Viewport bind:configuration={$configurations[pane.children[pane.selectedComponent != null ? pane.selectedComponent : 0]]} />{/if}
      <div class={dropZoneClasses} />
    </div>
  </div>
  <!-- </Pane> -->
{:else}
  <Splitpanes id={pane.id} theme="chromoskein" horizontal={pane.tag === "horizontal"}>
    {#if pane.children.length === 0}
      <Pane>empty workspace</Pane>
    {/if}
    {#each pane.children as child}
      <Pane><svelte:self bind:root bind:pane={child} /></Pane>
    {/each}
  </Splitpanes>
{/if}

<style>
  .drop-highlight {
    background-color: var(--accent);
    position: absolute;
    pointer-events: none;
  }

  .drop-highlight--visible {
    display: block;
  }

  .drop-highlight--hidden {
    display: none;
  }

  .drop-highlight--center {
    width: 100%;
    height: 100%;
    top: 0;
    left: 0;
  }

  .drop-highlight--top {
    width: 100%;
    height: 50%;
    top: 0;
    left: 0;
  }

  .drop-highlight--right {
    width: 50%;
    height: 100%;
    top: 0;
    right: 0;
  }

  .drop-highlight--bottom {
    width: 100%;
    height: 50%;
    bottom: 0;
    left: 0;
  }

  .drop-highlight--left {
    width: 50%;
    height: 100%;
    top: 0;
    left: 0;
  }

  .wrap {
    width: 100%;
    height: 100%;
    display: flex;
    flex-direction: column;
  }

  .dropzone {
    flex-grow: 1;
    position: relative;
  }
</style>
