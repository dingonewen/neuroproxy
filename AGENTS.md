
# NeuroProxy — HackPrinceton Fall 2026

## Project Overview

NeuroProxy is a voice-first cognitive delegation agent designed for neurodivergent users, particularly people who experience difficulties with working memory, attention, reading, task initiation, and executive functioning.

Tagline: "Your conversations, remembered. Your commitments, handled."

The project combines three capabilities:

1. Voice-first natural conversation.
2. A persistent Cognitive Action Graph.
3. Agentic task delegation through real messaging channels.

NeuroProxy should NOT be a generic chatbot, to-do app, conversation summarizer, or AI meeting scheduler.

Its defining feature is converting unstructured conversations into structured, actionable memory, then executing approved communication tasks and tracking their outcomes.

## Hackathon Context

Event: HackPrinceton Fall 2026
Development window: November 13, 8 PM to November 15, 8 AM ET.
Submission deadline: Sunday, November 15, 8 AM ET.

Target awards:
- Main track: Best Healthcare Hack
- Special track: Photon 2.0 Messaging Agent
- Special track: Amazon Best Practical AI Innovation
- Optional: Best Rookie Hack, if eligible

The project is developed by one person.

Prioritize a reliable, polished, end-to-end demo over feature breadth.

Check and comply with the current official competition rules.

## Core Product Experience

The user speaks naturally to NeuroProxy using a phone call.

Example:

"I need to finish our group project. Alex is working on the frontend, Sam has the dataset, and I need to finish the backend. I forgot whether Alex promised to finish by Saturday."

NeuroProxy:

1. Transcribes and understands the conversation.
2. Extracts people, topics, tasks, commitments, and uncertainties.
3. Creates or updates a Cognitive Action Graph.
4. Identifies that Alex's deadline is unresolved.
5. Asks whether the user wants to contact Alex.
6. Drafts a message and requests explicit approval.
7. Sends the approved message through Photon.
8. Processes the contact's reply.
9. Updates the Action Graph.
10. Allows the user to recover context through voice or a visual tree.

The user can ask:
- "What were we talking about?"
- "What am I waiting for?"
- "What did Alex say?"
- "Can you ask Sam when the dataset will be ready?"

Responses should be short, precise, and cognitively accessible.

## Architecture

Development environment: Ubuntu + VS Code.

NeuroProxy uses TypeScript across the entire application.

Backend:
- Node.js + TypeScript
- Use a single agent with explicit tools
- Prefer existing HTTP and LLM libraries
- SQLite for persistent agent and graph state

Frontend:
- React + TypeScript
- Use React Flow for visualization
- Mobile-responsive Cognitive Action Graph

Communication:
- Photon 2.0 for iMessage and/or SMS
- Photon SMS voice number with SIP integration
- Retell, ElevenLabs, LiveKit, or another supported voice provider

Photon is the communications infrastructure, not the core reasoning engine.

Important:
- Do not introduce Python or FastAPI.
- Do not confuse Photon Stable Spectrum SDK with
  the Photon 2.0 Beta API.
- Verify all integration methods against current docs.
- Prioritize minimal integration work.

The user interacts using the native iPhone Phone or Messages app. No native iOS app is required.

The Action Graph is displayed in a browser on a laptop or iPhone.

## Cognitive Action Graph

The graph should store structured entities such as:

- Conversation topics
- People
- Questions
- Answers
- Tasks
- Commitments
- Decisions
- Pending approvals
- Outbound messages
- Incoming replies

Example task states:
- proposed
- pending_approval
- waiting_for_reply
- confirmed
- completed
- cancelled

Every external action should be traceable to a graph node.

## Agent Tools

Initial proposed tools:

- extract_conversation_context()
- create_or_update_graph()
- create_task()
- draft_message()
- request_approval()
- send_approved_message()
- process_contact_reply()
- update_task_status()
- recover_conversation_context()

Use deterministic logic for approvals, authorization, state changes, and message delivery.

Do not let the LLM invent delivery confirmations or commitments.

## MVP — Required

1. A functional voice conversation, if Photon voice provisioning is available.
2. Extract 2–3 tasks and participants from natural speech.
3. Generate an interactive Cognitive Action Graph.
4. Draft a message to a contact.
5. Obtain explicit user approval.
6. Send a real message through Photon.
7. Process a reply and update the corresponding graph node.
8. Answer context-recovery questions using stored state.

## Testing Constraints

The developer has:
- One iPhone
- One Ubuntu laptop
- No dedicated second test phone

Implement a mock contact simulator for automated testing.

Use the same message-processing pipeline for real Photon webhooks and simulated inputs.

Clearly distinguish simulated messages from real messages.

Never contact an unconsenting real recipient.

## Scope Restrictions

Do not initially build:
- Native iOS applications
- Multi-user authentication
- Complex calendar integrations
- Group chat support
- Outbound AI phone calls
- Multiple independent agents
- Complex infrastructure

Prefer a single reliable agent orchestrator with explicit tools.

## Safety and Privacy

- Require explicit approval before contacting third parties.
- Do not send unapproved messages.
- Prevent duplicate sends.
- Allow cancellation and correction.
- Minimize storage of sensitive conversation data.
- Use synthetic data for demonstrations.
- Do not claim to diagnose or treat ADHD or other medical conditions.

## Development Priorities

1. Build a persistent Cognitive Action Graph connecting topics, people, tasks, decisions, and message states.
2. Verify and integrate Photon 2.0 for real messaging.
3. Add voice interaction through Photon Voice if available, otherwise a browser-based voice interface.
4. Build and test one complete delegation workflow, including context recovery.

Verify provider APIs against current documentation.
Never invent API endpoints or SDK methods.

If voice provisioning is unavailable, keep the agent functional through a text-based Photon channel and a browser-based voice prototype.

## Definition of Done

A judge can observe a user request becoming structured graph nodes, approve an external action, see a real Photon message being sent, and observe the graph update when a reply is processed.

The final demo must clearly distinguish working functionality from simulations.


## Core Development Goal

Build one complete workflow:

Voice input
→ Agent reasoning
→ Cognitive Action Graph
→ User approval
→ Photon iMessage delegation
→ Contact reply
→ Graph state update
→ Context recovery

Prioritize a functional end-to-end prototype
over additional features.
