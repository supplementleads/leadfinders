'use strict';

// ── Load .env with BOM fix for Windows Notepad ────────────────────────────────
require('dotenv').config();
if (!process.env.ANTHROPIC_API_KEY) {
  try {
    const fs  = require('fs');
    const raw = fs.readFileSync('.env', 'utf8').replace(/^﻿/, '');
    raw.split(/\r?\n/).forEach(line => {
      const eq = line.indexOf('=');
      if (eq > 0) {
        const k = line.slice(0, eq).trim();
        const v = line.slice(eq + 1).trim().replace(/^["']|["']$/g, '');
        if (k && !process.env[k]) process.env[k] = v;
      }
    });
  } catch {}
}

const express = require('express');
const path    = require('path');
const app     = express();

app.use(express.json({ limit: '4mb' }));
app.use(express.static(__dirname));

const API_URL = 'https://api.anthropic.com/v1/messages';
const PORT    = parseInt(process.env.PORT || '3000');

function getKey(req) {
  return process.env.ANTHROPIC_API_KEY || req.headers['x-client-key'] || '';
}
function getModel() {
  return process.env.MODEL || 'claude-opus-4-8';
}
function getBriefingHour() {
  return parseInt(process.env.BRIEFING_HOUR || '8');
}

// ── SSE push: server → browser ────────────────────────────────────────────────
const clients = new Set();

app.get('/api/events', (req, res) => {
  res.setHeader('Content-Type',  'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection',    'keep-alive');
  res.flushHeaders();
  res.write('data: {"type":"connected"}\n\n');

  const heartbeat = setInterval(() => {
    if (!res.destroyed) res.write('data: {"type":"ping"}\n\n');
  }, 25000);

  clients.add(res);
  req.on('close', () => { clients.delete(res); clearInterval(heartbeat); });
});

function pushAll(type, payload) {
  if (clients.size === 0) return;
  const msg = `data: ${JSON.stringify({ type, ...payload })}\n\n`;
  for (const client of clients) {
    if (!client.destroyed) client.write(msg);
  }
}

// ── Health ────────────────────────────────────────────────────────────────────
app.get('/api/status', (req, res) => {
  res.json({
    online:   true,
    model:    getModel(),
    hasKey:   !!process.env.ANTHROPIC_API_KEY,
    version:  '3.0.0',
    briefing: { hour: getBriefingHour(), enabled: process.env.BRIEFING_ENABLED !== 'false' },
  });
});

// ── Streaming chat proxy ──────────────────────────────────────────────────────
app.post('/api/chat', async (req, res) => {
  const key = getKey(req);
  if (!key) return res.status(400).json({ error: 'No API key. Set ANTHROPIC_API_KEY in .env' });

  res.setHeader('Content-Type',  'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection',    'keep-alive');
  res.flushHeaders();

  try {
    const upstream = await fetch(API_URL, {
      method: 'POST',
      headers: {
        'Content-Type':    'application/json',
        'x-api-key':       key,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify({
        model:    req.body.model || getModel(),
        max_tokens: 2048,
        stream:   true,
        system:   req.body.system,
        messages: req.body.messages,
      }),
    });

    if (!upstream.ok) {
      const err = await upstream.json().catch(() => ({}));
      res.write(`data: ${JSON.stringify({ type:'error', error: err.error?.message || `HTTP ${upstream.status}` })}\n\n`);
      return res.end();
    }

    for await (const chunk of upstream.body) {
      if (res.destroyed) break;
      res.write(chunk);
    }
    res.end();
  } catch (err) {
    res.write(`data: ${JSON.stringify({ type:'error', error: err.message })}\n\n`);
    res.end();
  }
});

// ── Research with live web search ─────────────────────────────────────────────
async function runResearch(query, system, key) {
  let messages = [{ role:'user', content: query }];
  let maxIter  = 8;

  while (maxIter-- > 0) {
    const r = await fetch(API_URL, {
      method: 'POST',
      headers: {
        'Content-Type':    'application/json',
        'x-api-key':       key,
        'anthropic-version': '2023-06-01',
        'anthropic-beta':  'web-search-2025-03-05',
      },
      body: JSON.stringify({
        model:      getModel(),
        max_tokens: 4096,
        tools:      [{ type:'web_search_20250305', name:'web_search', max_uses:5 }],
        system,
        messages,
      }),
    });

    if (!r.ok) {
      const e = await r.json().catch(() => ({}));
      throw new Error(e.error?.message || `HTTP ${r.status}`);
    }

    const data = await r.json();
    messages.push({ role:'assistant', content: data.content });

    if (data.stop_reason === 'end_turn') {
      return data.content.filter(b => b.type === 'text').map(b => b.text).join('');
    }

    if (data.stop_reason === 'tool_use') {
      const results = data.content.filter(b => b.type === 'tool_use').map(tu => ({
        type: 'tool_result', tool_use_id: tu.id,
        content: tu.output ? JSON.stringify(tu.output) : 'Search complete.',
      }));
      if (results.length) { messages.push({ role:'user', content: results }); continue; }
    }

    return (data.content||[]).filter(b=>b.type==='text').map(b=>b.text).join('');
  }
  throw new Error('Max iterations reached');
}

app.post('/api/research', async (req, res) => {
  const key = getKey(req);
  if (!key) return res.status(400).json({ error: 'No API key.' });
  try {
    const text = await runResearch(req.body.query, req.body.system, key);
    res.json({ text, webSearch: true });
  } catch (err) {
    res.status(422).json({ error: err.message, fallback: true });
  }
});

// ── Autonomous briefing generator ─────────────────────────────────────────────
const BRIEFING_SYSTEM = `You are J.A.R.V.I.S., the AI operations system for a supplement company with four brands:
- HYPERVANT: Stimulant-free performance drink sticks (OXYGEN + CLARITY). Targets gyms, CrossFit, tactical.
- KRATOMLYTE: Kratom/kava/kanna botanical drink mixes. Targets smoke shops, kava bars.
- VYCE: Botanical mouth pouches. Targets smoke shops, vape shops, CBD stores.
- BLUHR: Kava drink mix (bluhrkava.com). Targets kava bars, wellness stores.

Generate a concise, spoken morning briefing. Keep it under 200 words. Start with "Good morning, sir." Cover:
1. A quick supplement/botanical market observation for today
2. One tactical sales action for each brand (brief)
3. A motivating close

Sound like JARVIS from Iron Man — confident, precise, British-adjacent, no fluff.`;

async function generateBriefing(key) {
  const now  = new Date();
  const day  = now.toLocaleDateString('en-US', { weekday:'long', month:'long', day:'numeric' });
  const r    = await fetch(API_URL, {
    method: 'POST',
    headers: {
      'Content-Type':    'application/json',
      'x-api-key':       key,
      'anthropic-version': '2023-06-01',
    },
    body: JSON.stringify({
      model:      getModel(),
      max_tokens: 400,
      system:     BRIEFING_SYSTEM,
      messages:   [{ role:'user', content:`Generate my daily briefing for ${day}. Be concise and spoken-word ready.` }],
    }),
  });
  const d = await r.json();
  return d.content?.find(b => b.type==='text')?.text || '';
}

// ── Scheduled tasks ───────────────────────────────────────────────────────────
let lastBriefingDay = -1;
let lastResearchDay = -1;

setInterval(async () => {
  const key = process.env.ANTHROPIC_API_KEY;
  if (!key || process.env.BRIEFING_ENABLED === 'false' || clients.size === 0) return;

  const now     = new Date();
  const hour    = now.getHours();
  const dayOfYr = Math.floor(now / 86400000);

  // Morning briefing
  if (hour === getBriefingHour() && dayOfYr !== lastBriefingDay) {
    lastBriefingDay = dayOfYr;
    console.log('[JARVIS] Generating morning briefing...');
    try {
      const text = await generateBriefing(key);
      pushAll('briefing', { text, time: now.toLocaleTimeString() });
      console.log('[JARVIS] Morning briefing pushed to', clients.size, 'client(s)');
    } catch (e) { console.error('[JARVIS] Briefing error:', e.message); }
  }

  // Daily market research push (2 hours after briefing)
  if (hour === (getBriefingHour() + 2) % 24 && dayOfYr !== lastResearchDay) {
    lastResearchDay = dayOfYr;
    console.log('[JARVIS] Running daily market research...');
    try {
      const query = 'Give me today\'s top 3 most important supplement industry developments — new products, market moves, regulatory news, or consumer trends — that a company selling performance supplements, botanical pouches, and kava drink mixes should know about right now. Be brief and actionable.';
      const text  = await runResearch(query, BRIEFING_SYSTEM, key);
      pushAll('market_alert', { text, time: now.toLocaleTimeString() });
      console.log('[JARVIS] Market research pushed to', clients.size, 'client(s)');
    } catch (e) { console.error('[JARVIS] Research error:', e.message); }
  }
}, 60 * 1000); // check every minute

// ── Manual trigger: POST /api/briefing ───────────────────────────────────────
app.post('/api/briefing', async (req, res) => {
  const key = getKey(req);
  if (!key) return res.status(400).json({ error: 'No API key.' });
  try {
    const text = await generateBriefing(key);
    pushAll('briefing', { text, time: new Date().toLocaleTimeString() });
    res.json({ text });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ── Serve Jarvis at root ──────────────────────────────────────────────────────
app.get('/', (req, res) => res.sendFile(path.join(__dirname, 'jarvis.html')));

app.listen(PORT, () => {
  console.log('\n  ╔══════════════════════════════════════════╗');
  console.log('  ║  ⬡  J.A.R.V.I.S. v3.0 ONLINE            ║');
  console.log(`  ║     http://localhost:${PORT}               ║`);
  console.log(`  ║     Model  : ${getModel().padEnd(27)}║`);
  console.log(`  ║     API Key: ${(process.env.ANTHROPIC_API_KEY ? '✓ Configured' : '✗ Not set (add to .env)').padEnd(27)}║`);
  console.log(`  ║     Briefing: ${String(getBriefingHour()).padStart(2,'0')}:00 daily              ║`);
  console.log('  ╚══════════════════════════════════════════╝\n');
  console.log('  Brands: Hypervant · KratomLyte · Vyce · Bluhr\n');
});
