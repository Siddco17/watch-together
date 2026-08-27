'use strict';

const { spawn } = require('child_process');
const http = require('http');
const path = require('path');

const root = path.join(__dirname, '..');
process.chdir(root);

const PORT = process.env.PORT || 3000;
const url = `http://localhost:${PORT}`;

function openBrowser(target) {
  const { platform } = process;
  if (platform === 'darwin') spawn('open', [target], { detached: true, stdio: 'ignore' });
  else if (platform === 'win32') spawn('cmd', ['/c', 'start', '', target], { detached: true, stdio: 'ignore' });
  else spawn('xdg-open', [target], { detached: true, stdio: 'ignore' });
}

function waitForServer(tries = 40) {
  const req = http.get(`${url}/api/health`, (res) => {
    res.resume();
    openBrowser(url);
  });
  req.on('error', () => {
    if (tries <= 0) return;
    setTimeout(() => waitForServer(tries - 1), 250);
  });
}

const child = spawn(process.execPath, [path.join(root, 'server/index.js')], {
  stdio: 'inherit',
  env: process.env,
});
setTimeout(waitForServer, 200);
child.on('exit', (code) => process.exit(code || 0));
