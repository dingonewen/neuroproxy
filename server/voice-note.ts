export type VoiceTranscriber = (audio:Buffer, mime:string) => Promise<string>;

// Audio is held in memory only and sent directly to the configured provider.
export const transcribeVoiceNote:VoiceTranscriber = async (audio,mime) => {
  const key=process.env.ELEVENLABS_API_KEY;
  if(!key) throw new Error('Speech transcription is not configured.');
  const form=new FormData();
  form.append('model_id','scribe_v2');
  form.append('file',new Blob([new Uint8Array(audio)],{type:mime}),`voice-note.${mime === 'audio/mp4' ? 'mp4' : 'webm'}`);
  const response=await fetch('https://api.elevenlabs.io/v1/speech-to-text',{method:'POST',headers:{'xi-api-key':key},body:form,signal:AbortSignal.timeout(120000)});
  if(!response.ok) throw new Error('Speech transcription failed.');
  const data=await response.json() as {text?:unknown};
  if(typeof data.text!=='string'||!data.text.trim()||data.text.length>8000) throw new Error('Invalid transcript.');
  return data.text.trim();
};
