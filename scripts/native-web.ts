/* Oberfläche für die iOS-App: aus dem Next-Build die vorgerenderte Trainingsseite und ihre
   statischen Dateien nach native/www kopieren – das ist Capacitors webDir.
   Die App braucht keinen Server für die Oberfläche; nur der Sync geht an die Live-Instanz.

     npm run native:build    (next build → dieses Skript → cap sync ios) */
import { cpSync, existsSync, mkdirSync, readFileSync, readdirSync, rmSync, statSync, writeFileSync } from "node:fs";

const root = new URL("../", import.meta.url);
const next = new URL(".next/", root), out = new URL("native/www/", root);
const page = new URL("server/app/index.html", next);
if (!existsSync(page)) throw new Error("Kein Build gefunden – erst `next build` ausführen.");

rmSync(out, { recursive: true, force: true });
mkdirSync(new URL("_next/", out), { recursive: true });
// data-native: CSS zeigt damit die Startanimation (Splash.tsx) schon im ersten Frame – nahtlos zum Startbild
writeFileSync(new URL("index.html", out), readFileSync(page, "utf8").replace("<html ", "<html data-native=\"\" "));
cpSync(new URL("static/", next), new URL("_next/static/", out), { recursive: true });
// 3D-Übungsclips (public/clips) gehören ins App-Paket – offline im Gym
if (existsSync(new URL("public/clips/", root))) cpSync(new URL("public/clips/", root), new URL("clips/", out), { recursive: true });
for (const f of ["apple-touch-icon.png"]) if (existsSync(new URL(`public/${f}`, root))) cpSync(new URL(`public/${f}`, root), new URL(f, out));
writeFileSync(new URL("build.txt", out), `${new Date().toISOString()}\n`);

const size = (u: URL): number => statSync(u).isDirectory()
  ? readdirSync(u).reduce((n, f) => n + size(new URL(f + (statSync(new URL(f, u)).isDirectory() ? "/" : ""), u)), 0)
  : statSync(u).size;
console.log(`native/www bereit (${(size(out) / 1024 / 1024).toFixed(1)} MB)`);
