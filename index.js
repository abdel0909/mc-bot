// index.js – Minecraft Bot (ENV-basiert, mit Pathfinding)
// Start: npm start
// .env: MC_HOST, MC_PORT, MC_USER, MC_AUTH ('offline' | 'microsoft'), optional MC_VERSION

import 'dotenv/config.js';
import mineflayer from 'mineflayer';
import pathfinderPkg from 'mineflayer-pathfinder'; // <-- CommonJS default import
const { pathfinder, Movements, goals } = pathfinderPkg; // destructure
import minecraftData from 'minecraft-data';

const {
  MC_HOST,
  MC_PORT = '25565',
  MC_USER = 'BotDemo',
  MC_AUTH = 'offline',
  MC_VERSION = ''
} = process.env;

if (!MC_HOST) {
  console.error('❌ MC_HOST fehlt in .env');
  process.exit(1);
}

let backoff = 5000;

function start() {
  console.log(`🚀 Starte Bot → ${MC_HOST}:${MC_PORT} als ${MC_USER} (auth=${MC_AUTH})`);

  const bot = mineflayer.createBot({
    host: MC_HOST,
    port: Number(MC_PORT),
    username: MC_USER,
    auth: MC_AUTH === 'microsoft' ? 'microsoft' : 'offline',
    version: MC_VERSION || false
  });

  // Plugins
  bot.loadPlugin(pathfinder);

  const say = (m) => { try { bot.chat(m); } catch {} };

  bot.once('spawn', () => {
    backoff = 5000;
    console.log('✅ Spawn – Bot ist online.');
    say('Hi! 🤖 Befehle: !help | !pos | !goto x y z | !come [name] | !dig | !stop');
  });

  bot.on('chat', async (username, msg) => {
    if (username === bot.username) return;
    const [cmd, ...args] = msg.trim().split(/\s+/);

    if (cmd === '!help') {
      say('!pos | !goto x y z | !come [name] | !dig | !stop');
    }

    if (cmd === '!pos') {
      const p = bot.entity.position;
      say(`Pos: ${p.x.toFixed(1)} ${p.y.toFixed(1)} ${p.z.toFixed(1)} (y=${p.y.toFixed(1)})`);
    }

    if (cmd === '!stop') {
      try { bot.pathfinder.setGoal(null); } catch {}
      bot.clearControlStates?.();
      say('⛔ Stop.');
    }

    if (cmd === '!goto' && args.length >= 3) {
      const [xs, ys, zs] = args;
      const x = Number(xs), y = Number(ys), z = Number(zs);
      if (!Number.isFinite(x) || !Number.isFinite(y) || !Number.isFinite(z)) return say('Nutze: !goto x y z');

      const mc = minecraftData(bot.version);
      const movements = new Movements(bot, mc);
      bot.pathfinder.setMovements(movements);
      say(`🧭 Gehe zu ${x} ${y} ${z} …`);
      bot.pathfinder.setGoal(new goals.GoalBlock(x, y, z));
    }

    if (cmd === '!come') {
      const targetName = args[0] || username;
      const target = bot.players[targetName]?.entity;
      if (!target) return say(`Spieler nicht gefunden: ${targetName}`);

      const mc = minecraftData(bot.version);
      const movements = new Movements(bot, mc);
      bot.pathfinder.setMovements(movements);
      say(`🏃 Komme zu ${targetName} …`);
      bot.pathfinder.setGoal(new goals.GoalNear(target.position.x, target.position.y, target.position.z, 1));
    }

    if (cmd === '!dig') {
      try {
        const dir = bot.entity.yaw;
        const front = bot.entity.position.offset(Math.cos(dir), 0, Math.sin(dir));
        let block = bot.blockAt(front);
        if (!block || block.name === 'air') block = bot.blockAt(bot.entity.position.offset(0, -1, 0));
        if (!block || block.name === 'air') return say('Kein Block vor mir.');
        if (!bot.canDigBlock(block)) return say(`Kann nicht abbauen: ${block.name}`);
        say(`⛏️ Baue: ${block.name}`);
        await bot.dig(block);
        say('Fertig.');
      } catch (e) {
        console.log('Dig-Fehler:', e?.message || e);
        say('Dig fehlgeschlagen.');
      }
    }
  });

  bot.on('kicked', r => console.log('🥾 Kicked:', r));
  bot.on('error', e => console.log('⚠️ Error:', e?.message || e));
  bot.on('end', () => {
    console.log(`🔁 Getrennt. Neuer Versuch in ${Math.floor(backoff/1000)}s …`);
    setTimeout(() => { backoff = Math.min(backoff * 2, 30000); start(); }, backoff);
  });
}

start();
