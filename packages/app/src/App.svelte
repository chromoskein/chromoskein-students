<script lang="ts">
  import { get, type Writable } from "svelte/store";

  import "carbon-components-svelte/css/g90.css";
  import {
    Header,
    HeaderNav,
    HeaderNavItem,
    HeaderNavMenu,
    Content,
    Modal,
    HeaderUtilities,
    HeaderGlobalAction,
    LocalStorage,
  } from "carbon-components-svelte";

  import SettingsAdjust from "carbon-icons-svelte/lib/SettingsAdjust.svelte";
  import UserAvatarFilledAlt from "carbon-icons-svelte/lib/UserAvatarFilledAlt.svelte";

  import Configuration from "./components/configurationPanel/Configuration.svelte";
  import DockablePanels from "./components/dockablePanels/DockablePanels.svelte";
  import {
    configurations,
    selectedPanelID,
    configurationMaxID,
    mainPaneID,
    layout,
    selectedConfigurationIndex,
  } from "./storage";
  import { v4 as uuidv4 } from "uuid";

  import { writable } from "svelte/store";
  import { onMount, setContext } from "svelte";

  import { GraphicsLibrary } from "lib-graphics";
  import { findPane } from "./components/dockablePanels";
  import { Pane, Splitpanes } from "svelte-splitpanes";
  import { Workspace } from "carbon-icons-svelte";
  import { saveToBrowser } from "./storage";

  let isSideNavOpen = writable(false);
  let isOpen1 = writable(false);
  let isOpen2 = writable(false);

  const adapter: Writable<GPUAdapter | null> = writable(null);
  const device: Writable<GPUDevice | null> = writable(null);
  const graphicsLibrary: Writable<GraphicsLibrary | null> = writable(null);

  setContext("adapter", adapter);
  setContext("device", device);
  setContext("graphicsLibrary", graphicsLibrary);

  async function getGPU() {
    $adapter = await navigator.gpu.requestAdapter();

    if ($adapter) {
      $device = await $adapter.requestDevice();
      $graphicsLibrary = new GraphicsLibrary($adapter, $device);
    }
  }

  function onCanvasAdd(event) {
    const newViewportID: number = $configurationMaxID++;
    $configurations = [
      ...$configurations,
      writable({
        name: "Unnamed",
        id: newViewportID,

        tag: "3D",

        offsetX: 0.0,
        offsetY: 0.0,
        radius: 0.1,
      }),
    ];

    if ($selectedPanelID === mainPaneID && $layout.children.length === 0) {
      const newPanelID = uuidv4();

      $layout.children = [
        {
          tag: "pane",

          id: newPanelID,
          size: 100,

          selectedComponent: 0,
          children: [newViewportID],
        },
      ];
      $selectedPanelID = newPanelID;
    } else if ($selectedPanelID) {
      const selectedPane = findPane($layout, $selectedPanelID);

      if (selectedPane?.tag === "pane") {
        selectedPane.children = [...selectedPane.children, newViewportID];
      }
    }

    $layout = $layout;
  }

  onMount(async () => {
    // await loadFromBrowser();
    await getGPU();
  });

  function fuck() {
    $isOpen2 = !$isOpen2;
  }

  const modalOpen = writable(false);

  function saveToLocalStorage() {
    saveToBrowser({
      configurationsMaxId: $configurationMaxID,
      configurations: $configurations.map((c) => get(c)),
      layout: $layout,
    });
  }
</script>

<Header company="VisitLab" platformName="ChromoSkein">
  <!-- <svelte:fragment slot="skip-to-content">
    <SkipToContent />
  </svelte:fragment> -->

  <HeaderNav>
    <HeaderNavMenu text="Workspace">
      <HeaderNavItem text="Save to cache" on:click={saveToLocalStorage} />
      <HeaderNavItem text="Clear cache" />
      <HeaderNavItem text="Save to file" />
      <HeaderNavItem text="Load from file" />
    </HeaderNavMenu>
    <HeaderNavMenu text="Add Viewport">
      <HeaderNavItem text="3D Viewport" on:click={onCanvasAdd} />
      <HeaderNavItem text="Track Viewport" />
    </HeaderNavMenu>
    <HeaderNavMenu text="Add Data">
      <HeaderNavItem text="3D Model" on:click={() => ($modalOpen = true)} />
      <HeaderNavItem text="Genomic Data" />
    </HeaderNavMenu>
  </HeaderNav>

  <HeaderUtilities>
    <HeaderGlobalAction
      aria-label="Settings"
      icon={SettingsAdjust}
      on:click={fuck}
    />
  </HeaderUtilities>
</Header>

<Content>
  <div class="splitPanesArea">
    <Splitpanes theme="chromoskein" horizontal={false}>
      <Pane><DockablePanels bind:root={$layout} bind:pane={$layout} /></Pane>
      {#if $isOpen2}
        <Pane class="configuration-panel">
          {#if $selectedConfigurationIndex !== null}
            <Configuration
              bind:configuraton={$configurations[$selectedConfigurationIndex]}
            />
          {/if}
        </Pane>
      {/if}
    </Splitpanes>
  </div>
</Content>

<Modal
  bind:open={$modalOpen}
  modalHeading="Create database"
  primaryButtonText="Confirm"
  secondaryButtonText="Cancel"
  on:click:button--secondary={() => ($modalOpen = false)}
  on:open
  on:close
  on:submit
>
  <p>Create a new Cloudant database in the US South region.</p>
</Modal>

<style global>
  .topPaneArea {
    height: 40px;
    color: white;
    background: rgb(24, 24, 24);
    border-bottom: 1px solid rgb(90, 90, 90);
  }

  .splitPanesArea {
    height: calc(100vh - 3rem);
  }

  body {
    width: 100vw !important;
    height: 100vh !important;
    box-sizing: border-box !important;
    margin: 0px !important;
    padding: 0px !important;
  }

  :global(.bx--content) {
    margin: 0px !important;
    padding: 3rem 0px 0px 0px !important;
    height: calc(100vh - 3rem) !important;
    box-sizing: border-box !important;
  }
</style>
