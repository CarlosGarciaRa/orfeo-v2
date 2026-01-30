import type { Message } from 'discord.js';
import { useMainPlayer, useQueue, QueryType } from 'discord-player';
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

  try {
    let playResult: Awaited<ReturnType<typeof player.play>>;

    if (isLikelyUrl(query)) {
      // URL directa: el extractor correspondiente la resuelve
      playResult = await player.play(voiceChannel, query, baseOptions);
    } else {
      // Texto: buscar primero en YouTube (como el bot Python) y usar el primer resultado
      const searchResult = await player.search(query, {
        searchEngine: QueryType.YOUTUBE_SEARCH,
        requestedBy: message.author,
      });
      if (searchResult.isEmpty() || !searchResult.hasTracks()) {
        await reply(message, `No se encontró nada para "${query}". Prueba con otro término o una URL.`);
        return;
      }
      const firstTrack = searchResult.tracks[0];
      playResult = await player.play(voiceChannel, firstTrack, baseOptions);
    }

    const track = playResult.track;
    const wasQueued = playResult.queue.tracks.size > 0;
    const status = wasQueued ? 'En cola' : 'Reproduciendo';
    await reply(message,
      `${status} \`\`\`${track.title} (${track.duration})\`\`\``
    );
  } catch (err) {
    console.error('Error en play:', err);
    await reply(message, 'No se pudo reproducir. Prueba otra búsqueda o enlace.');
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
