import { createServer } from 'vite';

process.on('SIGHUP', () => {
  console.log('[Vite] Received SIGHUP, ignoring...');
});

const server = await createServer({
  server: {
    port: 5000,
    host: '0.0.0.0',
  },
});

await server.listen();
server.printUrls();

process.on('SIGTERM', async () => {
  await server.close();
  process.exit(0);
});
