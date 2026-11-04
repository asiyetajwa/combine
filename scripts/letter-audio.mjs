// Records the founder's letter in Brian's ElevenLabs voice, the same voice, model and settings as the
// Creamsoda letter (asiyetajwa/creamsoda scripts/letter-audio.mjs).
// Runs in GitHub Actions (.github/workflows/letter-audio.yml), where the API key lives as a secret;
// the key is never printed, committed or sent anywhere but api.elevenlabs.io.
//
// Reads letter/letter.json and letter/letter-narration.json. Writes assets/letter-audio.mp3,
// letter/letter-audio.json (the record, with a hash so unchanged text is not recorded twice) and
// assets/letter-audio.js (the same record for founder.html, which shows the player once it exists).
import { createHash } from 'crypto';
import { readFileSync, writeFileSync } from 'fs';

const API = 'https://api.elevenlabs.io/v1';
const KEY = process.env.ELEVENLABS_API_KEY;
const VOICE_NAME = (process.env.VOICE_NAME || "Brian's Voice").trim();
const VOICE_ID = (process.env.VOICE_ID || '').trim();
// v3 performs the directions in letter/letter-narration.json; it takes about 3,000 characters per request,
// so the letter is recorded in parts and joined.
const MODEL = process.env.MODEL || 'eleven_v3';
const CHUNK = 1600;
const FORCE = process.env.FORCE === 'true';

if (!KEY) {
  console.log('::warning::No ElevenLabs key yet: add a repository secret (Settings, Secrets and variables, Actions) named ELEVENLABS_API_KEY, then run Actions > Letter audio > Run workflow. Nothing recorded.');
  process.exit(0);
}

const { segments: blocks } = JSON.parse(readFileSync('letter/letter.json', 'utf8'));
let meta = {};
try { meta = JSON.parse(readFileSync('letter/letter-audio.json', 'utf8')); } catch { meta = {}; }
let narration = {};
try { narration = JSON.parse(readFileSync('letter/letter-narration.json', 'utf8')); } catch { narration = {}; }

const segments = blocks.map((b) => ({ id: b.id, text: narration[b.id] ?? b.text }));
const text = segments.map((s) => s.text).join('\n\n');

const chunks = [];
for (const s of segments) {
  const last = chunks[chunks.length - 1];
  if (last && last.text.length + 2 + s.text.length <= CHUNK) { last.marks.push({ id: s.id, at: last.text.length + 2 }); last.text += `\n\n${s.text}`; }
  else chunks.push({ text: s.text, marks: [{ id: s.id, at: 0 }] });
}

// The Creamsoda settings: v3 stability 0 is Creative (most expressive).
const SETTINGS = MODEL === 'eleven_v3' ? { stability: 0.0, similarity_boost: 0.85, use_speaker_boost: true } : { stability: 0.45, similarity_boost: 0.85, style: 0.75, use_speaker_boost: true, speed: 1.1 };
const hash = createHash('sha256').update(`${MODEL}\n${JSON.stringify(SETTINGS)}\n${VOICE_ID || VOICE_NAME}\n${text}`).digest('hex').slice(0, 16);
if (!FORCE && meta.src && meta.hash === hash) {
  console.log('Letter text unchanged since the last recording; nothing to do.');
  process.exit(0);
}

const headers = { 'xi-api-key': KEY, 'content-type': 'application/json' };

async function pickVoice() {
  if (VOICE_ID) return { voice_id: VOICE_ID, name: VOICE_NAME, category: 'given' };
  const res = await fetch(`${API}/voices`, { headers });
  if (!res.ok) throw new Error(`Listing voices failed: HTTP ${res.status} ${await res.text()}`);
  const { voices } = await res.json();
  const named = voices.filter((v) => (v.name || '').trim().toLowerCase() === VOICE_NAME.toLowerCase());
  // ElevenLabs ships a stock voice also called Brian; only Brian's own voice will do.
  const own = named.filter((v) => v.category !== 'premade');
  console.log(`Voices named "${VOICE_NAME}": ${named.map((v) => `${v.voice_id} (${v.category})`).join(', ') || 'none'}`);
  if (!own.length) throw new Error(`No voice of your own named "${VOICE_NAME}" in this ElevenLabs account. Run the workflow with a voice_id instead.`);
  own.sort((a, b) => (b.created_at_unix || 0) - (a.created_at_unix || 0));
  return own[0];
}

const voice = await pickVoice();
console.log(`Using voice ${voice.voice_id} (${voice.category}), ${text.length} characters.`);

const stripId3 = (buf) => {
  if (buf.slice(0, 3).toString() !== 'ID3') return buf;
  const size = ((buf[6] & 0x7f) << 21) | ((buf[7] & 0x7f) << 14) | ((buf[8] & 0x7f) << 7) | (buf[9] & 0x7f);
  return buf.slice(10 + size);
};
const parts = [];
const marks = [];
let offset = 0;
for (const [n, c] of chunks.entries()) {
  let out;
  for (let attempt = 1; attempt <= 3; attempt += 1) {
    const res = await fetch(`${API}/text-to-speech/${voice.voice_id}/with-timestamps?output_format=mp3_44100_128`, {
      method: 'POST', headers, body: JSON.stringify({ text: c.text, model_id: MODEL, voice_settings: SETTINGS }),
    });
    if (res.ok) { out = await res.json(); break; }
    const why = `HTTP ${res.status} ${await res.text()}`;
    if (attempt === 3) throw new Error(`Text to speech failed on part ${n + 1}: ${why}`);
    console.log(`Part ${n + 1} failed (${why.slice(0, 120)}), retrying.`);
  }
  const audio = stripId3(Buffer.from(out.audio_base64, 'base64'));
  const starts = out.alignment.character_start_times_seconds;
  for (const m of c.marks) marks.push({ id: m.id, start: Math.round((offset + (starts[Math.min(m.at, starts.length - 1)] || 0)) * 100) / 100 });
  parts.push(audio);
  offset += (audio.length * 8) / 128000;
  console.log(`Part ${n + 1} of ${chunks.length}: ${c.text.length} characters, ${((audio.length * 8) / 128000).toFixed(1)}s.`);
}
const audio = Buffer.concat(parts);
writeFileSync('assets/letter-audio.mp3', audio);
const duration = Math.round(offset * 10) / 10;

const record = {
  src: 'assets/letter-audio.mp3',
  hash,
  voice: { name: voice.name, category: voice.category, delivery: 'performed' },
  model: MODEL,
  settings: SETTINGS,
  duration,
  marks,
};
writeFileSync('letter/letter-audio.json', `${JSON.stringify(record, null, 2)}\n`);
writeFileSync('assets/letter-audio.js', `window.COMBINE_LETTER_AUDIO = ${JSON.stringify({ src: record.src, duration, marks })};\n`);
console.log(`Wrote assets/letter-audio.mp3 (${Math.round(audio.length / 1024)} KB, ${duration}s), letter/letter-audio.json and assets/letter-audio.js.`);
