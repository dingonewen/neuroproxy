# NeuroProxy Hackathon Checklist

Goal: deliver one reliable end-to-end demo for the Photon and Amazon sponsor awards and the Healthcare track. Checked items have been demonstrated or configured; unchecked items still require implementation or verification.

## P0 — End-to-End Demo

- [x] Analyze a conversation and produce a reviewable Cognitive Action Graph and message draft.
- [x] Send a real Photon iMessage to the test iPhone.
- [x] Connect an inbound call to the Photon SMS number and reach the ElevenLabs voice agent.
- [ ] Retest phone voice → Graph: describe a fictional situation and verify that the graph, people, questions, suggested action, and any draft appear on the web.
- [ ] Verify a short, low-pressure voice response that does not require the user to keep answering.
- [ ] Confirm a contact, edit the draft, and explicitly approve a real message; verify no external message is sent without approval.
- [ ] Use the same iPhone to simulate the contact's reply. Confirm the association, analyze the reply, and create a follow-up draft in the same Graph.
- [ ] Verify persistence after restart, duplicate webhook handling, and clear labels for simulated versus real messages.
- [ ] Record a backup demo and clearly identify live, simulated, and unverified behavior.

## Sponsor Award: Best Voice Agent — Photon 2.0

- [x] Configure an inbound SIP route from the Photon number to ElevenLabs and verify the call connects.
- [x] Attach the Graph capture tool to the voice agent and configure its authentication and Cloudflare route.
- [ ] Verify the real-call tool invocation, Graph capture, and spoken summary after the latest agent update; address failures and latency.
- [ ] Confirm the sponsor's outbound-call requirements. If required, configure outbound calling and test only against the developer's own iPhone.
- [ ] Make call, network, and model failures clear; the agent must not claim an action succeeded when it did not.
- [ ] Accurately explain current limits: one capture per call; no phone-based recovery of saved context or voice approval yet.

## Sponsor Award: Best Practical AI Innovation — Amazon

- [ ] **Usefulness:** Clearly explain the target user, a concrete communication or executive-function challenge, and how NeuroProxy helps them take a next step.
- [ ] **Agentic behavior:** Demonstrate context extraction, a suggested next action, a reviewable draft, approved real messaging, and reply tracking.
- [ ] **Adaptive intelligence:** Show how a user's correction or a confirmed reply changes a later suggestion; claim only behavior verified in the demo.
- [ ] **User experience:** Make voice, the Graph, message review, and approval easy to understand and low-pressure.
- [ ] **Technical implementation:** Use the existing Mastra tools and deterministic approval, state-transition, and delivery logic. Add focused Graph tools only where they improve the demonstrated workflow.
- [ ] **Creativity:** Show how an unstructured conversation becomes actionable memory and supported follow-through, using a concrete example.
- [ ] Verify sponsor-specific eligibility and submission requirements with the organizers.

## Main Track: Best Healthcare Hack

- [ ] **Target users:** Explain the accessibility needs of neurodivergent people, including possible challenges with working memory, attention, reading, task initiation, and interpersonal communication; avoid treating all users as the same.
- [ ] **Health and wellness use case:** Demonstrate how voice, persistent context, and supported communication can reduce the effort of managing an interpersonal situation.
- [ ] **User control:** Show editable interpretations, optional actions, contact confirmation, and explicit approval before real messages are sent.
- [ ] **Responsible positioning:** Present NeuroProxy as a communication and accessibility aid; do not claim it diagnoses or treats a medical condition.
- [ ] **Privacy:** Explain what is stored, which providers receive conversation data, and how a user can delete a saved conversation.
- [ ] Confirm the Healthcare track selection and any track-specific submission requirements.

## Submission and Presentation

- [ ] Prepare a clear README, setup steps, known limitations, and a concise explanation of what is real versus simulated.
- [ ] Prepare a pitch and live demo that fit the event's two-minute presentation limit.
- [ ] Verify the submission deadline, public repository requirements, applicable code and attribution rules, and sponsor opt-ins against the official event instructions.

## After the MVP

- [ ] Explore asynchronous mobile voice messages: record and send a clip, then play the agent's response later without keeping a call open.
- [ ] Add caller verification before considering phone access to saved context or voice-based approvals.
- [ ] Support multiple Graph updates in one call and cross-channel continuity.
- [ ] Consider preference learning and proactive follow-up only with user controls, opt-out, and appropriate reliability checks.
