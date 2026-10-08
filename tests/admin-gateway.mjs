import { createServer, request as httpRequest } from 'node:http';
import { readFile } from 'node:fs/promises';

// Real admin assets against a disposable createApp instance; no production auth bypass.
export async function createAdminGateway(apiPort, port = 0) {
  const assets = new Map([
    ['/', ['index.html', 'text/html; charset=utf-8']],
    ['/index.html', ['index.html', 'text/html; charset=utf-8']],
    ['/app.js', ['app.js', 'text/javascript; charset=utf-8']],
    ['/app.css', ['app.css', 'text/css; charset=utf-8']],
  ]);
  const server = createServer(async (request, response) => {
    const pathname = new URL(request.url, 'http://localhost').pathname;
    if (pathname.startsWith('/api/')) {
      const upstream = httpRequest(
        {
          hostname: '127.0.0.1',
          port: apiPort,
          method: request.method,
          path: request.url,
          headers: request.headers,
        },
        (result) => {
          response.writeHead(result.statusCode, result.headers);
          result.pipe(response);
        },
      );
      upstream.setTimeout(15_000, () => upstream.destroy());
      upstream.on('error', () => {
        if (!response.headersSent) response.writeHead(502);
        response.end();
      });
      request.pipe(upstream);
      return;
    }
    const asset = assets.get(pathname);
    if (!asset || request.method !== 'GET') {
      response.writeHead(404);
      response.end();
      return;
    }
    try {
      const bytes = await readFile(new URL('../services/admin/' + asset[0], import.meta.url));
      response.writeHead(200, {
        'Content-Type': asset[1],
        'Cache-Control': 'no-store',
        'X-Content-Type-Options': 'nosniff',
      });
      response.end(bytes);
    } catch {
      response.writeHead(500);
      response.end();
    }
  });
  await new Promise((resolve, reject) => {
    server.once('error', reject);
    server.listen(port, '127.0.0.1', resolve);
  });
  return {
    port: server.address().port,
    close: () =>
      new Promise((resolve, reject) =>
        server.close((error) => (error ? reject(error) : resolve())),
      ),
  };
}
