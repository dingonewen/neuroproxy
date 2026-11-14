# Implementation plan

NeuroProxy uses TypeScript end to end.

1. Use a single Mastra agent with explicit tools and no workspace or subagent permissions. Persist structured graph state separately; keep approval and delivery in deterministic code.
2. Use a React Flow canvas with Dagre layout and typed nodes and edges.
3. Implement persistent graph, draft, explicit approval, cancellation, idempotent send, shared reply processing and context recovery. Start with a clearly marked simulator.
4. Integrate Photon 2.0 Beta using its project-scoped API and verify webhook authentication and event schemas from official documentation. Exercise real messaging only with configured credentials, an explicitly approved message and a consenting recipient.
5. Use the browser voice prototype for speech input and spoken context recovery; verify the full demo manually. Integrate Photon phone voice separately when SIP and a voice provider are provisioned.

Photon's published [2.0 introduction](https://photon.codes/blog/introducing-photon-2.0) documents Users, Spaces and Messages and says acceptance does not imply delivery. Check the current official competition rules before submission.


Phone voice progress: a protected ElevenLabs webhook tool can save one proposed graph per call using the existing extractor, with no messaging permission. Live SIP provisioning, caller verification, phone context recovery, voice approval, and multi-turn graph updates remain outstanding.

Hackathon demo priorities and validation status: see [CHECKLIST.md](CHECKLIST.md).

## Agent workflow and technical notes

The demo follows this pipeline:

1. **Capture:** Text or a Photon phone call supplies the conversation. The phone path uses Photon SIP, ElevenLabs, and a protected webhook tool; a real call has produced a reviewable Graph. The tool currently captures once per call and does not authorize messaging.
2. **Extract:** A Mastra agent generates structured topics, people, tasks, questions, relationship context, and an optional proposed message. Structured output is schema-validated and checked for valid cross-references. Invalid model output gets one retry; an assignee that cannot be matched is left blank for review rather than guessed.
3. **Reduce repetition:** Initial generated relationship lists are limited to three items; new reply analyses compare against existing same-category insights and propose up to two new items per list. The current comparison is conservative lexical cosine, not semantic embedding. Existing Graph content is not automatically deleted.
4. **Review and persist:** The user can review and edit proposed context before saving. SQLite stores typed nodes and edges; visual-only group nodes arrange reported facts, expressed feelings and needs before interpretations, questions and suggested actions. These visual links show review order, not proven causation.
5. **Act with approval:** A suggested message becomes a draft. Contact selection and explicit approval are required before real Photon sending. Delivery acceptance is distinguished from confirmed delivery; deterministic state and idempotency safeguards handle dispatch.
6. **Continue:** A verified incoming reply can be linked to the message, analyzed using the saved conversation, and used to propose a follow-up draft. Each real send requires new approval. Context recovery reads saved Graph data.
7. **Observe:** Optional OpenTelemetry spans cover conversation, phone and reply analysis. The exporter permits only NeuroProxy's manual analysis spans and includes status, duration and allowlisted error metadata; it does not intentionally export conversation text, contacts, credentials or raw exceptions. Logfire export requires configuration and has not yet been verified live.

### Lessons and limitations

- Structured model output can be valid JSON but contain invalid person or task references. Validate cross-references and repair only unambiguous model output; keep user review and deterministic approval separate from model judgment.
- A cosine score over words is not semantic similarity. The planned embedding/BM25 work should be evaluated for paraphrases as well as meaningful differences such as negation, people, dates and boundaries.
- Automatic telemetry can expose sensitive material. Prefer allowlisted manual spans, minimal metadata and an exporter that excludes unapproved instrumentation; a code sandbox does not replace data minimization.
- Graph nodes include visual-only group headings, so fewer generated insights does not guarantee a small Graph. Existing duplicate nodes remain until explicitly edited or deleted.
- Real iMessage sending and real call-to-Graph capture have been demonstrated. Live Logfire export and a full real reply-to-follow-up workflow still need verification; do not present them as verified until tested.
