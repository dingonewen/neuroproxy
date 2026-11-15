# NeuroProxy Hackathon Checklist

Goal: deliver one reliable end-to-end demo for the Photon and Amazon sponsor awards and the Healthcare track. Checked items have been demonstrated or configured; unchecked items still require implementation or verification.

## Time Budget and Priority

Plan for **10 hours of development** followed by **2 protected hours for debugging and demo preparation**. Times are working-time estimates, not guarantees. Start final preparation even if optional work remains.

| Priority | Development focus | Budget | Exit condition |
| --- | --- | --- | --- |
| P0 | Phone voice → Graph | 2 h | A real call produces a reviewable Graph and a short spoken response. |
| P0 | Approved message → reply → follow-up | 1.5 h | One real iMessage and reply are associated with the same Graph; a follow-up draft requires approval. |
| P0 | LEGO-inspired UI redesign | 2.5 h | The main demo screens and Graph have a cohesive, distinctive visual style and remain readable. |
| P0 | Reliability and usability | 1.5 h | Fix blocking failures, preserve state, and keep the main flow understandable. |
| P1 | Agent reasoning and adaptation | 1 h | Demonstrate one context-aware next action based on a reviewed edit or confirmed reply. |
| P1 | Semantic memory and hybrid retrieval | Time permitting, after P0 | Evaluate and, if feasible, demonstrate more accurate conversation-scoped deduplication and retrieval. |
| P0 | Photon outbound voice | 0.75 h | Configure the Photon–ElevenLabs SIP route and verify an outbound call to the developer's own phone. |
| P0 | Voice-to-text continuity | Time permitting within P0 | Demonstrate verified call context carried into a reviewable message without claiming unsupported memory. |
| P1 | Healthcare positioning and submission materials | 0.75 h | Write the use case, known limits, documentation, and required submission details. |
| P0 | Final debugging and demo preparation | 2 h | Run the full scenario, rehearse, record a backup, and submit on time. |

**Final two hours:** reserve 45 minutes for an end-to-end run and blocking fixes, 30 minutes to rehearse the two-minute pitch, 30 minutes to record or verify a backup, and 15 minutes for submission checks. Adapt the split if the official deadline is sooner.

**Cut order:** defer asynchronous voice messages, advanced memory or multi-agent work, and visual details outside the main demo flow. Never cut recipient verification or explicit approval for real messages.

The semantic memory work below is a P1 stretch goal and is not included in the original 10-hour estimates. Protect P0 and the final two hours; adjust the budget if pursuing it.

## P0 — End-to-End Demo (All Three Tracks)

- [x] Analyze a conversation and produce a reviewable Cognitive Action Graph and message draft.
- [x] Send a real Photon iMessage to the test iPhone.
- [x] Connect an inbound call to the Photon SMS number and reach the ElevenLabs voice agent.
- [x] Verify that a real phone call can create a Graph on the web.
- [ ] Check the generated people, questions, suggested action, and any draft against the spoken input.
- [ ] Verify a short, low-pressure voice response that does not require the user to keep answering.
- [ ] Select and verify a contact, edit the draft, and explicitly approve a real message; verify no external message is sent without approval.
- [x] Complete the end-to-end delegation workflow, including receiving and analyzing a reply and creating a follow-up draft in the same Graph (developer verified).
- [ ] Verify persistence after restart, duplicate webhook handling, and clear labels for simulated versus real messages.
- [x] Manually test a conversation-scoped AutoReply through real iMessage to the developer's own iPhone; the developer confirmed that the response addressed the incoming message.
- [ ] Separately verify the AutoReply off switch, opt-out behavior, and message disclosure in a real iMessage test; disable AutoReply after testing. These cases have mock coverage but were not confirmed in the successful live test.
- [ ] Record a backup demo and clearly identify live, simulated, and unverified behavior.

## Deferred — Real SMS Setup and Verification

The developer deferred campaign registration after the Photon dashboard showed a $20 charge. Use the verified iMessage channel for the demo; do not claim live SMS delivery.

