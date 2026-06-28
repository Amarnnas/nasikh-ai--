import { execSync } from 'child_process';
import { mkdirSync, existsSync, readFileSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import express from 'express';
import cors from 'cors';

const __dirname = dirname(fileURLToPath(import.meta.url));
const app = express();
app.use(cors());

const scriptsDir = __dirname;
const outputDir = join(__dirname, 'scans');
mkdirSync(outputDir, { recursive: true });

const runPowershell = (script, args = '') => {
  const cmd = `powershell -NoProfile -ExecutionPolicy Bypass -File "${join(scriptsDir, script)}" ${args}`;
  return execSync(cmd, { timeout: 30000, encoding: 'utf8' }).trim();
};

app.get('/status', (req, res) => {
  try {
    const result = runPowershell('status.ps1');
    const parts = result.split('|');
    const code = parts[0];

    if (code === 'OK') {
      res.json({ status: 'ok', name: parts[1] || 'Scanner' });
    } else if (code === 'NO_SCANNER') {
      res.json({ status: 'no_scanner' });
    } else {
      res.json({ status: 'error', detail: parts.slice(1).join('|') });
    }
  } catch (e) {
    res.json({ status: 'error', detail: e.message });
  }
});

app.get('/scan', async (req, res) => {
  try {
    res.writeHead(200, {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      'Connection': 'keep-alive'
    });
    res.write('data: {"step": "scanning"}\n\n');

    const outputFile = join(outputDir, `scan_${Date.now()}.jpg`);
    const result = runPowershell('scan.ps1', `-OutputPath "${outputFile}"`);
    const lines = result.split('\n');
    const imagePath = lines[lines.length - 1].trim();

    if (imagePath.startsWith('ERROR')) {
      res.write(`data: ${JSON.stringify({ step: 'error', message: imagePath.replace('ERROR:', '') })}\n\n`);
      res.end();
      return;
    }

    if (!existsSync(imagePath)) {
      res.write('data: {"step": "error", "message": "Output file not found"}\n\n');
      res.end();
      return;
    }

    const base64 = readFileSync(imagePath, { encoding: 'base64' });
    res.write(`data: ${JSON.stringify({ step: 'done', image: `data:image/jpeg;base64,${base64}` })}\n\n`);
    res.end();
  } catch (e) {
    res.write(`data: ${JSON.stringify({ step: 'error', message: e.message })}\n\n`);
    res.end();
  }
});

app.listen(57575, () => {
  console.log('Nasikh Scan Server running on http://localhost:57575');
});
