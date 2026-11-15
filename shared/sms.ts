export const NEUROPROXY_LABEL = '— Sent with assistance from NeuroProxy';
export const DEFAULT_CUSTOM_LABEL = '✦ Written with NeuroProxy';
export const NEUROPROXY_INTRODUCTION = 'Hi, I’m NeuroProxy, helping with this message.';

export function formatImessage(body:string, introduce:boolean):string {
  const text=body.trimEnd();
  return introduce && !text.startsWith(NEUROPROXY_INTRODUCTION)
    ? `${NEUROPROXY_INTRODUCTION}\n\n${text}` : text;
}

export function validMessageLabel(label:unknown): label is string {
  return typeof label==='string' && label.length<=120;
}

export function labelRealSms(body: string, label = NEUROPROXY_LABEL): string {
  if(!validMessageLabel(label)) throw new Error('The signature must be at most 120 characters.');
  const trimmed = body.trimEnd();
  const suffix=label.trim();
  if(!suffix) return trimmed;
  return trimmed.endsWith(suffix) ? trimmed : `${trimmed}\n\n${suffix}`;
}
