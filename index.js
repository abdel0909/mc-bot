// index.js – Minecraft Bot (Java) mit Pathfinding & Chat-Kommandos
// Start:   npm start
// Env:     MC_HOST, MC_PORT, MC_USER, MC_AUTH ('offline' | 'microsoft'), MC_VERSION (optional)

import 'dotenv/config.js';
import mineflayer from 'mineflayer';
import { pathfinder, Movements, goals } from 'mineflayer-pathfinder';
import minecraftData from 'minecraft-data';

const {
  MC_HOST = '',
  MC_PORT = '25565',
  MC_USER = 'BotDemo',
  MC_AUTH = 'offline',          // 'offline' (Cracked) oder 'microsoft'
  MC_VERSION = ''               // z.B. '1.20.1' (leer = Auto)
} = process.env;

if (!MC_HOST) {
  console.error('❌ MC_HOST ist nicht gesetzt. Beispiel:\n' +
    'export MC_HOST=DEINNAME.aternos.me\nexport MC_PORT=25565\nexport MC_USER=BotDemo\nexport MC_AUTH=offline');
  process.exit(1);
}

let reconnectDelay = 5000; // ms, wächst bei Fehlern bis 30s

function startBot() {
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

  // ---- Utils
  const say = (msg) => {
    try { bot.chat(msg); } catch {}
  };

  const safeNumber = (v) => {
    const n = Number(v);
    return Number.isFinite(n) ? n : null;
  };

  const helpText =
    'Befehle: !pos | !goto x y z | !come <spieler> | !stop | !dig | !say <text>';

  // ---- Events
  bot.once('spawn', () => {
    reconnectDelay = 5000;
    console.log('✅ Spawn – Bot ist online.');
    say('Hallo! 🤖 Tippe !help für Befehle.');
    // Grundbewegungen (AFK-Schutz light): alle 60s kurz springen
    setInterval(() => {
      try { bot.setControlState('jump', true); setTimeout(() => bot.setControlState('jump', false), 200); } catch {}
    }, 60000);
  });

  bot.on('chat', async (username, message) => {
    if (username === bot.username) return;
    const parts = message.trim().split(/\s+/);
    const cmd = parts[0]?.toLowerCase();

    if (cmd === '!help') {
      say(helpText);
      return;
    }

    if (cmd === '!pos') {
      const p = bot.entity.position;
      say(`Pos: ${p.x.toFixed(1)} ${p.y.toFixed(1)} ${p.z.toFixed(1)} (y=${p.y.toFixed(1)})`);
      return;
    }

    if (cmd === '!say') {
      const text = parts.slice(1).join(' ');
      if (text) say(text);
      return;
    }

    if (cmd === '!stop') {
      try { bot.pathfinder.setGoal(null); } catch {}
      say('⛔ Stop.');
      return;
    }

    if (cmd === '!goto' && parts.length >= 4) {
      const x = safeNumber(parts[1]);
      const y = safeNumber(parts[2]);
      const z = safeNumber(parts[3]);
      if (x === null || y === null || z === null) { say('Nutze: !goto x y z'); return; }

      const mc = minecraftData(bot.version);
      const movements = new Movements(bot, mc);
      bot.pathfinder.setMovements(movements);

      say(`🧭 Gehe zu ${x} ${y} ${z} …`);
      bot.pathfinder.setGoal(new goals.GoalBlock(x, y, z));
      return;
    }

    if (cmd === '!come') {
      const targetName = parts[1] || username; // Standard: zum Rufenden
      const target = bot.players[targetName]?.entity;
      if (!target) { say(`Spieler nicht gefunden: ${targetName}`); return; }

      const mc = minecraftData(bot.version);
      const movements = new Movements(bot, mc);
      bot.pathfinder.setMovements(movements);

      say(`🏃 Komme zu ${targetName} …`);
      bot.pathfinder.setGoal(new goals.GoalNear(target.position.x, target.position.y, target.position.z, 1));
      return;
    }

    if (cmd === '!dig') {
      try {
        // Baue den Block direkt vor dem Bot ab (oder unter ihm, falls Luft)
        const dir = bot.entity.yaw;
        const front = bot.entity.position.offset(Math.cos(dir), 0, Math.sin(dir));
        let block = bot.blockAt(front);
        if (!block || block.name === 'air') block = bot.blockAt(bot.entity.position.offset(0, -1, 0));
        if (!block || block.name === 'air') { say('Kein Block zum Abbauen.'); return; }
        if (!bot.canDigBlock(block)) { say(`Kann Block nicht abbauen: ${block.name}`); return; }

        say(`⛏️ Baue: ${block.name}`);
        await bot.dig(block);
        say('Fertig.');
      } catch (e) {
        console.log('Dig-Fehler:', e.message);
        say('Konnte nicht abbauen.');
      }
      return;
    }
  });

  bot.on('kicked', (reason) => {
    console.log('🥾 Kicked:', reason);
  });

  bot.on('error', (err) => {
    console.log('⚠️ Error:', err?.message || err);
  });

  bot.on('end', () => {
    console.log(`🔁 Verbindung verloren. Neuer Versuch in ${Math.floor(reconnectDelay/1000)}s …`);
    setTimeout(() => {
      reconnectDelay = Math.min(reconnectDelay * 2, 30000); // max 30s
      startBot();
    }, reconnectDelay);
  });
}

startBot();
