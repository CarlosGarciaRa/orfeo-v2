export const PREFIX = '!';

export const COMMANDS = [
  { name: 'help', aliases: ['commands'], description: 'Muestra todos los comandos disponibles' },
  { name: 'play', aliases: ['p'], description: 'Conecta al canal de voz y reproduce audio' },
  { name: 'pause', aliases: [], description: 'Pausa la canción' },
  { name: 'resume', aliases: [], description: 'Reanuda la canción' },
  { name: 'skip', aliases: [], description: 'Salta la canción actual' },
  { name: 'queue', aliases: [], description: 'Muestra la cola actual' },
  { name: 'playing', aliases: [], description: 'Muestra la canción que suena ahora' },
] as const;
