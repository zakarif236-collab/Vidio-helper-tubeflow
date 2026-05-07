import fs from 'fs';
import net from 'net';
import path from 'path';
import { spawn } from 'child_process';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const workspaceRoot = path.resolve(__dirname, '..');
const emulatorDataDir = path.join(workspaceRoot, '.firebase', 'emulator-data');

fs.mkdirSync(emulatorDataDir, { recursive: true });

function waitForPort(port, host = '127.0.0.1', timeoutMs = 30_000) {
  const startedAt = Date.now();

  return new Promise((resolve, reject) => {
    const attempt = () => {
      const socket = net.connect({ port, host });

      socket.once('connect', () => {
        socket.end();
        resolve();
      });

      socket.once('error', () => {
        socket.destroy();

        if (Date.now() - startedAt >= timeoutMs) {
          reject(new Error(`Timed out waiting for ${host}:${port}`));
          return;
        }

        setTimeout(attempt, 500);
      });
    };

    attempt();
  });
}

function runSeed() {
  return new Promise((resolve, reject) => {
    const nodeCommand = process.execPath;
    const child = spawn(nodeCommand, [path.join(workspaceRoot, 'scripts', 'seed-maintenance-config.mjs')], {
      cwd: workspaceRoot,
      stdio: 'inherit',
      env: {
        ...process.env,
        FIRESTORE_EMULATOR_HOST: '127.0.0.1:8081',
        GCLOUD_PROJECT: process.env.GCLOUD_PROJECT || process.env.FIREBASE_PROJECT_ID || process.env.VITE_FIREBASE_PROJECT_ID || 'video-helper-21817',
      },
    });

    child.once('exit', (code) => {
      if (code === 0) {
        resolve();
        return;
      }

      reject(new Error(`Maintenance seed exited with code ${code ?? 'unknown'}`));
    });

    child.once('error', reject);
  });
}

const emulatorCommand = process.platform === 'win32'
  ? {
      command: 'cmd.exe',
      args: [
        '/d',
        '/s',
        '/c',
        'npx firebase emulators:start --only auth,firestore,storage --import=.firebase/emulator-data --export-on-exit=.firebase/emulator-data',
      ],
    }
  : {
      command: 'npx',
      args: [
        'firebase',
        'emulators:start',
        '--only',
        'auth,firestore,storage',
        '--import=.firebase/emulator-data',
        '--export-on-exit=.firebase/emulator-data',
      ],
    };

const emulatorProcess = spawn(emulatorCommand.command, emulatorCommand.args, {
  cwd: workspaceRoot,
  stdio: 'inherit',
  env: process.env,
});

let shuttingDown = false;

function forwardSignal(signal) {
  if (shuttingDown) {
    return;
  }

  shuttingDown = true;
  if (!emulatorProcess.killed) {
    emulatorProcess.kill(signal);
  }
}

process.on('SIGINT', () => forwardSignal('SIGINT'));
process.on('SIGTERM', () => forwardSignal('SIGTERM'));

emulatorProcess.once('error', (error) => {
  console.error('Failed to start Firebase emulators.');
  console.error(error);
  process.exitCode = 1;
});

emulatorProcess.once('exit', (code) => {
  process.exitCode = code ?? 0;
});

waitForPort(8081)
  .then(() => runSeed())
  .catch((error) => {
    console.error('Failed to prepare emulator maintenance config.');
    console.error(error);
    process.exitCode = 1;
    forwardSignal('SIGINT');
  });