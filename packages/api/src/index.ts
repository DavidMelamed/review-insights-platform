import fastify from 'fastify';
import cors from '@fastify/cors';
import helmet from '@fastify/helmet';

const server = fastify({
  logger: true
});

await server.register(cors, {
  origin: true
});

await server.register(helmet);

server.get('/health', async () => {
  return { status: 'ok', timestamp: new Date().toISOString() };
});

const start = async () => {
  try {
    await server.listen({ port: 3000, host: '0.0.0.0' });
    console.log('API server started on http://localhost:3000');
  } catch (err) {
    server.log.error(err);
    process.exit(1);
  }
};

start();