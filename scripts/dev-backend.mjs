import { spawn } from "node:child_process";
import { existsSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const rootDir = dirname(dirname(fileURLToPath(import.meta.url)));
const backendDir = join(rootDir, "backend");
const pythonPath = join(backendDir, ".venv", "bin", "python");

if (!existsSync(pythonPath)) {
  console.error("Backend virtual environment not found at backend/.venv.");
  console.error("Create it with: cd backend && python3 -m venv .venv && . .venv/bin/activate && pip install -r requirements.txt");
  process.exit(1);
}

const child = spawn(
  pythonPath,
  ["-m", "uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "8000"],
  {
    cwd: backendDir,
    env: {
      ...process.env,
      PYTHONPYCACHEPREFIX: join(backendDir, ".pycache"),
    },
    stdio: "inherit",
  },
);

child.on("exit", (code, signal) => {
  if (signal) {
    process.kill(process.pid, signal);
    return;
  }
  process.exit(code ?? 0);
});
