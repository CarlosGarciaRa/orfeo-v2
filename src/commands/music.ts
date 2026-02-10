import type { Message } from 'discord.js';
import { useMainPlayer, useQueue } from 'discord-player';
import { GetListByKeyword } from 'youtube-search-api';
import { PREFIX, COMMANDS } from '../config.js';

/** Indica si el texto parece una URL de audio/vídeo (YouTube, SoundCloud, etc.). */
function isLikelyUrl(query: string): boolean {
  const trimmed = query.trim();
  if (trimmed.startsWith('http://') || trimmed.startsWith('https://')) return true;
  if (/^(www\.)?(youtube\.com|youtu\.be|soundcloud\.com|vimeo\.com)/i.test(trimmed)) return true;
  return false;
}

const VOICE_REQUIRED = 'Debes estar en un canal de voz para usar este comando.';

function getVoiceChannel(message: Message) {
  const member = message.member;
  if (!member?.voice?.channel) return null;
  return member.voice.channel;
}

/** Envía un mensaje al canal; solo en canales con send (guild text/thread). */
async function reply(message: Message, text: string) {
  const ch = message.channel;
  if (ch && 'send' in ch && typeof (ch as { send: (x: string) => Promise<unknown> }).send === 'function') {
    return (ch as { send: (x: string) => Promise<unknown> }).send(text);
  }
}

type SendableChannel = { send: (x: string) => Promise<{ edit: (x: string) => Promise<unknown> }> };
type StatusMessage = { edit: (x: string) => Promise<unknown> };

/** Mensajes de estado por canal y track (canal -> trackId -> mensaje) para actualizar "En cola" → "Reproduciendo" y "Terminó". */
const statusMessagesByChannelAndTrack = new Map<string, Map<string, StatusMessage>>();

/** Envía un mensaje que se puede editar; devuelve el mensaje o null si el canal no permite enviar. */
async function sendStatusMessage(message: Message, text: string): Promise<StatusMessage | null> {
  const ch = message.channel as SendableChannel | undefined;
  if (ch?.send) {
    return ch.send(text);
  }
  return null;
}

/** Actualiza el mensaje de estado cuando empieza a sonar una pista (p. ej. pasa de "En cola" a "Reproduciendo"). */
export function updatePlayStatusToPlaying(
  channelId: string | undefined,
  trackId: string | undefined,
  track: { title: string; duration: string }
) {
  if (!channelId || !trackId) return;
  const msg = statusMessagesByChannelAndTrack.get(channelId)?.get(trackId);
  msg?.edit(`▶️ **Reproduciendo:** \`${track.title}\` (${track.duration})`).catch(() => {});
}

/** Actualiza el mensaje de estado cuando termina una pista y lo elimina del Map. */
export function updatePlayStatusToFinished(
  channelId: string | undefined,
  trackId: string | undefined,
  track: { title: string }
) {
  if (!channelId || !trackId) return;
  const byTrack = statusMessagesByChannelAndTrack.get(channelId);
  const msg = byTrack?.get(trackId);
  msg?.edit(`✅ **Terminó:** \`${track.title}\``).catch(() => {});
  byTrack?.delete(trackId);
}

export async function help(message: Message): Promise<void> {
  const lines = COMMANDS.map(
    (c) => `${PREFIX}${c.name}${c.aliases.length ? ` (${c.aliases.join(', ')})` : ''}: ${c.description}`
  );
  await reply(message, `Comandos disponibles:\n\`\`\`${lines.join('\n')}\`\`\``);
}

