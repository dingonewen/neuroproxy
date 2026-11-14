export const NEUROPROXY_LABEL = '— Sent with assistance from NeuroProxy';

export function labelRealSms(body: string): string {
  const trimmed = body.trimEnd();
  return trimmed.endsWith(NEUROPROXY_LABEL) ? trimmed : `${trimmed}\n\n${NEUROPROXY_LABEL}`;
}
