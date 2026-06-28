import { execSync } from 'child_process';
import { mkdirSync, existsSync, readFileSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import os from 'os';
import express from 'express';
import cors from 'cors';

const __dirname = dirname(fileURLToPath(import.meta.url));
const app = express();
app.use(cors());

const scriptsDir = __dirname;
const outputDir = join(os.tmpdir(), 'nasikh-scans');
mkdirSync(outputDir, { recursive: true });

const runPowershell = (script, args = '') => {
  const cmd = `powershell -NoProfile -ExecutionPolicy Bypass -File "${join(scriptsDir, script)}" ${args}`;
  try {
    return { ok: true, data: execSync(cmd, { timeout: 30000, encoding: 'utf8' }).trim() };
  } catch (e) {
    return { ok: false, error: e.stderr || e.message };
  }
};

app.get('/status', (req, res) => {
  const result = runPowershell('status.ps1');
  if (!result.ok) {
    res.json({ status: 'error', detail: result.error });
    return;
  }
  const parts = result.data.split('|');
  const code = parts[0];
  if (code === 'OK') {
    res.json({ status: 'ok', name: parts[2] || 'Scanner' });
  } else if (code === 'NO_SCANNER') {
    res.json({ status: 'no_scanner' });
  } else {
    res.json({ status: 'error', detail: parts.slice(1).join('|') });
  }
});

app.get('/scan', async (req, res) => {
  res.writeHead(200, {
    'Content-Type': 'text/event-stream',
    'Cache-Control': 'no-cache',
    'Connection': 'keep-alive'
  });
  res.write('data: {"step": "scanning"}\n\n');

  const outputFile = join(outputDir, `scan_${Date.now()}.jpg`);
  const result = runPowershell('scan.ps1', `-OutputPath "${outputFile}"`);

  if (!result.ok) {
    res.write('data: ' + JSON.stringify({ step: 'error', message: result.error }) + '\n\n');
    res.end();
    return;
  }

  const lines = result.data.split('\n');
  // Find last non-DEBUG, non-empty line
  const imagePath = lines.filter(l => !l.startsWith('DEBUG') && l.trim() !== '').pop()?.trim() || lines[lines.length - 1].trim();

  if (imagePath.startsWith('ERROR')) {
    res.write('data: ' + JSON.stringify({ step: 'error', message: imagePath.replace('ERROR:', '') }) + '\n\n');
    res.end();
    return;
  }

  if (!existsSync(imagePath)) {
    res.write('data: ' + JSON.stringify({ step: 'error', message: `Output file not found: ${imagePath}` }) + '\n\n');
    res.end();
    return;
  }

  const base64 = readFileSync(imagePath, { encoding: 'base64' });
  res.write('data: ' + JSON.stringify({ step: 'done', image: `data:image/jpeg;base64,${base64}` }) + '\n\n');
  res.end();
});

app.listen(57575, () => {
  console.log('Nasikh Scan Server running on http://localhost:57575');
});
