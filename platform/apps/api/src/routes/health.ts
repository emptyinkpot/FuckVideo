import { Hono } from 'hono';

export const healthRoutes = new Hono().get('/', (c) =>
  c.json({
    status: 'ok',
    service: 'huasheng-clone-api',
    version: '0.1.0',
    uptime: process.uptime(),
    timestamp: new Date().toISOString(),
  })
);
