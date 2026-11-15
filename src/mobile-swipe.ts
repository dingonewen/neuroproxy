export const mobileStages=['understand','visualize','delegate','reconnect'] as const;
export type MobileStage=typeof mobileStages[number];

export function swipeStage(stage:MobileStage,dx:number,dy:number,elapsedMs:number):MobileStage {
 if(Math.abs(dx)<30 || Math.abs(dx)<=Math.abs(dy)*1.25)return stage;
 if(Math.abs(dx)<72 && !(Math.abs(dx)>=40 && elapsedMs>0 && Math.abs(dx)/elapsedMs>0.45))return stage;
 const index=mobileStages.indexOf(stage)+(dx<0?1:-1);
 return mobileStages[Math.max(0,Math.min(mobileStages.length-1,index))];
}
