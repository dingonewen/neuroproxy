export const NEUROPROXY_LABEL = '— Sent with assistance from NeuroProxy';
export const DEFAULT_CUSTOM_LABEL = '— via NeuroProxy';

export function validMessageLabel(label:unknown): label is string {
  return typeof label==='string' && label.trim().length>0 && label.length<=120 && /neuroproxy/i.test(label);
}

export function labelRealSms(body: string, label = NEUROPROXY_LABEL): string {
  if(!validMessageLabel(label)) throw new Error('The label must include NeuroProxy and be at most 120 characters.');
  const trimmed = body.trimEnd();
  const suffix=label.trim();
  return trimmed.endsWith(suffix) ? trimmed : `${trimmed}\n\n${suffix}`;
}
