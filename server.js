'use strict';
require('dotenv').config();

const express = require('express');
const path    = require('path');
const app     = express();

app.use(express.json({ limit: '4mb' }));
app.use(express.static(__dirname));

const API_URL = 'https://api.anthropic.com/v1/messages';
const PORT    = process.env.PORT || 3000;

function getKey(req) {
  // Prefer server-side key; fall back to key sent from browser (direct mode)
  return process.env.ANTHROPIC_API_KEY || req.headers['x-client-key'] || '';
}

function model() {
  return process.env.MODEL || 'claude-opus-4-8';
}

// ── Health check ──────────────────────────────────────────────────────────────
app.get('/api/status', (req, res) => {
  res.json({
    online: true,
    model: model(),
    hasKey: !!process.env.ANTHROPIC_API_KEY,
    version: '2.0.0',
  });
});

// ── Streaming chat proxy ──────────────────────────────────────────────────────
app.post('/api/chat', async (req, res) => {
  const key = getKey(req);
  if (!key) return res.status(400).json({ error: 'No API key. Set ANTHROPIC_API_KEY in .env' });

  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');
  res.flushHeaders();

  try {
    const upstream = await fetch(API_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': key,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify({
        model: req.body.model || model(),
        max_tokens: 2048,
        stream: true,
        system: req.body.system,
        messages: req.body.messages,
      }),
    });

    if (!upstream.ok) {
      const err = await upstream.json().catch(() => ({}));
      res.write(`data: ${JSON.stringify({ type: 'error', error: err.error?.message || `HTTP ${upstream.status}` })}\n\n`);
      return res.end();
    }

    for await (const chunk of upstream.body) {
      if (res.destroyed) break;
      res.write(chunk);
    }
    res.end();
  } catch (err) {
    res.write(`data: ${JSON.stringify({ type: 'error', error: err.message })}\n\n`);
    res.end();
  }
});

// ── Research with live web search ─────────────────────────────────────────────
app.post('/api/research', async (req, res) => {
  const key = getKey(req);
  if (!key) return res.status(400).json({ error: 'No API key.' });

  const { query, system } = req.body;
  let messages = [{ role: 'user', content: query }];
  let maxIter  = 8;

  const call = async (msgs) => {
    const r = await fetch(API_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': key,
        'anthropic-version': '2023-06-01',
        'anthropic-beta': 'web-search-2025-03-05',
      },
      body: JSON.stringify({
        model: model(),
        max_tokens: 4096,
        tools: [{ type: 'web_search_20250305', name: 'web_search', max_uses: 5 }],
        system,
        messages: msgs,
      }),
    });
    if (!r.ok) {
      const e = await r.json().catch(() => ({}));
      throw new Error(e.error?.message || `HTTP ${r.status}`);
    }
    return r.json();
  };

  try {
    while (maxIter-- > 0) {
      const data = await call(messages);

      messages.push({ role: 'assistant', content: data.content });

      if (data.stop_reason === 'end_turn') {
        const text = data.content.filter(b => b.type === 'text').map(b => b.text).join('');
        return res.json({ text, webSearch: true });
      }

      if (data.stop_reason === 'tool_use') {
        const toolUses = data.content.filter(b => b.type === 'tool_use');
        const results  = toolUses.map(tu => ({
          type: 'tool_result',
          tool_use_id: tu.id,
          content: tu.output ? JSON.stringify(tu.output) : 'Search completed.',
        }));
        if (results.length) { messages.push({ role: 'user', content: results }); continue; }
      }

      // Fallback — extract whatever text we have
      const text = (data.content || []).filter(b => b.type === 'text').map(b => b.text).join('');
      return res.json({ text, webSearch: true });
    }

    res.status(500).json({ error: 'Research loop exceeded limit.' });
  } catch (err) {
    // Gracefully fall back: tell client to retry without web search
    res.status(422).json({ error: err.message, fallback: true });
  }
});

// ── Serve jarvis at root ──────────────────────────────────────────────────────
app.get('/', (req, res) => res.sendFile(path.join(__dirname, 'jarvis.html')));

app.listen(PORT, () => {
  console.log('\n  ╔══════════════════════════════════════╗');
  console.log('  ║  ⬡  J.A.R.V.I.S. ONLINE             ║');
  console.log(`  ║     http://localhost:${PORT}             ║`);
  console.log(`  ║     Model: ${model().padEnd(26)}║`);
  console.log(`  ║     API Key: ${process.env.ANTHROPIC_API_KEY ? '✓ Configured'.padEnd(25) : '✗ Not set (add to .env)'.padEnd(25)}║`);
  console.log('  ╚══════════════════════════════════════╝\n');
});
