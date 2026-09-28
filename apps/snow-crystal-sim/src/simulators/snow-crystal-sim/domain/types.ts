export const MODEL_VERSION = 'reiter-alpha1-xoshiro128ss-1.1-v1' as const;
export type ModelVersion = typeof MODEL_VERSION;
export type Seed128 = readonly [number, number, number, number];
export interface AxialCoord { readonly q: number; readonly r: number; }
export interface CartesianXZ { readonly x: number; readonly z: number; }
export interface NormalizedConditions { readonly temperatureC: number; readonly supersaturationPct: number; readonly x: number; readonly y: number; readonly clamped: boolean; }
export interface CreateLatticeInput { readonly radius: number; readonly seed: Seed128; readonly beta: number; readonly noiseAmplitude: number; }
export interface LatticeState { readonly radius: number; readonly waterMass: Float64Array; readonly ice: Uint8Array; readonly noise: Float64Array; readonly stepIndex: number; readonly elapsedCa: number; readonly stopped: boolean; readonly beta: number; readonly noiseAmplitude: number; readonly seed: Seed128; readonly modelVersion: ModelVersion; }
export interface Xoshiro128ssResult { readonly output: number; readonly state: Seed128; }
export interface VaporBudget { readonly mobileVapor: number; readonly depositedWater: number; readonly totalWater: number; readonly iceCellCount: number; }
export interface StepParameters { readonly beta: number; readonly gamma: number; readonly noiseAmplitude: number; readonly dtCa: number; }
export interface MassLedger { readonly beforeTotal: number; readonly afterTotal: number; readonly diffusionNet: number; readonly outOfPlaneInput: number; readonly reservoirExchange: number; readonly residual: number; }
export interface StepResult { readonly state: LatticeState; readonly ledger: MassLedger; readonly reachedEdge: boolean; }
