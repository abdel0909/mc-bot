// Minecraft Bot – Java (Mineflayer) + Auto-Build + Chat-Kommandos
// Start: npm start
// .env Variablen: MC_HOST, MC_PORT, MC_USER, MC_AUTH ('offline' | 'microsoft'), optional MC_VERSION

import 'dotenv/config.js';
import mineflayer from 'mineflayer';
import pathfinderPkg from 'mineflayer-pathfinder';   // CJS → Default import
const { pathfinder, Movements, goals } = pathfinderPkg;
import minecraftData from 'minecraft-data';

const {
  MC_HOST = 'yousra17.aternos.me',   // ← eure Aternos-Adresse
  MC_PORT = '25565',                 // ← Java-Port für den Bot
  MC_USER = 'BotDemo',
  MC_AUTH = 'offline',               // 'offline' (Cracked) ODER 'microsoft'
  MC_VERSION = ''                    // z. B. '1.20.1' (leer = Auto)
} = process.env;

if (!MC_HOST) {
  console.error('❌ MC_HOST fehlt in .env'); process.exit(1);
}

const sleep = ms => new Promise(r => setTimeout(r, ms));

// ---- Auto-Build: einfachen Turm hochziehen (10 Blöcke)
function pickBuildItem(bot) {
  const ok = it =>
    it?.name?.includes('planks') ||
    it?.name?.includes('stone') ||
    it?.name?.includes('cobblestone') ||
    it?.name?.includes('dirt') ||
    it?.name?.includes('sandstone') ||
    it?.name?.includes('netherrack');
  return bot.inventory.items().find(ok);
}
async function equipBuildItem(bot) {
  const item = pickBuildItem(bot);
  if (!item) throw new Error('Kein Baublock im Inventar (z.B. Cobblestone/Planks).');
  await bot.equip(item, 'hand');
}
async function buildTower(bot, height = 10) {
  await equipBuildItem(bot);
  bot.chat(`🏗️ Baue automatisch einen Turm (Höhe ${height}) …`);
  for (let i = 0; i < height; i++) {
    try {
      // Block unter sich platzieren → springen → wiederholen
      const below = bot.entity.position.offset(0, -1, 0);
      const base = bot.blockAt(below);
      if (!base) { bot.chat('Kein Block unter mir gefunden.'); break; }
      // Blick leicht nach unten hilft beim Platzieren
      await bot.look(0, Math.PI / 2, true);
      await bot.placeBlock(base, { x: 0, y: 1, z: 0 });
      bot.setControlState('jump', true);
      await sleep(450);
      bot.setControlState('jump', false);
      await sleep(250);
    } catch (e) {
      console.log('Auto-Build Fehler:', e?.message || e);
      bot.chat('❌ Konnte nicht weiter bauen.');
      break;
    }
  }
  bot.chat('✅ Turm fertig.');
}

// ---- Start + Reconnect
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

  bot.loadPlugin(pathfinder);

  bot.once('spawn', async () => {
    backoff = 5000;
    console.log('✅ Spawn – Bot ist online.');
    bot.chat('Hi! 🤖 !help | !pos | !goto x y z | !come [name] | !dig | !stop');
    // Demo: automatisch bauen (nach 2s)
    await sleep(2000);
    buildTower(bot, 10);
  });

  // Chat-Kommandos
  bot.on('chat', async (user, msg) => {
    if (user === bot.username) return;
    const [cmd, ...args] = msg.trim().split(/\s+/);
    const say = m => { try { bot.chat(m); } catch {} };

    if (cmd === '!help') return say('!pos | !goto x y z | !come [name] | !dig | !stop');

    if (cmd === '!pos') {
      const p = bot.entity.position;
      return say(`Pos: ${p.x.toFixed(1)} ${p.y.toFixed(1)} ${p.z.toFixed(1)} (y=${p.y.toFixed(1)})`);
    }

    if (cmd === '!stop') {
      try { bot.pathfinder.setGoal(null); } catch {}
      bot.clearControlStates?.();
      return say('⛔ Stop.');
    }

    if (cmd === '!goto' && args.length >= 3) {
      const [xs, ys, zs] = args;
      const x = Number(xs), y = Number(ys), z = Number(zs);
      if (![x,y,z].every(Number.isFinite)) return say('Nutze: !goto x y z');
      const mc = minecraftData(bot.version);
      const movements = new Movements(bot, mc);
      bot.pathfinder.setMovements(movements);
      say(`🧭 Gehe zu ${x} ${y} ${z} …`);
      return bot.pathfinder.setGoal(new goals.GoalBlock(x, y, z));
    }

    if (cmd === '!come') {
      const name = args[0] || user;
      const target = bot.players[name]?.entity;
      if (!target) return say(`Spieler nicht gefunden: ${name}`);
      const mc = minecraftData(bot.version);
      const movements = new Movements(bot, mc);
      bot.pathfinder.setMovements(movements);
      say(`🏃 Komme zu ${name} …`);
      return bot.pathfinder.setGoal(new goals.GoalNear(target.position.x, target.position.y, target.position.z, 1));
    }

    if (cmd === '!dig') {
      try {
        const dir = bot.entity.yaw;
        const front = bot.entity.position.offset(Math.cos(dir), 0, Math.sin(dir));
        let block = bot.blockAt(front);
        if (!block || block.name === 'air') block = bot.blockAt(bot.entity.position.offset(0, -1, 0));
        if (!block || block.name === 'air') return say('Kein Block zum Abbauen.');
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
