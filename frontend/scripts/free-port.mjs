import { execSync } from 'node:child_process';

function toUniqueIntegers(values) {
  const seen = new Set();
  const out = [];
  for (const value of values) {
    const num = Number.parseInt(String(value).trim(), 10);
    if (!Number.isInteger(num) || num <= 0 || seen.has(num)) {
      continue;
    }
    seen.add(num);
    out.push(num);
  }
  return out;
}

function parseWindowsListeningPids(netstatOutput, port) {
  const lines = netstatOutput.split(/\r?\n/);
  const pids = [];
  const pattern = new RegExp(`^\\s*TCP\\s+\\S+:${port}\\s+\\S+\\s+LISTENING\\s+(\\d+)\\s*$`, 'i');

  for (const line of lines) {
    const match = line.match(pattern);
    if (match) {
      pids.push(match[1]);
    }
  }

  return toUniqueIntegers(pids);
}

function getListeningPids(port) {
  try {
    if (process.platform === 'win32') {
      const output = execSync('netstat -ano -p tcp', { encoding: 'utf8' });
      return parseWindowsListeningPids(output, port);
    }

    const output = execSync(`lsof -nP -iTCP:${port} -sTCP:LISTEN -t`, {
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'ignore'],
    });
    return toUniqueIntegers(output.split(/\r?\n/));
  } catch {
    return [];
  }
}

function isAlive(pid) {
  try {
    process.kill(pid, 0);
    return true;
  } catch {
    return false;
  }
}

const port = Number.parseInt(process.argv[2] ?? '8080', 10);
if (!Number.isInteger(port) || port < 1 || port > 65535) {
  console.error('[free-port] Invalid port. Usage: node scripts/free-port.mjs <port>');
  process.exit(1);
}

const pids = getListeningPids(port);
if (pids.length === 0) {
  process.exit(0);
}

for (const pid of pids) {
  try {
    process.kill(pid, 'SIGTERM');
  } catch {
    // Ignore failures and continue trying other PIDs.
  }
}

for (const pid of pids) {
  if (!isAlive(pid)) {
    continue;
  }
  try {
    process.kill(pid, 'SIGKILL');
  } catch {
    // Ignore failures and validate remaining listeners below.
  }
}

const stillListening = getListeningPids(port);
if (stillListening.length > 0) {
  console.error(`[free-port] Could not free port ${port}. Still in use by PID(s): ${stillListening.join(', ')}`);
  process.exit(1);
}

console.log(`[free-port] Freed port ${port}. Stopped PID(s): ${pids.join(', ')}`);
