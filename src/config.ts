export const PREFIX = '!';

/**
 * IDs de servidores donde el bot puede operar (lista blanca).
 * En .env: ALLOWED_GUILD_IDS=id1,id2,id3
 * Cómo obtener el ID: Discord → Ajustes → Avanzado → Activar "Modo desarrollador".
 * Clic derecho en el servidor → "Copiar ID del servidor".
 */
function getAllowedGuildIds(): Set<string> {
  const raw = process.env.ALLOWED_GUILD_IDS ?? '';
  if (!raw.trim()) return new Set();
  return new Set(raw.split(',').map((id) => id.trim()).filter(Boolean));
}

export const ALLOWED_GUILD_IDS = getAllowedGuildIds();

export function isGuildAllowed(guildId: string): boolean {
  if (ALLOWED_GUILD_IDS.size === 0) return true; // sin config = permitir todos (desarrollo)
  return ALLOWED_GUILD_IDS.has(guildId);
}

export const COMMANDS = [
  { name: 'help', aliases: ['commands'], description: 'Muestra todos los comandos disponibles' },
  { name: 'play', aliases: ['p'], description: 'Conecta al canal de voz y reproduce audio' },
  { name: 'pause', aliases: [], description: 'Pausa la canción' },
  { name: 'resume', aliases: [], description: 'Reanuda la canción' },
  { name: 'skip', aliases: [], description: 'Salta la canción actual' },
  { name: 'queue', aliases: [], description: 'Muestra la cola actual' },
  { name: 'playing', aliases: [], description: 'Muestra la canción que suena ahora' },
] as const;
