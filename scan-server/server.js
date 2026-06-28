import { execSync } from 'child_process';
import { writeFileSync, mkdirSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import express from 'express';
import cors from 'cors';

const __dirname = dirname(fileURLToPath(import.meta.url));
const app = express();
app.use(cors());

const scanScriptPath = join(__dirname, 'scan.ps1');
const outputDir = join(__dirname, 'scans');
mkdirSync(outputDir, { recursive: true });

app.get('/status', (req, res) => {
  try {
    const result = execSync(
      `powershell -NoProfile -Command "try { $m = New-Object -ComObject WIA.DeviceManager; $d = $m.DeviceInfos | Where-Object { \\$_.Type -eq 2 } | Select-Object -First 1; if ($d) { 'ok' } else { 'no_scanner' } } catch { 'error' }"`,
      { timeout: 10000, encoding: 'utf8' }
    );
    res.json({ status: result.trim() });
  } catch {
    res.json({ status: 'error' });
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
    const command = `powershell -NoProfile -ExecutionPolicy Bypass -File "${scanScriptPath}" -OutputPath "${outputFile}"`;
    const result = execSync(command, { timeout: 60000, encoding: 'utf8' });
    const lines = result.trim().split('\n');
    const imagePath = lines[lines.length - 1].trim();

    if (!imagePath || !imagePath.endsWith('.jpg')) {
      res.write(`data: {"step": "error", "message": "${(imagePath || 'Scan failed').replace(/"/g, '\\"')}"}\n\n`);
      res.end();
      return;
    }

    const fs = await import('fs');
    if (!fs.existsSync(imagePath)) {
      res.write('data: {"step": "error", "message": "Output file not found"}\n\n');
      res.end();
      return;
    }

    const base64 = fs.readFileSync(imagePath, { encoding: 'base64' });
    res.write(`data: {"step": "done", "image": "data:image/jpeg;base64,${base64}"}\n\n`);
    res.end();
  } catch (e) {
    res.write(`data: {"step": "error", "message": "Scanner error: ${e.message.replace(/"/g, '\\"')}"}\n\n`);
    res.end();
  }
});

app.listen(57575, () => {
  console.log('Nasikh Scan Server running on http://localhost:57575');
});
