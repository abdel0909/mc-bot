import mineflayer from 'mineflayer';

// ---- SERVERDATEN ANPASSEN ----
const bot = mineflayer.createBot({
  host: process.env.MC_HOST || 'example.minecraftserver.com', // Server-Adresse
  port: Number(process.env.MC_PORT || 25565),                 // Port (Standard 25565)
  username: process.env.MC_USER || 'BotDemo',                 // Bei Premium-Servern: E-Mail statt Name + auth: 'microsoft'
  // auth: 'microsoft',                                       // falls Premium-Account / Online-Mode an
});

// Basic Logging
bot.once('spawn', () => {
  console.log('✅ Bot ist eingeloggt und gespawnt.');
  bot.chat('Hallo! Ich bin ein Test-Bot 🤖');
  // Beispiel: gehe 10 Sekunden vorwärts, baue danach ab (falls Block vor dir)
  setTimeout(() => {
    try { bot.setControlState('forward', true); } catch {}
  }, 2000);
  setTimeout(() => {
    try { bot.setControlState('forward', false); } catch {}
  }, 12000);
});

bot.on('chat', (username, message) => {
  console.log(`[CHAT] <${username}> ${message}`);
  if (message === '!pos') {
    const p = bot.entity.position;
    bot.chat(`Meine Position: ${p.x.toFixed(1)}, ${p.y.toFixed(1)}, ${p.z.toFixed(1)}`);
  }
});

bot.on('kicked', (reason) => console.log('Kicked:', reason));
bot.on('error', (err) => console.error('Error:', err));
