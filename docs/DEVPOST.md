# NeuroProxy: For Minds That Wander, and Hearts That Care

## Inspiration

I am neurodivergent, and I spend a lot of time alone. I do not always feel lonely; sometimes solitude is exactly what I need. But caring about people and knowing how to stay connected to them are not always the same thing.

As someone with ADHD, I struggle with working memory. During a face-to-face conversation, my attention can wander even when I genuinely care about what someone is telling me. Later, I might remember how the conversation felt but forget the details: what they needed, what I promised, or what I wanted to say. When a message arrives, I might miss part of it, overthink what it means, or put off replying until the silence itself feels difficult to break.

The people around me cannot always see what is happening inside my head. They might see a missed detail or an unanswered message. I wish they could also see the care behind it.

I built NeuroProxy to help bridge that gap: to hold the threads I struggle to hold, and to help me turn the intention to connect into an action. My hope is that it can help people like me participate more confidently in relationships, not replace those relationships.

**For minds that wander, and hearts that care.**

## What it does

NeuroProxy is a voice-first AI companion for understanding conversations, remembering context, and taking the next step. It brings four parts of communication together:

1. **Hear the Meaning.** I can speak or type naturally about a situation. NeuroProxy proposes people, questions, tasks, feelings, and relationship context. It separates reported facts from possible interpretations instead of presenting a guess about someone's intentions as truth. I can review and correct the results.
2. **See the Bigger Picture.** The reviewed context becomes a persistent, interactive Cognitive Action Graph. The graph gives me a way to see the people, questions, and actions in a conversation without having to hold all of them in my working memory.
3. **Make Things Happen.** NeuroProxy suggests an action and helps me draft a message. I can change the recipient or the words, and I approve the message before it is sent through Photon iMessage. When a reply arrives, I can analyze it in context and prepare a follow-up.
4. **Find Your Way Back.** Later, I can ask about a saved conversation, an action, or a reply. NeuroProxy retrieves relevant graph records and can link its answer back to the sources, so I can inspect the context myself.

For an eligible contact in a saved conversation, there is also an experimental **AutoReply** mode that I can enable separately. It can respond without individual approval for each message, and every automatic message identifies itself as a NeuroProxy AutoReply. Ordinary messages still require approval. AutoReply's off switch, opt-out handling, and disclosure need further live testing.

NeuroProxy also supports phone voice capture: a Photon phone number connects to an ElevenLabs voice agent, which can create a proposed graph for review on the web. The prototype has desktop and mobile web interfaces.

This is an accessibility and communication aid, not a diagnostic or treatment tool. My own experience is the starting point; it does not represent every neurodivergent person's needs.

## How I built it

I built NeuroProxy in TypeScript, with React, Vite, React Flow, Fastify, Mastra, and SQLite. The model-backed workflow extracts structured context, suggests actions, drafts messages, and analyzes replies. The graph and message history persist so the user can return to a conversation later.

For recall, a read-only `recall_memory` tool uses local BM25 ranking to select a bounded set of graph records and nearby message links. The assistant can cite retrieved records and the interface can link to them. Source IDs are checked against retrieved records, although that does not guarantee that every claim is supported by its citation. This source-link workflow has automated coverage but still needs a live end-to-end check. My approach to separating recall from longer-term memory was inspired by the memory architecture of [Oh My Pi](https://github.com/can1357/oh-my-pi/blob/main/docs/memory.md); no Oh My Pi code was copied into this implementation.

The model helps interpret and draft, while application logic handles authorization, webhook signature verification, message state, and duplicate-send protection. Photon 2.0 connects the workflow to real iMessage conversations, and Photon voice connects to ElevenLabs over SIP. Optional Cloudflare Workers AI embeddings compare similar reply insights; this integration has not yet been verified with a live account.

The Coral theme and empty-state curve animations use and adapt BoldKit materials. The repository's third-party notices document these and other dependencies. The application uses open-source libraries and external AI, voice, and messaging services; my work brought them together into this communication and memory workflow.

## Challenges I ran into

The hardest design question was how to make an agent proactive without letting it take away the user's agency. A model can suggest what a message might mean, but it cannot know another person's feelings with certainty. I wanted users to be able to distinguish observations from interpretations, edit the graph, and decide what to send.

Another challenge was carrying context across a real conversation rather than stopping at the first draft. Incoming messages need to be connected to the right conversation, and failures must not silently turn into duplicate sends. I worked on explicit message states, signed webhook handling, and a separately authorized AutoReply scope.

Memory also has to be useful without pretending it is complete. BM25 can miss a relevant record if the wording differs, and a valid source link does not prove that an answer interprets the source correctly. I want the user to be able to return to the underlying messages and correct the record.

## Accomplishments I am proud of

I tested a real Photon iMessage send and reply, including reply analysis and follow-up, using my own iPhone. I also tested one real AutoReply that responded to the incoming message, and an inbound Photon-to-ElevenLabs call that produced a reviewable graph. An outbound test call connected; caller ID, two-way audio, and call termination still need separate verification.

I am proud that this prototype brings understanding, memory, and communication into one workflow. It starts with a difficulty I experience personally and offers a concrete way to take a small step toward someone I care about.

## What I learned

An agent that participates in communication needs more than a persuasive response. It needs a memory the user can inspect, clear boundaries around its actions, and a way to hand control back when it is uncertain. A voice interface can reduce the effort of typing and reading, but accessibility also means making the next decision easier to see and act on.

I also learned to distinguish a design goal from a verified capability. NeuroProxy currently sends relevant context to configured AI providers, and its voice and messaging providers receive data needed for those services. It is not a fully local or private training sandbox.

## What's next for NeuroProxy

I want to continue evaluating memory retrieval and make it easier to understand what happened in a conversation while the user was away. I also want to test AutoReply's boundaries more thoroughly, improve continuity between voice and text, and explore asynchronous voice messages for moments when a live phone call feels like too much.

In the longer term, I hope NeuroProxy can learn from user-approved preferences and corrections, with memory that can be inspected, edited, and deleted. More private processing and carefully evaluated personal model adaptation are future possibilities, not features I claim to have completed.

What I want to preserve is simple: when my attention wanders, the people I care about should not have to mistake that wandering for indifference.
