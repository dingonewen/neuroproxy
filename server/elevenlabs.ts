import { ElevenLabsClient } from '@elevenlabs/elevenlabs-js';

/** Credentials are loaded server-side from the environment, never sent to the browser. */
export function elevenLabsClient() {
 if(!process.env.ELEVENLABS_API_KEY) throw new Error('ElevenLabs is not configured. Complete the ElevenLabs onboarding first.');
 return new ElevenLabsClient();
}

/** Read connection status only; creating or publishing an agent is a separate operation. */
export async function elevenLabsAgentStatus(agentId:string) {
 const agent=await elevenLabsClient().conversationalAi.agents.get(agentId);
 return {id:agent.agentId,name:agent.name};
}
