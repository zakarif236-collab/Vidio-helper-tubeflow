import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { spawnSync } from "node:child_process";

const FIREBASE_EMULATOR_PORTS = [4000, 4400, 4500, 8081, 9099, 9151, 9199];

function runCommand(command, args) {
  return spawnSync(command, args, {
    encoding: "utf8",
    stdio: ["ignore", "pipe", "pipe"],
  });
}

function getWindowsPidsForPort(port) {
  const result = runCommand("netstat", ["-ano", "-p", "tcp"]);
  if (result.error) {
    throw result.error;
  }

  if (result.status !== 0) {
    throw new Error(result.stderr.trim() || `netstat exited with code ${result.status}`);
  }

  const pids = new Set();
  const portSuffix = `:${port}`;

  for (const line of result.stdout.split(/\r?\n/)) {
    const trimmedLine = line.trim();
    if (!trimmedLine.startsWith("TCP")) {
      continue;
    }

    const columns = trimmedLine.split(/\s+/);
    if (columns.length < 5) {
      continue;
    }

    const localAddress = columns[1];
    const pid = columns[4];

    if (localAddress.endsWith(portSuffix)) {
      pids.add(pid);
    }
  }

  return [...pids];
}

function killPid(pid) {
  const result = runCommand("taskkill", ["/PID", pid, "/T", "/F"]);

  if (result.error) {
    throw result.error;
  }

  const combinedOutput = [result.stdout, result.stderr].filter(Boolean).join("\n").trim();
  if (result.status !== 0) {
    throw new Error(combinedOutput || `taskkill exited with code ${result.status}`);
  }

  return combinedOutput;
}

async function removeHubLocatorFiles() {
  const tempDir = os.tmpdir();
  const entries = await fs.readdir(tempDir, { withFileTypes: true });
  const hubFiles = entries.filter((entry) => entry.isFile() && /^hub-.*\.json$/i.test(entry.name));

  await Promise.all(
    hubFiles.map((entry) =>
      fs.rm(path.join(tempDir, entry.name), { force: true }).catch(() => undefined)
    )
  );

  return hubFiles.length;
}

async function main() {
  if (process.platform !== "win32") {
    console.error("This stop script currently supports Windows only.");
    process.exit(1);
  }

  const stopped = [];
  const seenPids = new Set();

  for (const port of FIREBASE_EMULATOR_PORTS) {
    const pids = getWindowsPidsForPort(port);

    for (const pid of pids) {
      if (seenPids.has(pid)) {
        continue;
      }

      const output = killPid(pid);
      seenPids.add(pid);
      stopped.push({ pid, port, output });
    }
  }

  const removedHubFiles = await removeHubLocatorFiles();

  if (stopped.length === 0) {
    console.log("No Firebase emulator processes were running.");
  } else {
    for (const entry of stopped) {
      console.log(`Stopped PID ${entry.pid} on emulator port ${entry.port}.`);
    }
  }

  if (removedHubFiles > 0) {
    console.log(`Removed ${removedHubFiles} stale Firebase hub locator file(s).`);
  }
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exit(1);
});