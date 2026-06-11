import { spawn } from "node:child_process";
import { existsSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const rootDir = dirname(dirname(fileURLToPath(import.meta.url)));
const backendDir = join(rootDir, "backend");
const frontendDir = join(rootDir, "frontend");
const pythonPath = join(backendDir, ".venv", "bin", "python");

if (!existsSync(pythonPath)) {
  console.error("Backend virtual environment not found at backend/.venv.");
  console.error("Create it with: cd backend && python3 -m venv .venv && . .venv/bin/activate && pip install -r requirements.txt");
  process.exit(1);
}

const processes = [
  start("backend", pythonPath, ["-m", "uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "8000"], {
    cwd: backendDir,
    env: {
      ...process.env,
      PYTHONPYCACHEPREFIX: join(backendDir, ".pycache"),
    },
  }),
  start("frontend", "pnpm", ["dev"], {
    cwd: frontendDir,
    env: process.env,
  }),
];

let shuttingDown = false;

for (const child of processes) {
  child.on("exit", (code, signal) => {
    if (shuttingDown) return;
    shuttingDown = true;

    if (signal) {
      console.log(`\n${child.name} stopped with ${signal}. Shutting down NOVA dev servers...`);
    } else if (code && code !== 0) {
      console.log(`\n${child.name} exited with code ${code}. Shutting down NOVA dev servers...`);
    } else {
      console.log(`\n${child.name} exited. Shutting down NOVA dev servers...`);
    }

    stopAll();
    process.exit(code ?? 0);
  });
}

for (const signal of ["SIGINT", "SIGTERM"]) {
  process.on(signal, () => {
    if (shuttingDown) return;
    shuttingDown = true;
    console.log("\nShutting down NOVA dev servers...");
    stopAll(signal);
  });
}

function start(name, command, args, options) {
  const child = spawn(command, args, {
    ...options,
    stdio: ["inherit", "pipe", "pipe"],
  });

  child.name = name;
  prefixOutput(name, child.stdout);
  prefixOutput(name, child.stderr);
  return child;
}

function prefixOutput(name, stream) {
  let carry = "";
  stream.setEncoding("utf8");
  stream.on("data", (chunk) => {
    carry += chunk;
    const lines = carry.split(/\r?\n/);
    carry = lines.pop() ?? "";
    for (const line of lines) {
      console.log(`[${name}] ${line}`);
    }
  });
  stream.on("end", () => {
    if (carry) {
      console.log(`[${name}] ${carry}`);
    }
  });
}

function stopAll(signal = "SIGTERM") {
  for (const child of processes) {
    if (!child.killed) {
      child.kill(signal);
    }
  }
}
