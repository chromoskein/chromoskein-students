import { derived, get, writable } from "svelte/store";
import type { Writable } from "svelte/store";
import { v4 as uuidv4 } from "uuid";
import { findPane } from "../components/dockablePanels";

export type Configuration2D = {
    tag: "2D";
    
    name: string;
    id: number;

    zoom: number;
};

export type Configuration3D = {
    tag: "3D";

    name: string;
    id: number;

    offsetX: number;
    offsetY: number;

    radius: number;
};

export type ConfigurationType = Configuration2D | Configuration3D;

export type Dockable = DockablePane | DockableSplit;

export type DockablePane = {
    tag: 'pane';

    id: string;
    size: number;

    selectedComponent: number | null;
    children: number[];
}

export type DockableSplit = {
    tag: 'horizontal' | 'vertical';

    id: string;
    size: number;

    children: Dockable[];
}

export const mainPaneID = uuidv4();

export const configurationMaxID: Writable<number> = writable(0);
export const configurations: Writable<Array<Writable<ConfigurationType>>> = writable([]);
export const layout: Writable<Dockable> = writable({
    tag: "vertical",

    id: mainPaneID,
    size: 100,

    children: [],
});

export const selectedPanelID: Writable<string | null> = writable(mainPaneID);

export const selectedConfigurationIndex = derived([configurations, layout, selectedPanelID], ([$configurations, $layout, $selectedPanelID]) => {
    if (!$selectedPanelID) {
        return null;
    }

    const pane = findPane($layout, $selectedPanelID);

    if (pane?.tag === "pane" && pane?.selectedComponent != null) {
        const selectedConfigurationID = pane.children[pane.selectedComponent];

        const selectedConfigurationSearch = $configurations.findIndex((configuration) => get(configuration).id === selectedConfigurationID);

        if (selectedConfigurationSearch >= 0) {
            return selectedConfigurationSearch;
        }
    }

    return null;

});

export const adapter = writable();
export const device = writable();
export const graphicLibrary = writable();