const { createServer } = require('http');
const { parse } = require('url');
const next = require('next');
const path = require('path');
const fs = require('fs');
const os = require('os');

const dev = process.env.NODE_ENV !== 'production';
const hostname = process.env.HOST || '0.0.0.0';
const port = parseInt(process.env.PORT || '3000', 10);

const uploadDir = path.resolve(process.env.UPLOAD_DIR || './uploads');
if (!fs.existsSync(uploadDir)) {
  fs.mkdirSync(uploadDir, { recursive: true });
}

if (!process.env.DATABASE_URL) {
  process.env.DATABASE_URL = 'file:./dev.db';
}

const app = next({ dev, hostname, port });
const handle = app.getRequestHandler();

function getLocalIP() {
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

function printBanner() {
  const localIP = getLocalIP();
  const mode = dev ? 'development' : 'production';
  console.log('');
  console.log('  ┌──────────────────────────────────────────┐');
  console.log('  │       KIMI Swarm Chat Service             │');
  console.log('  ├──────────────────────────────────────────┤');
  console.log(`  │  Local:    http://localhost:${port}`);
  console.log(`  │  Network:  http://${localIP}:${port}`);
  console.log(`  │  Mode:     ${mode}`);
  console.log('  ├──────────────────────────────────────────┤');
  console.log(`  │  Database: ${process.env.DATABASE_URL}`);
  console.log(`  │  Uploads:  ${uploadDir}`);
  console.log(`  │  Model:    ${process.env.OPENROUTER_DEFAULT_MODEL || 'moonshotai/kimi-k2'}`);
  console.log('  └──────────────────────────────────────────┘');
  console.log('');
}

app.prepare().then(() => {
  const server = createServer(async (req, res) => {
    try {
      const parsedUrl = parse(req.url, true);

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
      console.error('[server] Error:', err);
      res.statusCode = 500;
      res.end('Internal Server Error');
    }
  });

  server.keepAliveTimeout = 65000;
  server.headersTimeout = 66000;

  server.listen(port, hostname, (err) => {
    if (err) {
      console.error('[server] Failed to start:', err);
      process.exit(1);
    }
    printBanner();
  });

  const shutdown = (signal) => {
    console.log(`\n[server] ${signal} — shutting down...`);
    server.close(() => {
      console.log('[server] Closed.');
      process.exit(0);
    });
    setTimeout(() => process.exit(1), 5000);
  };

  process.on('SIGTERM', () => shutdown('SIGTERM'));
  process.on('SIGINT', () => shutdown('SIGINT'));
});
