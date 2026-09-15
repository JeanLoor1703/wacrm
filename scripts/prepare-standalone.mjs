import { cp, mkdir } from 'node:fs/promises';

// Next's standalone server does not copy public assets or .next/static by
// design. Keep the Playwright server faithful to the deployed bundle by
// placing those assets next to server.js before it starts.
await mkdir('.next/standalone/.next', { recursive: true });
await cp('.next/static', '.next/standalone/.next/static', { recursive: true });
await cp('public', '.next/standalone/public', { recursive: true });
