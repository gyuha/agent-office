import { officeDataJSON, officeManifestJSON } from '../generated/office';
export interface AssetSpec {
  file?: string; uri?: string; size?: number[]; sourceBox?: number[];
  frameW?: number; frameH?: number; frames?: number | any[]; fps?: number; loop?: boolean;
  anchor?: number[] | {x:number;y:number}; frame?: number[]; grid?: number[];
}
export interface OfficeManifest {
  layout: Record<string, any>; lead: Record<string, {foot:number[];height:number}>;
  ui: any; actors?: any; effects?: any; sheets?: Record<string, AssetSpec>;
}
export const manifest: OfficeManifest = JSON.parse(officeManifestJSON);
export const assetData: Record<string, AssetSpec> = JSON.parse(officeDataJSON);
export type OfficeSprites = Record<string, {image:any;spec:AssetSpec}>;
declare const Image: any;
let cached: {sprites: OfficeSprites; spritesReady: Promise<void>} | undefined;
export function loadOfficeAssets() {
  if (cached) return cached;
  const sprites: OfficeSprites = {};
  const spritesReady = Promise.all(Object.entries(assetData).map(([key,spec]) => new Promise<void>((resolve,reject) => {
    const image = new Image();
    image.onload = () => {sprites[key]={image,spec};resolve();};
    image.onerror = () => reject(new Error(`Office asset failed: ${key}`));
    image.src=spec.uri;
  }))).then(()=>undefined);
  return cached={sprites,spritesReady};
}
