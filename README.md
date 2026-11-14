# NeuroProxy prototype

A TypeScript, local, **simulation-only** delegation slice. Enter a conversation to get suggested people, tasks, uncertainties, and (when explicitly requested) a message draft. Review and edit the suggestions before saving them to the graph. You can also enter a delegation manually. Approve or cancel the simulated send, then enter a simulated reply and inspect the persisted graph. No real messages are sent.

Requirements: Node.js 24 or newer and npm. Run `npm install`, then start `npm run dev` and `npm run dev:web` in separate terminals. Open the Vite URL shown in the terminal. SQLite state is stored in `neuroproxy.db`; set `NEUROPROXY_DB` to choose a different file. To enable natural-language analysis and the optional read-only context-recovery agent, set `NEUROPROXY_MODEL` to a Mastra-supported provider/model and configure the provider credentials before starting the server. No API key is included. The app listens on localhost and is intended for local use.

Run `npm test` and `npm run build` for checks. This is not the complete demo: voice, actual Photon 2.0 sends, authenticated webhook handling and live delivery verification remain to be implemented and tested. The implementation plan is in [IMPLEMENTATION.md](IMPLEMENTATION.md).

Analysis sends the entered text to the configured model provider. A valid model and provider credentials are required; the app does not provide an offline extraction fallback. Analysis alone does not persist the text or create a draft. Review all suggestions before saving.
