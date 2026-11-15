# Development Decisions

This is my record of the features and approaches I have tried, deferred, changed, or chosen not to build yet. It captures the reasoning and constraints I had at the time, not permanent rules. I can revisit a decision when the product, evidence, or available resources change.

For the motivation behind NeuroProxy, see [Vision](VISION.md). For the current implementation and outstanding work, see [Implementation](../IMPLEMENTATION.md) and [Checklist](../CHECKLIST.md).

## Browser Voice Notes

**Decision:** Removed the separate browser voice-note feature from the interface; kept browser speech input and phone voice capture.

**Why:** The voice-note control felt too similar to Start Voice and added another choice without a sufficiently distinct benefit.

**Revisit when:** I can provide a genuinely asynchronous experience: record a message, leave, and receive a useful response later, without needing to stay on a call. Existing legacy voice-note data may remain in the local database; removing the interface did not delete it.

## SMS in the Delegation Interface

**Decision:** Hid SMS as a sending option in the demo interface and kept iMessage as the messaging path. The Photon SMS number is still used for voice.

**Why:** I verified iMessage, but live SMS remained untested. Campaign registration showed a $20 charge, and the appropriate registration and recipient eligibility still needed clarification. I did not want the demo to imply that SMS was working when it had not been verified.

**Revisit when:** The campaign purpose and costs are clear, registration is approved if required, and I can send and receive a real SMS to a consenting test recipient. Voice calls on the Photon SMS number are a separate capability from SMS text delivery.

## Manual Message Signature and Automatic Reply Disclosure

**Decision:** Removed the optional manual-message signature from the current sending interface. Automatic replies instead have a required `[NeuroProxy AutoReply]` label on every message.

**Why:** The optional signature felt distracting and did not fit how I wanted ordinary user-reviewed messages to read. For an automatic reply, however, I want the recipient to know that NeuroProxy is responding. The disclosure is added by the backend and saved with the message, rather than depending on the model to remember it.

**Revisit when:** I have feedback on a clearer or more natural disclosure that still tells recipients every automatic message was generated automatically. The current AutoReply path has mock tests; real iMessage AutoReply still needs manual verification.

## AutoReply Scope

**Decision:** Make AutoReply opt-in for one contact within a saved conversation, rather than enabling it globally for a person. The current feature is experimental.

**Why:** A person can be involved in different conversations, each with different context and boundaries. A conversation-specific setting makes the authorization and the information used for a reply easier to understand. It also fits the current Graph and messaging flow.

**Revisit when:** I have reliable contact identity, clear cross-conversation context selection, user controls for the scope and duration of authorization, and evidence that a person-level setting would be useful. Test the existing mode with a consenting recipient before relying on it.

## Suggested Actions and Delegation

**Decision:** Reuse the suggested person and actions from saved conversation context in Delegation, while allowing the user to change them and generate or edit a message.

**Why:** Asking the user to reconstruct the same context manually made it harder to take the first step. Reusing reviewed context makes the workflow more accessible while leaving the user in control of a manually approved message.

**Revisit when:** Feedback shows that the defaults are frequently wrong, multiple plausible recipients need better handling, or a different presentation makes the choice clearer. AutoReply remains a separate, explicitly enabled mode.

## Contacts and Identity

**Decision:** Use locally stored contact mappings instead of importing the phone's address book. Keep explicit recipient and consent confirmation in the manual sending flow. More robust duplicate-name handling is deferred.

**Why:** The hackathon demo needed a small, understandable way to select a real recipient; full contacts integration and identity management would add complexity. A name alone is not enough to identify the intended person.

**Revisit when:** The product supports real users beyond the demo or needs device contact import. Add reliable identity disambiguation and verify that selecting or changing a contact cannot send a message to the wrong person. Any access to an external address book needs explicit user authorization.

## Live Calls and Asynchronous Voice

**Decision:** Keep the working Photon and ElevenLabs phone-call path and the browser speech interface. Treat asynchronous voice messages as a future feature.

