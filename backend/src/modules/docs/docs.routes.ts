import { Router, type Router as ExpressRouter } from 'express';
import { openApiSpec } from './openapi';

const router: ExpressRouter = Router();

function renderDocs(): string {
  const endpoints = Object.entries(openApiSpec.paths)
    .flatMap(([path, methods]) =>
      Object.entries(methods).map(([method, operation]) => {
        const summary = 'summary' in operation ? operation.summary : '';
        const tags = 'tags' in operation && operation.tags ? operation.tags.join(', ') : 'Sistema';
        return { path, method: method.toUpperCase(), summary, tags };
      })
    )
    .map(
      (endpoint) => `
        <article class="endpoint">
          <span class="method">${endpoint.method}</span>
          <code>${endpoint.path}</code>
          <p>${endpoint.summary}</p>
          <small>${endpoint.tags}</small>
        </article>`
    )
    .join('');

  return `<!doctype html>
<html lang="es">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>ISTL API Docs</title>
    <style>
      :root { color-scheme: light; --navy:#0b3358; --teal:#0f9b9b; --ink:#0f172a; --muted:#64748b; --line:#e2e8f0; --bg:#f8fafc; }
      * { box-sizing: border-box; }
      body { margin: 0; font-family: Inter, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif; color: var(--ink); background: var(--bg); }
      header { background: var(--navy); color: white; padding: 36px 24px; }
      main { width: min(1100px, calc(100% - 32px)); margin: 28px auto 60px; }
      h1 { margin: 0; font-size: 30px; }
      .meta { margin-top: 8px; color: #cbd5e1; }
      .actions { display: flex; gap: 12px; flex-wrap: wrap; margin-top: 20px; }
      .actions a { color: white; border: 1px solid rgba(255,255,255,.3); border-radius: 6px; padding: 9px 12px; text-decoration: none; font-weight: 600; }
      .grid { display: grid; gap: 12px; }
      .endpoint { display: grid; grid-template-columns: 82px minmax(220px, 1fr); gap: 8px 16px; align-items: center; background: white; border: 1px solid var(--line); border-radius: 8px; padding: 14px; }
      .method { width: 72px; text-align: center; border-radius: 5px; background: var(--teal); color: white; padding: 6px 8px; font-size: 12px; font-weight: 800; }
      code { color: var(--navy); font-weight: 700; word-break: break-word; }
      p { grid-column: 2; margin: 0; color: var(--muted); }
      small { grid-column: 2; color: var(--teal); font-weight: 700; }
      pre { overflow: auto; background: #0f172a; color: #e2e8f0; border-radius: 8px; padding: 18px; }
      h2 { color: var(--navy); margin: 30px 0 14px; }
      @media (max-width: 700px) { .endpoint { grid-template-columns: 1fr; } p, small { grid-column: auto; } }
    </style>
  </head>
  <body>
    <header>
      <div style="width:min(1100px, calc(100% - 32px)); margin:0 auto;">
        <h1>ISTL Asistencia Virtual Docente API</h1>
        <div class="meta">OpenAPI 3.0.3 · Version 1.0.0 · Backend local http://localhost:3000</div>
        <nav class="actions">
          <a href="/api/openapi.json">Ver openapi.json</a>
          <a href="/health">Health check</a>
        </nav>
      </div>
    </header>
    <main>
      <h2>Endpoints</h2>
      <section class="grid">${endpoints}</section>
      <h2>Autenticacion</h2>
      <pre>Authorization: Bearer &lt;accessToken&gt;</pre>
    </main>
  </body>
</html>`;
}

router.get('/openapi.json', (_req, res) => {
  res.status(200).json(openApiSpec);
});

router.get('/docs', (_req, res) => {
  res.setHeader('Content-Type', 'text/html; charset=utf-8');
  res.status(200).send(renderDocs());
});

export default router;
