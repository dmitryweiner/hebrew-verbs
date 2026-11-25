// The review page of the illustrations (plan 1.4), on the dev server only:
// a card per verb with a picture entry — the picture on a light and a dark
// ground, "хорошо / переделать / убрать картинку" and a comment. A decision
// is written to src/data/pictures.json at once (a POST to this server's
// plugin); "убрать картинку" also deletes the verb's drawing. Never built.
//
//   npm run review:pictures   → http://localhost:5398/review-pictures
//   …/review-pictures?from=1&to=100&status=pending   (a batch, a status)
//
// Reads src/data/verbs.json, src/data/pictures.json, public/pictures/,
// public/twemoji.json.

import { existsSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { createServer } from 'vite';
import { applyReview, DRAWINGS_DIR, PICTURES_FILE, readPictures, readTwemoji, reviewPage, serializePictures } from './lib/pictures.mjs';

const PORT = 5398;
const PATH = '/review-pictures';
const root = resolve(import.meta.dirname, '..');
const verbs = JSON.parse(readFileSync(resolve(root, 'src/data/verbs.json'), 'utf8'));
const ranks = new Map(verbs.map((v) => [v.id, v.rank]));
const drawing = (id) => resolve(DRAWINGS_DIR, `${id}.svg`);

function readBody(req) {
  return new Promise((done, fail) => {
    let body = '';
    req.on('data', (chunk) => (body += chunk));
    req.on('end', () => done(body));
    req.on('error', fail);
  });
}

const reviewPlugin = {
  name: 'review-pictures',
  configureServer(server) {
    server.middlewares.use(PATH, (req, res, next) => {
      void handle(req, res).catch(next);
    });
  },
};

async function handle(req, res) {
  try {
    if (req.method === 'POST') {
      const decision = JSON.parse(await readBody(req));
      const result = applyReview(readPictures(), decision);
      writeFileSync(PICTURES_FILE, serializePictures(result.pictures, ranks));
      if (result.deleteDrawing && existsSync(drawing(decision.id))) rmSync(drawing(decision.id));
      res.setHeader('content-type', 'application/json');
      res.end(JSON.stringify(result.entry));
      return;
    }
    const pictures = readPictures();
    const drawings = new Map(
      Object.keys(pictures)
        .filter((id) => existsSync(drawing(id)))
        .map((id) => [id, readFileSync(drawing(id), 'utf8')]),
    );
    const query = new URL(req.url ?? '', 'http://localhost').searchParams;
    res.setHeader('content-type', 'text/html; charset=utf-8');
    res.end(reviewPage({ verbs, pictures, drawings, twemoji: readTwemoji(), query }));
  } catch (error) {
    res.statusCode = 400;
    res.end(String(error instanceof Error ? error.message : error));
  }
}

const server = await createServer({ root, plugins: [reviewPlugin], server: { port: PORT, strictPort: true } });
await server.listen();
console.log(`http://localhost:${PORT}${PATH}`);