- [ ] Ask Photon which SMS campaign purpose matches user-approved personal messages and whether a test-only path is available for the developer's own phone.
- [ ] Confirm how recipient consent and STOP opt-outs are handled, including whether Photon blocks subsequent sends; implement any required handling before claiming it works.
- [ ] Register the appropriate campaign truthfully, link the SMS number, and verify approval and recipient eligibility with Photon.
- [ ] Display actionable Photon SMS rejection details without mislabeling a definitive rejection as an unknown send outcome.
- [ ] Test a real SMS to the developer's own phone and verify receipt and a reply through the webhook; test STOP handling when supported.

## P0 — Desktop UI Redesign (BoldKit Coral)

- [x] Establish a cohesive BoldKit Coral visual language with building-block forms, Outfit Variable typography, Lucide icons, and consistent controls.
- [x] Apply the desktop visual system to voice input, conversation review, Graph, delegation, and context recovery; the developer has reviewed the design.
- [x] Review the mobile layout, swipe navigation, and colored section tabs (developer reviewed).
- [ ] Validate information hierarchy, text contrast, readable type, and keyboard access.
- [ ] Preserve the prominence of explicit approval, real-message warnings, and simulated versus real states.
- [x] Verify Graph PDF export contains the expected content (developer verified).
- [ ] Improve the PDF layout if time permits; test the redesigned flow and voice controls on the presentation laptop and phone.

## P0 — Sponsor Award: Best Voice Agent — Photon 2.0

- [x] Configure an inbound SIP route from the Photon number to ElevenLabs and verify the call connects.
- [x] Attach the Graph capture tool to the voice agent and configure its authentication and Cloudflare route.
- [x] Verify that a real call can produce a Graph after the latest agent update.
- [ ] Review the spoken summary and captured details; address failures and latency.
- [x] Enable outbound calls on the Photon Voice profile and configure its SIP connection and outbound credentials in the existing ElevenLabs number.
- [x] Place an outbound ElevenLabs test call through the Photon number to the developer's own iPhone and connect successfully (developer verified).
- [ ] Verify caller ID, two-way audio, and call termination during the demo or an already-planned call; conserve ElevenLabs credits and avoid extra live tests.
- [ ] Demonstrate that context captured during a call is available when preparing a text; identify any manual steps and distinguish this from automatic cross-channel memory.
- [ ] Make call, network, and model failures clear; the agent must not claim an action succeeded when it did not.
- [ ] Accurately explain current limits: one capture per call; no phone-based recovery of saved context or voice approval yet.

## P1 — Sponsor Award: Best Practical AI Innovation — Amazon

- [ ] **Usefulness:** Clearly explain the target user, a concrete communication or executive-function challenge, and how NeuroProxy helps them take a next step.
- [ ] **Agentic behavior:** Demonstrate context extraction, a suggested next action, a reviewable draft, approved real messaging, and reply tracking.
- [ ] **Adaptive intelligence:** Show how a user's correction or a confirmed reply changes a later suggestion; claim only behavior verified in the demo.
- [ ] **User experience:** Make voice, the Graph, message review, and approval easy to understand and low-pressure.
- [ ] **Technical implementation:** Use the existing Mastra tools and deterministic approval, state-transition, and delivery logic. Add focused Graph tools only where they improve the demonstrated workflow.
- [ ] **Creativity:** Show how an unstructured conversation becomes actionable memory and supported follow-through, using a concrete example.
- [ ] Verify sponsor-specific eligibility and submission requirements with the organizers.

## P1 — Semantic Memory and Hybrid Retrieval

