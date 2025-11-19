#!/usr/bin/env nodejs
// var http = require('http');
import http from 'http';
import { URL } from 'url';
// const http = require('http');
// const { URL } = require('url');
http.createServer(function (req, res) {
  res.writeHead(200, {'Content-Type': 'text/plain'}); // Corrected line
  res.end('Hello World\n');
}).listen(8008, 'localhost');
console.log('Server running at http://localhost:8008/');
const PORT = process.env.PORT || 8008;
const HOST = process.env.HOST || '0.0.0.0';

// Small helper to read request body
function readBody(req) {
  return new Promise((resolve, reject) => {
    const chunks = [];
    req.on('data', c => chunks.push(c));
    req.on('end', () => resolve(Buffer.concat(chunks).toString()));
    req.on('error', reject);
  });
}

const server = http.createServer(async (req, res) => {
  const url = new URL(req.url, `http://${req.headers.host}`);
  const path = url.pathname;
  const query = url.searchParams;

  // Common response helper
  function sendJSON(obj, status = 200) {
    const payload = JSON.stringify(obj, null, 2);
    res.writeHead(status, { 'Content-Type': 'application/json; charset=utf-8' });
    res.end(payload);
  }

  // Root: human-friendly test page with links and instructions
  if (path === '/app1/' || path === '/app1/index.html') {
    res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
    res.end(`
      <!doctype html>
      <html>
        <head><meta charset="utf-8"><title>Proxy test page</title></head>
        <body style="font-family:system-ui,Segoe UI,Roboto,Helvetica,Arial,sans-serif">
          <h1>Node test server for proxy verification</h1>
          <p>Use this page or the endpoints below to test your reverse proxy (nginx) behavior.</p>
          <ul>
            <li><a href="/headers">/headers</a> — shows all incoming request headers (useful to see X-Forwarded-For / Host)</li>
            <li><a href="/status?code=200">/status?code=200</a> — returns the HTTP status you request (change code param)</li>
            <li><a href="/echo">/echo</a> — echoes request method, path and body (try POST)</li>
            <li><a href="/delay?ms=1000">/delay?ms=1000</a> — waits the specified milliseconds before responding</li>
            <li><a href="/healthz">/healthz</a> — simple 200 OK health endpoint</li>
          </ul>
          <h3>Quick curl examples</h3>
          <pre>
curl -i http://localhost:${PORT}/headers
curl -i -H "X-Test: proxied" http://localhost:${PORT}/headers
curl -i -X POST -d '{"hello":"world"}' -H "Content-Type: application/json" http://localhost:${PORT}/echo
          </pre>
        </body>
      </html>
    `);
    return;
  }

  // Health check
  if (path === '/app1/health' || path === '/app1/ready') {
    res.writeHead(200, { 'Content-Type': 'text/plain' });
    res.end('OK');
    return;
  }

  // Show request headers and connection info - useful to verify nginx forwarded headers
  if (path === '/app1/headers') {
    const info = {
      method: req.method,
      url: req.url,
      remoteAddress: (req.socket && req.socket.remoteAddress) || null,
      remotePort: (req.socket && req.socket.remotePort) || null,
      headers: req.headers,
      env: {
        forwarded_for: req.headers['x-forwarded-for'] || null,
        real_ip: req.headers['x-real-ip'] || null,
        host: req.headers['host'] || null,
      },
      timestamp: new Date().toISOString()
    };
    sendJSON(info);
    return;
  }

  // Echo endpoint: returns method, path, headers and body
  if (path === '/app1/echo') {
    try {
      const body = await readBody(req);
      sendJSON({
        method: req.method,
        url: req.url,
        headers: req.headers,
        body: body,
        length: body.length
      });
    } catch (err) {
      sendJSON({ error: 'Failed to read body', details: String(err) }, 500);
    }
    return;
  }

  // Status endpoint: respond with chosen HTTP status code for testing upstream handling
  if (path === '/app1/status') {
    const code = Number(query.get('code')) || 200;
    const note = { ok: code >= 200 && code < 300, requested: code };
    res.writeHead(code, { 'Content-Type': 'application/json; charset=utf-8' });
    res.end(JSON.stringify(note, null, 2));
    return;
  }

  // Delay endpoint: useful to test proxy timeouts
  if (path === '/app1/delay') {
    const ms = Math.min(Math.max(Number(query.get('ms') || 0), 0), 60_000);
    setTimeout(() => {
      sendJSON({ delayed: ms, now: new Date().toISOString() });
    }, ms);
    return;
  }

  // Fallback: not found
  res.writeHead(404, { 'Content-Type': 'application/json; charset=utf-8' });
  res.end(JSON.stringify({ error: 'not found', path }, null, 2));
});

server.listen(PORT, HOST, () => {
  console.log(`Test server listening on http://${HOST}:${PORT}/`);
  console.log('Endpoints: /, /headers, /echo, /status, /delay, /healthz');
});