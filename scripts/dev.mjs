// Starts the API server and the Vite dev server with the same Node binary (no reliance on PATH).
import { spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const root = fileURLToPath(new URL('..', import.meta.url));
const run = (name, args, env = {}) => {
  const p = spawn(process.execPath, args, { cwd: root, stdio: ['ignore', 'pipe', 'pipe'], env: { ...process.env, ...env } });
  const tag = (d) => d.toString().split(/\r?\n/).filter(Boolean).map((l) => `[${name}] ${l}`).join('\n') + '\n';
  p.stdout.on('data', (d) => process.stdout.write(tag(d)));
  p.stderr.on('data', (d) => process.stderr.write(tag(d)));
  p.on('exit', (code) => { console.log(`[${name}] exited with ${code}`); process.exit(code ?? 1); });
  return p;
};

const procs = [
  // PORT (if given by the environment) is for the web dev server; the API always listens on 8787, where Vite proxies /api.
  run('api', ['--watch', 'server/index.ts'], { PORT: '8787' }),
  run('web', ['node_modules/vite/bin/vite.js', '--port', process.env.PORT ?? '5173', '--strictPort']),
];
const stop = () => { for (const p of procs) p.kill(); process.exit(0); };
process.on('SIGINT', stop);
process.on('SIGTERM', stop);
