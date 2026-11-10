import { serve } from '@hono/node-server';
import { Hono } from 'hono';
import { logger } from 'hono/logger';
import { cors } from 'hono/cors';
import { innovideoRoutes } from './routes/innovideo.js';
import { healthRoutes } from './routes/health.js';
import { bootstrapDb } from './db/init.js';

const app = new Hono();

app.use('*', logger());
app.use(
  '/api/*',
  cors({
    origin: (origin) => origin ?? '*',
    credentials: true,
  })
);

app.route('/health', healthRoutes);
app.route('/api/innovideo', innovideoRoutes);

app.notFound((c) => c.json({ code: 404, message: 'Not Found', data: null }, 404));

app.onError((err, c) => {
  console.error('[api] unhandled error:', err);
  return c.json(
    { code: 500, message: err.message || 'Internal Server Error', data: null },
    500
  );
});

const port = Number(process.env.PORT ?? 3001);

await bootstrapDb();

serve({ fetch: app.fetch, port }, (info) => {
  console.log(`[api] huasheng-clone api listening on http://localhost:${info.port}`);
});
