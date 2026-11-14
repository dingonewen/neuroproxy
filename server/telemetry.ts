import { trace, SpanStatusCode } from '@opentelemetry/api';
import { NodeSDK } from '@opentelemetry/sdk-node';
import { OTLPTraceExporter } from '@opentelemetry/exporter-trace-otlp-http';
import { describeAnalysisError, safeValidationDetails } from './analysis-error.ts';

// Explicit spans only: no automatic HTTP, prompt, response, exception, or header capture.
export function startTelemetry() {
 const token=process.env.LOGFIRE_TOKEN?.trim();if(!token)return null;
 const base=process.env.LOGFIRE_BASE_URL?.trim() || 'https://logfire-api.pydantic.dev';
 const url=new URL('/v1/traces',base);
 if(url.protocol!=='https:')throw new Error('Logfire requires an HTTPS endpoint.');
 const exporter=new OTLPTraceExporter({url:url.toString(),headers:{Authorization:token}});
 // Libraries may create spans through the global provider. Never export them implicitly.
 const traceExporter={
  export(spans:Parameters<typeof exporter.export>[0],callback:Parameters<typeof exporter.export>[1]){const permitted=spans.filter(span=>span.instrumentationScope.name==='neuroproxy' && ['conversation_analysis','reply_analysis','voice_analysis'].includes(span.name));if(permitted.length)exporter.export(permitted,callback);else callback({code:0});},
  shutdown:()=>exporter.shutdown(),
  forceFlush:()=>exporter.forceFlush(),
 };
 const sdk=new NodeSDK({serviceName:'neuroproxy',traceExporter});
 sdk.start();return sdk;
}
export async function traceAnalysis<T>(name:'conversation_analysis'|'reply_analysis'|'voice_analysis',fn:()=>Promise<T>):Promise<T> {
 return trace.getTracer('neuroproxy').startActiveSpan(name,async span=>{
  try{const result=await fn();span.setStatus({code:SpanStatusCode.OK});return result;}
  catch(error){const diagnostic=describeAnalysisError(error);span.setAttribute('analysis.error_category',diagnostic.kind);if(diagnostic.kind==='invalid_output')span.setAttribute('analysis.validation',safeValidationDetails(error));span.setStatus({code:SpanStatusCode.ERROR});throw error;}
  finally{span.end();}
 });
}
