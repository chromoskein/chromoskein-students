import { writable } from "svelte/store";
import type { Writable } from "svelte/store";

export type Configuration3D = {
    tag: "3D";

    name: string;
    id: number;

    offsetX: number;
    offsetY: number;

    radius: number;
};

// export const configurations: Writable<Array<Writable<ConfigurationType>>> = writable([]);
export const configurations: Writable<Configuration3D> = writable({
    tag: "3D",
    name: "Untitled 3D",
    id: 0,
    offsetX: 0,
    offsetY: 0,
    radius: 0.1,
});