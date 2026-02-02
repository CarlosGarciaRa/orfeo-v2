import { Client, Events, GatewayIntentBits } from 'discord.js';
import { Player } from 'discord-player';
import { DefaultExtractors } from '@discord-player/extractor';
import { YouTubeYtDlpExtractor } from './extractors/YouTubeYtDlpExtractor.js';
import 'dotenv/config';
import { PREFIX, COMMANDS, isGuildAllowed } from './config.js';
import * as music from './commands/music.js';

const token = process.env.DISCORD_TOKEN;
if (!token) {
  console.error('Falta DISCORD_TOKEN. Crea un .env con DISCORD_TOKEN=tu_token');
  process.exit(1);
}

const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildVoiceStates,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.MessageContent,
  ],
});

const player = new Player(client);

player.events.on('error', (queue, error) => {
  console.error('Error del reproductor (cola):', error);
});
player.events.on('playerError', (queue, error, track) => {
  console.error('Error del reproductor al reproducir:', track?.title ?? 'track', error);
});
player.events.on('playerStart', (queue, track) => {
  const channelId = (queue.metadata?.channel as { id?: string } | undefined)?.id;
  music.updatePlayStatusToPlaying(channelId, { title: track.title, duration: track.duration });
});
player.events.on('playerFinish', (queue, track) => {
  const channelId = (queue.metadata?.channel as { id?: string } | undefined)?.id;
  music.updatePlayStatusToFinished(channelId, { title: track.title });
});

const commandHandlers: Record<string, (msg: import('discord.js').Message, args: string[]) => Promise<void>> = {
  help: music.help,
  commands: music.help,
  play: music.play,
  p: music.play,
  pause: music.pause,
  resume: music.resume,
  skip: music.skip,
  queue: music.showQueue,
  playing: music.playing,
};

function parseCommand(content: string): { name: string; args: string[] } | null {
  if (!content.startsWith(PREFIX)) return null;
  const rest = content.slice(PREFIX.length).trim();
  if (!rest) return null;
  const parts = rest.split(/\s+/);
  const name = parts[0].toLowerCase();
  const args = parts.slice(1);
  return { name, args };
}

client.once(Events.ClientReady, (readyClient) => {
  console.log(`Listo. Conectado como ${readyClient.user.tag}`);
});

// Si añaden el bot a un servidor no autorizado, salir al momento
client.on(Events.GuildCreate, async (guild) => {
  if (!isGuildAllowed(guild.id)) {
    console.warn(`Servidor no autorizado: ${guild.name} (${guild.id}). Saliendo.`);
    await guild.leave().catch((err) => console.error('Error al salir del servidor:', err));
  }
});

client.on(Events.MessageCreate, async (message) => {
  if (message.author.bot) return;
  const parsed = parseCommand(message.content);
  if (!parsed) return;

  const handler = commandHandlers[parsed.name];
  if (!handler) return;

  const guild = message.guild;
  if (!guild) return;

  // Lista blanca: solo responder en servidores autorizados
  if (!isGuildAllowed(guild.id)) {
    await message.channel.send('Este bot no está autorizado en este servidor.').catch(() => {});
    return;
  }

  try {
    await player.context.provide({ guild }, () => handler(message, parsed.args));
  } catch (err) {
    console.error('Error ejecutando comando:', err);
    await message.channel.send('Hubo un error al ejecutar el comando.').catch(() => {});
  }
});

async function main() {
  // Registrar primero el extractor de YouTube (yt-dlp) para que búsquedas por nombre lo usen
  await player.extractors.register(YouTubeYtDlpExtractor, {});
  await player.extractors.loadMulti(DefaultExtractors);
  await client.login(token);
}

main().catch((err) => {
  console.error('Error al conectar:', err);
  process.exit(1);
});
