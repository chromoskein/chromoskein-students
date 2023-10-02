// increment when the current application 

import type { ConfigurationType, Dockable } from "./storage";

// can no longer correctly load previously created application states
export const APPLICATION_STATE_VERSION = 6;

export interface ApplicationState {
    configurationsMaxId: number;
    configurations: Array<ConfigurationType>,
    layout: Dockable,
    
    version?: number;
    [key: string]: unknown;
}

