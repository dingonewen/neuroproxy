# Implementation plan

NeuroProxy uses TypeScript end to end.

1. Use a single Mastra agent with explicit tools and no workspace or subagent permissions. Persist structured graph state separately; keep approval and delivery in deterministic code.
2. Use a React Flow canvas with Dagre layout and typed nodes and edges.
3. Implement persistent graph, draft, explicit approval, cancellation, idempotent send, shared reply processing and context recovery. Start with a clearly marked simulator.
4. Integrate Photon 2.0 Beta using its project-scoped API and verify webhook authentication and event schemas from official documentation. Exercise real messaging only with configured credentials, an explicitly approved message and a consenting recipient.
5. Use the browser voice prototype for speech input and spoken context recovery; verify the full demo manually. Integrate Photon phone voice separately when SIP and a voice provider are provisioned.

Photon's published [2.0 introduction](https://photon.codes/blog/introducing-photon-2.0) documents Users, Spaces and Messages and says acceptance does not imply delivery. Check the current official competition rules before submission.