- [ ] Build a small synthetic evaluation set for paraphrases, different people, dates, negations, and changed boundaries; compare results with the existing lexical cosine filter.
- [x] Add optional Cloudflare embeddings for conversation-scoped, same-category reply-insight matching, with a conservative threshold and lexical fallback. Chinese text remains lexical; the live provider has not yet been verified.
- [x] Add local BM25-based bounded Graph retrieval for context recovery, with links to model-cited retrieved nodes.
- [ ] Manually verify Recall source links on desktop and mobile, including old or deleted conversations and questions with no exact keyword match.
- [ ] Evaluate BM25 on names, phrases, and details; explore hybrid ranking only if semantic retrieval improves the evaluation.
- [ ] Verify Recall can summarize AutoReply events with correct status and timestamps using a real or simulated conversation.
- [ ] Evaluate OMP Mnemopi in an isolated Bun/TypeScript experiment: compatibility, provenance, deletion, privacy, and retrieval quality versus the current Node.js Graph before adding a dependency.
- [ ] Explore user-reviewed long-term memory candidates, consolidation, and editable preferences; never automatically save interpretations of other people as facts.
- [ ] Evaluate lightweight vector storage compatible with the existing TypeScript and SQLite architecture; add a vector database only if it improves the prototype enough to justify setup and operational complexity.
- [ ] Keep sensitive data scoped to the right conversation, disclose any additional provider processing, and remove associated vectors and indexes when conversations are deleted.
- [ ] Demonstrate a measured improvement on the evaluation set and accurately describe what is implemented, rather than claiming semantic retrieval solely because a dependency is present.

## P1 — Main Track: Best Healthcare Hack

- [ ] **Target users:** Explain the accessibility needs of neurodivergent people, including possible challenges with working memory, attention, reading, task initiation, and interpersonal communication; avoid treating all users as the same.
- [ ] **Health and wellness use case:** Demonstrate how voice, persistent context, and supported communication can reduce the effort of managing an interpersonal situation.
- [ ] **User control:** Show editable interpretations, optional actions, contact selection and verification, and explicit approval before real messages are sent.
- [ ] **Responsible positioning:** Present NeuroProxy as a communication and accessibility aid; do not claim it diagnoses or treats a medical condition.
- [ ] **Privacy:** Explain what is stored, which providers receive conversation data, and how a user can delete a saved conversation.
- [ ] Confirm the Healthcare track selection and any track-specific submission requirements.

## Two-Minute Demo Flow

- [ ] Before judging, place a real test call with fictional data and leave the resulting Graph open. Record a backup showing the call and Graph appearing.
- [ ] **0:00–0:15:** Introduce the target user and concrete accessibility problem.
- [ ] **0:15–0:35:** Briefly show the prepared call recording or describe the already-verified Photon call; identify it as pre-recorded if shown.
- [ ] **0:35–1:00:** Show the generated Graph, direct next action, and reviewable message draft.
- [ ] **1:00–1:35:** Select and verify the test contact, review the exact message, and explicitly approve a real iMessage to the developer's own iPhone.
- [ ] **1:35–1:55:** Show the test reply in the Graph and a follow-up suggestion, or use a clearly labeled prepared result if live timing is too slow.
- [ ] **1:55–2:00:** State the user benefit and the current limitations. Practice with a timer and avoid claiming delivery or features not demonstrated.

## P0 — Final Debugging, Submission, and Presentation

- [ ] Prepare a clear README, setup steps, known limitations, and a concise explanation of what is real versus simulated.
- [ ] Prepare a pitch and live demo that fit the event's two-minute presentation limit.
- [ ] Verify the submission deadline, public repository requirements, applicable code and attribution rules, and sponsor opt-ins against the official event instructions.

## P2 — After the MVP / Only If Time Remains

- [ ] Strengthen contact identity handling for duplicate names, with clear disambiguation and reliable confirmation across conversations and devices.
- [ ] Strengthen privacy: minimize provider context, clearly disclose data sharing and deletion scope, verify Logfire excludes sensitive content, and review provider retention and local data protection. Evaluate sandboxing only where executable tools or file access require isolation.
- [ ] Profile Graph layout and rendering on representative data before considering WebAssembly; adopt it only if a measured bottleneck and a compatible implementation justify the added integration work.
- [ ] Add caller verification before considering phone access to saved context or voice-based approvals.
- [ ] Support multiple Graph updates in one call and cross-channel continuity.
- [ ] Consider preference learning and proactive follow-up only with user controls, opt-out, and appropriate reliability checks.

## P3 — Visual Polish

- [ ] Explore animating a small square along the title's brain icon, with a reduced-motion alternative.
