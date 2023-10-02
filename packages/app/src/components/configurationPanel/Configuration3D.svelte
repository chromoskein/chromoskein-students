<script lang="ts">
  // import "../../styles/global.css";
  // import "../../styles/tabs.css";
  // import "../../styles/forms.css";
  // import "./panel.css";

  import type { Writable } from "svelte/store";
  import type { Configuration3D } from "src/storage/storage";

  // import PlusIcon from "@fluentui/svg-icons/icons/add_16_regular.svg?component";
  // import DeleteIcon from "@fluentui/svg-icons/icons/delete_16_regular.svg?component";
  // import SphereIcon from "@fluentui/svg-icons/icons/circle_20_regular.svg?component";
  // import CylinderIcon from "@fluentui/svg-icons/icons/database_20_regular.svg?component";
  // import MoleculeIcon from "@fluentui/svg-icons/icons/molecule_20_regular.svg?component";
  // import DiversityIcon from "@fluentui/svg-icons/icons/diversity_20_regular.svg?component";
  // import ChevronRight from "@fluentui/svg-icons/icons/chevron_right_16_regular.svg?component";
  // import ChevronDown from "@fluentui/svg-icons/icons/chevron_down_16_regular.svg?component";

  // import ListView from "../elements/ListView.svelte";

  import { TextInput } from "carbon-components-svelte";
  import { Accordion, AccordionItem } from "carbon-components-svelte";
  import { Tabs, Tab, TabContent } from "carbon-components-svelte";
  import { TreeView } from "carbon-components-svelte";

  // Props
  export let configuration: Writable<Configuration3D>;

  let dataSectionVisible = true;
  let selectionsSectionVisible = true;
  let cutawaysSectionVisible = true;
  let tooltipsSectionVisible = true;

  const dataList = [
    { text: "Chromatin 1" },
    { text: "Chromatin 2" },
    { text: "Chromatin 3" },
    { text: "Chromatin 4" },
  ];
  const selectionsList = [
    { text: "Selection 1" },
    { text: "Selection 2" },
    { text: "Selection 3" },
    { text: "Selection 4" },
  ];
  const cutawaysList = [
    { text: "Cutaway 1" },
    { text: "Cutaway 2" },
    { text: "Cutaway 3" },
    { text: "Cutaway 4" },
  ];
  const tooltipsList = [
    { text: "Tooltip 1" },
    { text: "Tooltip 2" },
    { text: "Tooltip 3" },
    { text: "Tooltip 4" },
  ];

  let activeId = "";
  let selectedIds = [];
  let children = [
    { id: 0, text: "AI / Machine learning" },
    {
      id: 1,
      text: "Analytics",
      children: [
        {
          id: 2,
          text: "IBM Analytics Engine",
          children: [
            { id: 3, text: "Apache Spark" },
            { id: 4, text: "Hadoop" },
          ],
        },
        { id: 5, text: "IBM Cloud SQL Query" },
        { id: 6, text: "IBM Db2 Warehouse on Cloud" },
      ],
    },
    {
      id: 7,
      text: "Blockchain",
      children: [{ id: 8, text: "IBM Blockchain Platform" }],
    },
    {
      id: 9,
      text: "Databases",
      children: [
        { id: 10, text: "IBM Cloud Databases for Elasticsearch" },
        { id: 11, text: "IBM Cloud Databases for Enterprise DB" },
        { id: 12, text: "IBM Cloud Databases for MongoDB" },
        { id: 13, text: "IBM Cloud Databases for PostgreSQL" },
      ],
    },
    {
      id: 14,
      text: "Integration",
      disabled: true,
      children: [{ id: 15, text: "IBM API Connect", disabled: true }],
    },
  ];
</script>

