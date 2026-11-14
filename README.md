# NeuroProxy

**For minds that wander, and hearts that care.**

NeuroProxy is a voice-first companion that helps neurodivergent minds remember, connect, and communicate. It turns conversations into a reviewable Cognitive Action Graph, suggests a next step, and helps the user follow through with an explicitly approved message.

The prototype is an accessibility and communication aid. It does not diagnose or treat medical conditions.

## The workflow

1. **Hear the Meaning:** Type, use browser speech recognition, or call the Photon voice number to capture a conversation. The agent extracts people, questions, tasks, relationship context, and a possible message draft.
2. **See the Bigger Picture:** Review and save the context, then explore the Graph. Choose a saved conversation, select nodes, zoom, and export the Graph as a PDF. The review-order headings do not establish causation.
3. **Make Things Happen:** Confirm a contact and review or edit a draft. A real iMessage or SMS is sent only after explicit approval and recipient consent. Incoming replies can be linked and analyzed to suggest a follow-up.
4. **Find Your Way Back:** Ask questions about saved context; supported browsers can also read answers aloud.

Reported facts, expressed feelings and needs, and possible interpretations are kept distinct. The user can correct suggestions. Generated relationship insights are limited and compared with existing same-category entries using conservative **lexical** cosine similarity; this is not semantic embedding or vector search.

## What has been verified

- A real Photon iMessage was sent to the developer's test iPhone, and a reply was received through the configured webhook.
- A real inbound phone call through Photon and ElevenLabs produced a reviewable Graph on the web.
- Simulated messages and automated mock tests exercise the approval and reply pipelines without contacting a real person.

The complete live message → reply → analyzed follow-up workflow and the latest Graph PDF export still need a final end-to-end check. Live SMS sending has not been verified. Photon accepting a request does not confirm delivery. The desktop interface has been redesigned; the phone layout still needs visual testing and refinement. See [CHECKLIST.md](CHECKLIST.md) for demo status and [IMPLEMENTATION.md](IMPLEMENTATION.md) for technical notes.

## Run locally

Requirements: Node.js 24 or newer and npm.

```bash
npm install
cp .env.example .env
# If ElevenLabs onboarding has not already created it:
touch .env.local
npm run dev
```

In a second terminal:

```bash
npm run dev:web
```

Fill in `.env` locally with the model provider credentials and any Photon configuration you need. Never commit secrets or put them in `.env.example`. The backend loads `.env` and `.env.local` at startup; restart it after changing configuration or backend code. Open the Vite URL printed by the frontend command. The backend listens on localhost; SQLite state defaults to `neuroproxy.db` and can be redirected with `NEUROPROXY_DB`.

```bash
npm test
npm run build
```

## Messaging and contacts

Add a contact with an E.164 number or iMessage email, then explicitly confirm the intended contact for the person in the conversation. Contacts are stored locally; the app does not import the phone's address book. A pending draft offers simulation, SMS, or iMessage review. Customize or remove the message signature, verify the exact recipient and text, and explicitly approve each real send. Never contact an unconsenting recipient.

For a Photon iMessage shared line, the recipient must first be assigned a shared-line number and send a message to it; NeuroProxy can then use the signed inbound event to locate the direct conversation. A shared-line assignment does not itself imply consent. See [Photon's Beta iMessage guide](https://photon.codes/docs/beta/get-started/imessage).

Configure `PHOTON_API_KEY`, `PHOTON_PROJECT_ID`, and `PHOTON_WEBHOOK_SECRET` in `.env`. For SMS, also configure `PHOTON_SMS_NUMBER` in E.164 format. `npm run check:photon` performs a read-only project access check; it does not verify delivery or webhook configuration.

Subscribe the Photon destination to `message.received` and route it to `POST /api/webhooks/photon` over HTTPS. The backend verifies the raw-body signature and timestamp. Matched replies are linked; uncertain matches require confirmation, and other replies can be associated manually. Duplicate webhook deliveries are ignored. If a send outcome is unknown, check Photon before attempting another send.

Select a saved conversation and use **Delete** to remove its local graph, drafts, and messaging records. Messages already sent remain in Photon and on recipients' devices. Hashed event identifiers remain to prevent deleted incoming events from reappearing on webhook replay. Deleting a conversation leaves reusable contacts intact.

## Voice

**Browser:** On a supported browser, choose a language and turn on the voice switch in Hear the Meaning or Find Your Way Back. Allow microphone access, speak, and turn the switch off before reviewing the recognized text. Browser speech recognition may send audio to the browser's speech provider. Voice input does not send or approve messages.

**Phone:** Photon routes an inbound call on an eligible SMS number to an ElevenLabs agent over SIP. With the caller's permission, the agent invokes the protected `POST /api/voice/capture` tool, which creates a proposed Graph and may create a draft. The web app displays the result for review; the phone tool cannot send or approve messages. A shared iMessage line cannot receive phone calls.

The current bridge saves at most one Graph per call. Its bearer token authenticates the ElevenLabs tool, **not the caller**. Phone access to stored context, voice approval, and multiple updates in one call are not implemented. A live call has produced a Graph; recheck spoken output and captured details before the demo.

To configure the bridge:

1. Set a unique random `VOICE_TOOL_SECRET` of at least 32 characters in `.env` and restart the backend. Store the same value as an ElevenLabs secret; do not put it in a prompt, URL, or source control.
2. Configure a Photon SMS number and ElevenLabs agent for inbound SIP using [Photon's voice guide](https://photon.codes/docs/beta/get-started/voice).
3. Expose only `/api/voice/capture` and `/api/webhooks/photon` through HTTPS. **Do not expose the rest of `/api`**: the local API has no general authentication.
4. Configure an ElevenLabs webhook tool to `POST` JSON to the voice capture route, with an `Authorization: Bearer ...` header supplied from the provider's secret store. Provide `conversationId` bound to `system__conversation_id` and a concise `text` parameter containing the caller-approved account, up to 8,000 characters. See [ElevenLabs webhook tools](https://elevenlabs.io/docs/eleven-agents/customization/tools/webhook-tools).
5. Have the agent ask permission before capturing, summarize only the tool's returned result, and make clear that the Graph and draft need review. Do not claim a message was sent.

## Privacy and observability

Analysis, draft generation, reply analysis, and recovery send the relevant entered or saved context to the configured AI provider. The voice provider receives call audio and the account submitted to its tool. Data is stored locally in SQLite; deleting a conversation removes its associated local graph and message records as described above. Use synthetic data in demos.

OpenTelemetry analysis tracing is optional. Set `LOGFIRE_TOKEN` in the ignored `.env` file and, if needed, `LOGFIRE_BASE_URL` for the correct region. Restart the backend after changes. With no token, no traces are exported. The application exports only its allowlisted manual analysis spans, with status, timing, and safe diagnostic categories; it does not intentionally include conversation text, contact details, credentials, or raw provider errors. Live Logfire export still needs verification.

The Coral theme and third-party notices are documented in [THIRD_PARTY_NOTICES.md](THIRD_PARTY_NOTICES.md).
