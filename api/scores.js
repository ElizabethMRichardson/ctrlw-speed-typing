import { put, get } from '@vercel/blob';

const KEY = 'leaderboard.json';
const MAX = 50;

async function readBoard() {
  const res = await get(KEY, { access: 'private', useCache: false });
  if (!res || !res.stream) return [];
  const data = await new Response(res.stream).json();
  return Array.isArray(data) ? data : [];
}

async function writeBoard(board) {
  await put(KEY, JSON.stringify(board), {
    access: 'private',
    contentType: 'application/json',
    addRandomSuffix: false,
    allowOverwrite: true,
    cacheControlMaxAge: 60,
  });
}

function clean(e) {
  if (!e || typeof e !== 'object') return null;
  const who = String(e.who ?? '').trim().slice(0, 28);
  const ms = Math.round(Number(e.ms));
  const at = Number(e.at) || Date.now();
  if (!who || !Number.isFinite(ms) || ms <= 0) return null;
  return { who, ms, at };
}

export default async function handler(req, res) {
  res.setHeader('Cache-Control', 'no-store');
  try {
    if (req.method === 'GET') {
      return res.status(200).json(await readBoard());
    }
    if (req.method === 'POST') {
      let body = req.body;
      if (typeof body === 'string') {
        try { body = JSON.parse(body); } catch { body = null; }
      }
      const entry = clean(body);
      if (!entry) return res.status(400).json({ error: 'bad entry' });

      const board = await readBoard();
      board.push(entry);
      board.sort((a, b) => a.ms - b.ms);
      const trimmed = board.slice(0, MAX);
      await writeBoard(trimmed);
      return res.status(200).json(trimmed);
    }
    if (req.method === 'DELETE') {
      await writeBoard([]);
      return res.status(200).json([]);
    }
    res.setHeader('Allow', 'GET, POST, DELETE');
    return res.status(405).json({ error: 'method not allowed' });
  } catch {
    return res.status(500).json({ error: 'server error' });
  }
}