<!-- <div>
  <ul class="tabs">
    <li class="tabs__tab">Data</li>
    <li class="tabs__tab tabs__tab--selected">Viewport</li>
  </ul>

  <div class="section">
    <div class="row">
      <label for="name">Name</label>
      <input type="text" id="name" name="name" bind:value={$configuration.name} />
    </div>
  </div>

  <div class="section">
    <header>
      <div class="icon"
        on:click={() => {
          dataSectionVisible = !dataSectionVisible;
        }}
      >
      {#if dataSectionVisible}<ChevronDown fill="white" />{:else}<ChevronRight fill="white" />{/if}
      </div>
      <h1>Data</h1>
      <div class="icon"><PlusIcon fill="white" /></div>
    </header>

    {#if dataSectionVisible}
      <ListView items={dataList} />

      <div class="row">
        <label>Representation</label>
        <ul class="toggle-selection">
          <li class="toggle-selection__selection">
            <span class="toggle-selection__selection__icon"><SphereIcon fill="white" /></span>
            <span>Spherical</span>
          </li>
          <li class="toggle-selection__selection">
            <span class="toggle-selection__selection__icon"><CylinderIcon fill="white" /></span>
            <span>Worm</span>
          </li>
          <li class="toggle-selection__selection">
            <span class="toggle-selection__selection__icon"><MoleculeIcon fill="white" /></span>
            <span>Ball & Stick</span>
          </li>
          <li class="toggle-selection__selection toggle-selection__selection--selected">
            <span class="toggle-selection__selection__icon"><DiversityIcon fill="white" /></span>
            <span>Abstract</span>
          </li>
        </ul>
      </div>

      <div class="row">
        <label>Color by</label>
      </div>
    {/if}
  </div>

  <div class="section">
    <header>
      <div class="icon"
        on:click={() => {
          selectionsSectionVisible = !selectionsSectionVisible;
        }}
      >
      {#if selectionsSectionVisible}<ChevronDown fill="white" />{:else}<ChevronRight fill="white" />{/if}
      </div>
      <h1>Selections</h1>
      <div class="icon"><PlusIcon fill="white" /></div>
    </header>

    {#if selectionsSectionVisible}
    <ListView items={selectionsList} />
    {/if}
  </div>

  <div class="section">
    <header>
      <div class="icon"
        on:click={() => {
          cutawaysSectionVisible = !cutawaysSectionVisible;
        }}
      >
      {#if cutawaysSectionVisible}<ChevronDown fill="white" />{:else}<ChevronRight fill="white" />{/if}
      </div>
      <h1>Cutaways</h1>
      <div class="icon"><PlusIcon fill="white" /></div>
    </header>

    {#if cutawaysSectionVisible}
      <ListView items={cutawaysList} />

      <div class="row">
        <label>Type</label>
        <ul class="toggle-selection">
          <li class="toggle-selection__selection toggle-selection__selection--selected">Plane</li>
          <li class="toggle-selection__selection">Sphere</li>
        </ul>
      </div>

      <div class="row">
        <label>Axis</label>
        <ul class="toggle-selection">
          <li class="toggle-selection__selection">X</li>
          <li class="toggle-selection__selection toggle-selection__selection--selected">Y</li>
          <li class="toggle-selection__selection">Z</li>
          <li class="toggle-selection__selection">User's Camera</li>
        </ul>
      </div>
    {/if}
  </div>

  <div class="section">
    <header>
      <div class="icon"
        on:click={() => {
          tooltipsSectionVisible = !tooltipsSectionVisible;
        }}
      >
      {#if tooltipsSectionVisible}<ChevronDown fill="white" />{:else}<ChevronRight fill="white" />{/if}
      </div>
      <h1>Tooltips</h1>
      <div class="icon"><PlusIcon fill="white" /></div>
    </header>

    {#if tooltipsSectionVisible}<ListView items={tooltipsList} />{/if}
  </div>
</div> -->

<Tabs type="container" autoWidth={true}>
  <Tab label="Data" />
  <Tab label="Viewport" />
  <svelte:fragment slot="content">
    <TabContent>
      <Accordion size="sm">
        <AccordionItem title="Info">
          <TextInput
            inline
            labelText="Viewport name"
            placeholder="Enter viewport name..."
            bind:value={$configuration.name}
            size="sm"
          />
        </AccordionItem>
        <AccordionItem title="Data">
          <TreeView
            {children}
            bind:activeId
            bind:selectedIds
            on:select={({ detail }) => console.log("select", detail)}
            on:toggle={({ detail }) => console.log("toggle", detail)}
            on:focus={({ detail }) => console.log("focus", detail)}
            size="compact"
          />
        </AccordionItem>
        <AccordionItem title="Selections" />
        <AccordionItem title="Tooltips" />
      </Accordion>
    </TabContent>
    <TabContent>Content 2</TabContent>
  </svelte:fragment>
</Tabs>

<style>
	:global(.bx--tab-content) {
		padding: 0px;
	}

  :global(.bx--accordion__content) {
    padding-right: 16px;
  }

  :global(.bx--accordion__content > label) {
    display: none;
  }
</style>