export async function play(message: Message, args: string[]): Promise<void> {
  const voiceChannel = getVoiceChannel(message);
  if (!voiceChannel) {
    await reply(message,VOICE_REQUIRED);
    return;
  }

  const query = args.join(' ').trim();
  if (!query) {
    await reply(message,'Indica qué quieres reproducir. Ejemplo: `!play nombre de la canción`');
    return;
  }

  const player = useMainPlayer();
  if (!player) {
    await reply(message,'El reproductor no está disponible.');
    return;
  }

  const guild = message.guild;
  if (!guild) return;

  const nodeOptions = {
    metadata: { channel: message.channel },
    leaveOnEmpty: true,
    leaveOnEmptyCooldown: 60_000,
    leaveOnEnd: true,
    leaveOnEndCooldown: 60_000,
  };
  const baseOptions = { nodeOptions, requestedBy: message.author };

  const initialStatus = isLikelyUrl(query) ? '⬇️ **Descargando...**' : '🔍 **Buscando...**';
  const statusMsg = await sendStatusMessage(message, initialStatus);
  const updateStatus = (text: string) => statusMsg?.edit(text).catch(() => {});

  try {
    let playResult: Awaited<ReturnType<typeof player.play>>;

    if (isLikelyUrl(query)) {
      playResult = await player.play(voiceChannel, query, baseOptions);
    } else {
      const searchResult = await GetListByKeyword(query, false, 1, [{ type: 'video' }]);
      if (!searchResult?.items?.length) {
        await updateStatus(`No se encontró nada para "${query}". Prueba con otro término o una URL.`);
        return;
      }
      const first = searchResult.items[0];
      const url = `https://www.youtube.com/watch?v=${first.id}`;
      await updateStatus(`⬇️ **Descargando:** \`${first.title ?? query}\``);
      playResult = await player.play(voiceChannel, url, baseOptions);
    }

    const track = playResult.track;
    if (statusMsg) {
      let byTrack = statusMessagesByChannelAndTrack.get(message.channel.id);
      if (!byTrack) {
        byTrack = new Map();
        statusMessagesByChannelAndTrack.set(message.channel.id, byTrack);
      }
      byTrack.set(track.id, statusMsg);
    }
    const wasQueued = playResult.queue.tracks.size > 0;
    const status = wasQueued ? '📋 **En cola:**' : '▶️ **Reproduciendo:**';
    await updateStatus(`${status} \`${track.title}\` (${track.duration})`);
  } catch (err) {
    console.error('Error en play:', err);
    await updateStatus('No se pudo reproducir. Prueba otra búsqueda o enlace.');
  }
}

export async function pause(message: Message): Promise<void> {
  const voiceChannel = getVoiceChannel(message);
  if (!voiceChannel) {
    await reply(message,VOICE_REQUIRED);
    return;
  }

  const queue = useQueue(voiceChannel.guild.id);
  if (!queue) {
    await reply(message,'No hay nada reproduciéndose.');
    return;
  }

  if (queue.node.isPaused()) {
    await reply(message,'Ya está pausado.');
    return;
  }
  queue.node.setPaused(true);
  await reply(message,'Pausado.');
}

export async function resume(message: Message): Promise<void> {
  const voiceChannel = getVoiceChannel(message);
  if (!voiceChannel) {
    await reply(message,VOICE_REQUIRED);
    return;
  }

  const queue = useQueue(voiceChannel.guild.id);
  if (!queue) {
    await reply(message,'No hay cola activa.');
    return;
  }

  if (!queue.node.isPaused()) {
    await reply(message,'No está pausado.');
    return;
  }

  queue.node.setPaused(false);
  await reply(message,'Reanudado.');
}

export async function skip(message: Message): Promise<void> {
  const voiceChannel = getVoiceChannel(message);
  if (!voiceChannel) {
    await reply(message,VOICE_REQUIRED);
    return;
  }

  const queue = useQueue(voiceChannel.guild.id);
  if (!queue) {
    await reply(message,'No hay nada reproduciéndose.');
    return;
  }

  queue.node.skip();
  await reply(message,'Siguiente...');
}

export async function showQueue(message: Message): Promise<void> {
  const guild = message.guild;
  if (!guild) return;

  const queue = useQueue(guild.id);
  if (!queue || queue.tracks.size === 0) {
    await reply(message,'No hay nada en la cola.');
    return;
  }

  const lines: string[] = [];
  const tracks = queue.tracks.toArray();
  tracks.forEach((track, i) => {
    lines.push(`${i + 1}.- ${track.title} (${track.duration})`);
  });
  await reply(message,`En cola:\n\`\`\`${lines.join('\n')}\`\`\``);
}

export async function playing(message: Message): Promise<void> {
  const guild = message.guild;
  if (!guild) return;

  const queue = useQueue(guild.id);
  if (!queue?.currentTrack) {
    await reply(message,'No hay nada reproduciéndose.');
    return;
  }

  const track = queue.currentTrack;
  await reply(message,`Ahora suena \`\`\`${track.title}\`\`\``);
}
