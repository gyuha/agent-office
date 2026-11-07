import { officeDataJSON, officeManifestJSON } from '../generated/office';
export interface AssetSpec {
  bottomTrim?:{sourceRect:number[];destinationHeight?:number;height?:number};runtimePaddedLogicalSize?:number[]; runtimeScale?: number; file?: string; uri?: string; size?: number[]; sourceBox?: number[];
  frameW?: number; frameH?: number; frames?: number | any[]; fps?: number; loop?: boolean;
  locomotion?:{cycleDistance:number;referenceActorHeight:number;speedAtReferenceHeight?:number};
  anchor?: number[] | {x:number;y:number}; frame?: number[]; grid?: number[];
}
export interface DeskSpec {
  tableRearY?:number;actorOverlay?:any; referenceActorFrameHeight?:number; back:string;front:string;size?:number[];sourceBox?:number[];seat:number[];actorHeight:number;actorAnchor:number[];
  clearTableZone?:number[]; actorStateYOffset?:Record<string,number>;actorOffsets?:Record<string,Record<string,number[]>>;
  actorSourceClip?:Record<string,number[]>;actorClip?:number[];frontOcclusionY:number;
  nameplate:{center:number[];width:number};keyboard?:any;
}
export interface BeanbagSpec {referenceActorFrameHeight?:number;frontOcclusionRect?:number[];back:string;front:string;size:number[];seat:number[];actorHeight:number;actorAnchor:number[];actorOffset:number[];spacing:number[]}
export interface OfficeManifest {
  armOverlays?:Record<string,Record<string,string>>;armOverlayContract?:any;rearSeatContract?:any;workingHandOverlays?:Record<string,string>; furnitureProportions?:any; providerIcons?:Record<string,string>;effectPlacement?:any;
  backgroundTrim?:{wallHeight?:number;bottomTrimHeight?:number};runtimeScale?: number; layout: Record<string, any>; lead: Record<string, {foot:number[];height:number}>;
  pods:Record<string,DeskSpec>; leadDesks:Record<string,DeskSpec>; beanbags:Record<string,BeanbagSpec>; restLayout:any; keyboardAlignment:any;
  ui: any; actors?: any; effects?: any; sheets?: Record<string, AssetSpec>;
}
export const manifest: OfficeManifest = JSON.parse(officeManifestJSON);
export const assetData: Record<string, AssetSpec> = JSON.parse(officeDataJSON);
export type OfficeSprites = Record<string, {image:any;spec:AssetSpec;deskBase?:any}>;
declare const Image: any,document:any;
let cached: {sprites: OfficeSprites; spritesReady: Promise<void>} | undefined;
export function loadOfficeAssets() {
  if (cached) return cached;
  const sprites: OfficeSprites = {};
  const spritesReady = Promise.all(Object.entries(assetData).map(([key,spec]) => new Promise<void>((resolve,reject) => {
    const image = new Image();
    image.onload = () => {
      const runtimeScale=spec.runtimeScale??(spec.file?.includes('reference/provider-icons')?1:manifest.runtimeScale??1);
      sprites[key]={image,spec:{...spec,runtimeScale}};resolve();
    };
    image.onerror = () => reject(new Error(`Office asset failed: ${key}`));
    image.src=spec.uri;
  }))).then(()=>{
    if(typeof document==='undefined')return;
    // Art splits one native image into complementary alpha planes. Rejoin once,
    // before viewport resampling, so fractional split rows cannot reveal the floor.
    for(const desk of [...Object.values(manifest.pods),...Object.values(manifest.leadDesks)]){
      if(desk.tableRearY===undefined)continue;
      const back=sprites[desk.back],front=sprites[desk.front];if(!back||!front||back.deskBase)continue;
      const base=document.createElement('canvas');base.width=back.image.naturalWidth||back.image.width;base.height=back.image.naturalHeight||back.image.height;
      const ctx=base.getContext('2d');if(!ctx)continue;
      ctx.drawImage(back.image,0,0);ctx.globalCompositeOperation='lighter';ctx.drawImage(front.image,0,0);ctx.globalCompositeOperation='source-over';
      back.deskBase=base;
    }
  });
  return cached={sprites,spritesReady};
}
