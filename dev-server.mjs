// 로컬 미리보기 서버: 파일을 저장하면 브라우저가 자동으로 새로고침됩니다.
// 실행: node dev-server.mjs   →   http://localhost:5500
// 외부 패키지 없이 Node만으로 동작합니다. (GitHub Pages 배포와는 무관)
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.dirname(fileURLToPath(import.meta.url));
const port = Number(process.env.PORT) || 5500;

const types = {
  '.html': 'text/html; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.mjs': 'text/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.gif': 'image/gif',
  '.svg': 'image/svg+xml',
  '.webp': 'image/webp',
  '.ico': 'image/x-icon',
};

const reloadSnippet =
  '<script>(function(){var es=new EventSource("/__reload");' +
  'es.onmessage=function(){location.reload()};})();</script>';

const clients = new Set();

const server = http.createServer((req, res) => {
  const url = new URL(req.url, 'http://localhost');

  if (url.pathname === '/__reload') {
    res.writeHead(200, {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      Connection: 'keep-alive',
    });
    res.write(': connected\n\n');
    clients.add(res);
    req.on('close', () => clients.delete(res));
    return;
  }

  let rel = decodeURIComponent(url.pathname);
  if (rel.endsWith('/')) rel += 'index.html';
  const file = path.join(root, rel);
  if (!file.startsWith(root + path.sep) && file !== root) {
    res.writeHead(403).end('Forbidden');
    return;
  }

  fs.readFile(file, (err, data) => {
    if (err) {
      res.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' }).end('Not found');
      return;
    }
    const ext = path.extname(file).toLowerCase();
    const headers = { 'Content-Type': types[ext] || 'application/octet-stream', 'Cache-Control': 'no-store' };
    if (ext === '.html') {
      const html = data.toString('utf8');
      const out = html.includes('</body>') ? html.replace('</body>', reloadSnippet + '</body>') : html + reloadSnippet;
      res.writeHead(200, headers).end(out);
    } else {
      res.writeHead(200, headers).end(data);
    }
  });
});

let timer = null;
fs.watch(root, { recursive: true }, (_event, name) => {
  if (!name || name.startsWith('.git')) return;
  clearTimeout(timer);
  timer = setTimeout(() => {
    for (const c of clients) c.write('data: reload\n\n');
    console.log('변경 감지 → 새로고침:', name);
  }, 120);
});

server.listen(port, '127.0.0.1', () => {
  console.log(`미리보기: http://localhost:${port}  (종료: Ctrl+C)`);
});
