import type { AbstractOptions } from "@chromoskein/components/types";
import {
  type VolumeOptions,
  type PathlineOptions,
  type SpheresOptions,
  type ImplicitOptions,
  type AbstractSpheresOptions,
  type ConesOptions,
  type SplineOptions,
  type HedgehogOptions,
  type MatryoshkaOptions,
  defaultImplicitOptions,
  defaultPathlineOptions,
  defaultSpheresOptions,
  defaultSplineOptions,
  defaultVolumeOptions,
  defaultMatryoshkaOptions,
  defaultAbstractSpheresOptions,
  defaultConesOptions,
  defaultHedgehogOptions,
} from "@chromoskein/components/visualisations";

import InteractiveCluster from "./visalizations/InteractiveCluster.svelte";

export enum VisualisationType {
  None = "None",
  Implicit = "Implicit",
  Pathline = "Pathline",
  Spheres = "Spheres",
  Spline = "Spline",
  Volume = "Volume",
  Matryoshka = "Matryoshka",
  AbstractSpheres = "AbstractSpheres",
  Cones = "Cones",
  Hedgehog = "Hedgehog",
  Composite = "Composite",
  Test = "Test",
}

export type AllOptions = {
  type: VisualisationType;
} & ImplicitOptions &
  PathlineOptions &
  SpheresOptions &
  SplineOptions &
  VolumeOptions &
  MatryoshkaOptions &
  AbstractSpheresOptions &
  ConesOptions &
  HedgehogOptions &
  CompositeOptions &
  TestOptions;

export type CompositeOptions = {
  interactiveCluster: InteractiveCluster | null; // only for interactive visualisations
} & HedgehogOptions &
  AbstractOptions;

export type TestOptions = {
  secondaryVisualisation: VisualisationType;
} & MatryoshkaOptions &
  HedgehogOptions &
  AbstractOptions;

const defaultGenericOptions = {
  alpha: 1.0,
  radius: 0.1,
  outline: false,
  blobsAmount: 2, // this might be better somewhere else?
  timestep: 0, // this might be better somewhere else?
};

const defaultAbstractOptions = {
  showConnectors: false,
  abstractionMultiplier: 4.0,
};

const defaultCompositeOptions: Omit<CompositeOptions, keyof HedgehogOptions | keyof AbstractOptions> = {
  interactiveCluster: null,
};

const defaultTestOptions: Omit<TestOptions, keyof MatryoshkaOptions | keyof HedgehogOptions | keyof AbstractOptions> = {
  secondaryVisualisation: VisualisationType.AbstractSpheres,
};

export function defaultVisualisationOptions(type: VisualisationType): AllOptions {
  return {
    type: VisualisationType.Pathline,
    ...defaultGenericOptions,
    ...defaultAbstractOptions,
    ...defaultImplicitOptions,
    ...defaultPathlineOptions,
    ...defaultSplineOptions,
    ...defaultVolumeOptions,
    ...defaultMatryoshkaOptions,
    ...defaultAbstractSpheresOptions,
    ...defaultConesOptions,
    ...defaultHedgehogOptions,
    ...defaultCompositeOptions,
    ...defaultTestOptions,
  };
}
