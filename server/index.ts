import { startTelemetry } from './telemetry.ts';
import { createApp } from './app.ts';
import { Store } from './store.ts';
startTelemetry();
const store = new Store(process.env.NEUROPROXY_DB ?? 'neuroproxy.db');
const app = createApp(store);
await app.listen({ port: 3000, host: '127.0.0.1' });
