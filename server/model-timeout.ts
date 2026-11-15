export class ModelTimeoutError extends Error {
 constructor(){super('The model request timed out.');this.name='ModelTimeoutError';}
}

/** Bound model work even if a provider ignores cancellation; abort cooperative requests too. */
export async function withModelTimeout<T>(run:(signal:AbortSignal)=>Promise<T>,timeoutMs=90000):Promise<T> {
 const controller=new AbortController();
 let timer:ReturnType<typeof setTimeout>|undefined;
 const timeout=new Promise<never>((_resolve,reject)=>{
  timer=setTimeout(()=>{const error=new ModelTimeoutError();reject(error);controller.abort(error);},timeoutMs);
 });
 try{return await Promise.race([Promise.resolve().then(()=>run(controller.signal)),timeout]);}
 finally{clearTimeout(timer);}
}
