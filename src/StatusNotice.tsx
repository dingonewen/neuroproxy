import { useEffect, useState } from 'react';

/** Confirmation messages expire; errors and in-progress messages stay visible. */
export function StatusNotice({message,className,autoDismiss=true}:{message:string;className?:string;autoDismiss?:boolean}) {
 const [dismissedMessage,setDismissedMessage]=useState<string|null>(null);
 useEffect(()=>{
  setDismissedMessage(null);
  if(!autoDismiss)return;
  const timer=setTimeout(()=>setDismissedMessage(message),10_000);
  return()=>clearTimeout(timer);
 },[message,autoDismiss]);
 if(autoDismiss && dismissedMessage===message)return null;
 return <p className={className} role="status">{message}</p>;
}