**Why:** A call can capture context and create a reviewable Graph, but an always-live conversation can feel demanding when I only want to say something and come back later. The current bridge saves at most one Graph per call and does not yet provide full call-to-text continuity.

**Revisit when:** There is a practical, tested way to exchange voice messages asynchronously, preserve context across voice and text, and make the interaction feel low-pressure. Real phone calls remain useful and can be developed independently.

## Context Deduplication and Retrieval

**Decision:** Use lexical cosine similarity as the baseline, with optional Cloudflare embeddings for same-category reply-insight matching and local BM25 ranking for recovery. Defer a dedicated vector database.

**Why:** I wanted a smaller, clearer Graph without adding infrastructure during the hackathon. Word-based similarity is useful as a simple baseline, but it is not semantic understanding and can miss paraphrases or overlook meaningful differences.

**Revisit when:** An evaluation set shows where the current approach fails and a candidate retrieval method improves results enough to justify its privacy, cost, and operational complexity. The Cloudflare integration and quality improvement still require live verification; Chinese insight deduplication currently remains lexical. Any indexes must remain scoped appropriately and support deletion with the source conversation.

## Personalization Before Model Training

**Decision:** Plan for editable user preferences and context retrieval before training or fine-tuning a personal model. Model adaptation is a long-term experiment, not a current capability.

**Why:** Preferences and memories are easier for the user to inspect, correct, and delete than facts absorbed into model weights. A communication-style field is currently available, but the application does not automatically learn a person's style or read a personal `skills.md` file.

**Revisit when:** Users can explicitly opt in, there are enough suitable examples and a separate evaluation set, and local adaptation demonstrates a meaningful improvement over retrieval and editable preferences. Plan for protecting and deleting adapters as well as source data.

## Storage, Sandbox, and External Access

**Decision:** Continue with local SQLite for the prototype and treat stronger data protection, isolated local processing, and external integrations as future work. Do not claim that a sandbox is already providing complete privacy.

**Why:** SQLite already persists the Graph for the current single-user application. A different database alone would not provide privacy or a recovery strategy. Current analysis sends relevant context to a configured AI provider, and communication services receive data needed to deliver messages or calls.

**Revisit when:** Product requirements call for multiple users, devices, stronger isolation, or higher write concurrency. Before claiming local-only processing, design and verify the entire data path, including network access, logs, files, backups, and model artifacts. Calendar and email access should begin with explicit, revocable, minimal permissions; external actions need their own authorization.

## Agent Framework and Tools

**Decision:** Keep the current TypeScript and Mastra-based workflow, with deterministic code for authorization, state transitions, and messaging. Defer additional frameworks, MCP, and multi-agent infrastructure unless a concrete workflow needs them.

**Why:** I want to understand and demonstrate what the system actually does. AutoReply currently uses a structured model response followed by application-controlled checks and sending; it is not an autonomous tool-calling loop. Context recovery has a separate read-only Graph tool.

**Revisit when:** A well-defined capability requires dynamic tool selection or coordination, and I can test permissions, failure handling, privacy, and user control. Framework complexity should serve the user's experience and reliability.

## OMP-Inspired Recall and Long-Term Memory

**Decision:** Keep the existing Node.js Graph and add a bounded, read-only `recall_memory` tool with source links for 04. Defer a separate long-term memory store and the OMP Mnemopi package.

**Why:** The immediate need is to find relevant saved conversations and inspect the evidence behind a response. OMP's separation of recall, retention, reflection, and editing is a useful architecture reference; its Mnemopi implementation depends on Bun and OMP packages, while this application currently uses Node.js. No OMP code has been copied into this implementation.

**Revisit when:** An isolated evaluation demonstrates that Mnemopi improves retrieval enough to justify its runtime and dependency cost, and validates source attribution, conversation isolation, privacy, deletion, and retention. User-reviewed memory candidates and consolidation remain future work.
