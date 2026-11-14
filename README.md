# NeuroProxy prototype

A TypeScript, local, **simulation-only** delegation slice. Enter a conversation to get suggested people, tasks, uncertainties, and (when explicitly requested) a message draft. Review and edit the suggestions before saving them to the graph. You can also enter a delegation manually. Approve or cancel the simulated send, then enter a simulated reply and inspect the persisted graph. No real messages are sent.

Requirements: Node.js 24 or newer and npm. Copy `.env.example` to `.env` and fill in the model provider credentials. Run `npm install`, then start `npm run dev` and `npm run dev:web` in separate terminals. The backend automatically loads `.env`; restart it after changing the file. Open the Vite URL shown in the terminal. SQLite state is stored in `neuroproxy.db`; set `NEUROPROXY_DB` to choose a different file. Natural-language analysis and context recovery require a Mastra-supported model and provider credentials. The app listens on localhost and is intended for local use.

To check Photon 2.0 Beta project access, set `PHOTON_API_KEY` and `PHOTON_PROJECT_ID` in `.env` and run `npm run check:photon`. This performs a read-only request and does not print the key or returned spaces. Success verifies access to that endpoint, not SMS activation, message delivery, or webhook configuration. `PHOTON_SMS_NUMBER` is reserved for a future integration and is not used yet.

Run `npm test` and `npm run build` for checks. This is not the complete demo: voice, actual Photon 2.0 sends, authenticated webhook handling and live delivery verification remain to be implemented and tested. The implementation plan is in [IMPLEMENTATION.md](IMPLEMENTATION.md).

Analysis sends the entered text to the configured model provider. A valid model and provider credentials are required; the app does not provide an offline extraction fallback. Analysis alone does not persist the text or create a draft. Review all suggestions before saving.
