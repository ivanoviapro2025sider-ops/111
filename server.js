const { createServer } = require('http');
const { parse } = require('url');
const next = require('next');
const path = require('path');
const fs = require('fs');

const dev = process.env.NODE_ENV !== 'production';
const hostname = process.env.HOST || '0.0.0.0';
const port = parseInt(process.env.PORT || '3000', 10);

const uploadDir = path.resolve(process.env.UPLOAD_DIR || './uploads');
if (!fs.existsSync(uploadDir)) {
  fs.mkdirSync(uploadDir, { recursive: true });
  console.log(`[server] Created uploads directory: ${uploadDir}`);
}

if (!process.env.DATABASE_URL) {
  process.env.DATABASE_URL = 'file:./dev.db';
}

const app = next({ dev, hostname, port });
const handle = app.getRequestHandler();

app.prepare().then(() => {
  const server = createServer(async (req, res) => {
    try {
      const parsedUrl = parse(req.url, true);

      res.setHeader('X-Powered-By', 'KIMI Swarm Chat');

      if (req.method === 'OPTIONS') {
        res.setHeader('Access-Control-Allow-Origin', '*');
        res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
        res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
        res.writeHead(204);
        res.end();
        return;
      }

      await handle(req, res, parsedUrl);
    } catch (err) {
      console.error('[server] Error handling request:', err);
      res.statusCode = 500;
      res.end('Internal Server Error');
    }
  });

  server.maxHeadersCount = 0;
  server.timeout = 0;
  server.keepAliveTimeout = 65000;
  server.headersTimeout = 66000;

  server.listen(port, hostname, () => {
    console.log('');
    console.log('  ╔══════════════════════════════════════════════╗');
    console.log('  ║         KIMI Swarm Chat Service              ║');
    console.log('  ╠══════════════════════════════════════════════╣');
    console.log(`  ║  Local:   http://localhost:${port}              ║`);
    if (hostname === '0.0.0.0') {
      console.log(`  ║  Network: http://${getLocalIP()}:${port}    ║`);
    }
    console.log(`  ║  Mode:    ${dev ? 'development' : 'production'}                    ║`);
    console.log('  ╠══════════════════════════════════════════════╣');
    console.log(`  ║  DB:      ${process.env.DATABASE_URL}              ║`);
    console.log(`  ║  Uploads: ${uploadDir}`);
    console.log(`  ║  Model:   ${process.env.OPENROUTER_DEFAULT_MODEL || 'moonshotai/kimi-k2'}`);
    console.log('  ╚══════════════════════════════════════════════╝');
    console.log('');
  });

  process.on('SIGTERM', () => {
    console.log('\n[server] SIGTERM received, shutting down...');
    server.close(() => process.exit(0));
  });

  process.on('SIGINT', () => {
    console.log('\n[server] SIGINT received, shutting down...');
    server.close(() => process.exit(0));
  });
});

function getLocalIP() {
  const os = require('os');
  const interfaces = os.networkInterfaces();
  for (const name of Object.keys(interfaces)) {
    for (const iface of interfaces[name]) {
      if (iface.family === 'IPv4' && !iface.internal) {
        return iface.address;
      }
    }
  }
  return '127.0.0.1';
}
