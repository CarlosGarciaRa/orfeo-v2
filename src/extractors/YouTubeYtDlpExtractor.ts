import type { Track } from 'discord-player';
import { BaseExtractor, QueryType, Track as TrackClass } from 'discord-player';
import youtubedlPkg from 'youtube-dl-exec';

// En Railway/entornos sin Python usamos el binario standalone (ver Dockerfile)
const youtubedl =
  process.env.YT_DLP_BINARY_PATH != null
    ? youtubedlPkg.create(process.env.YT_DLP_BINARY_PATH)
    : youtubedlPkg;

const YOUTUBE_URL_REGEX =
  /^(https?:\/\/)?(www\.|m\.)?(youtube\.com|youtu\.be)\/(watch\?v=|embed\/|v\/)?([\w-]{11})(\S*)$/i;

function isYouTubeUrl(query: string): boolean {
  return YOUTUBE_URL_REGEX.test(query.trim());
}

function formatDuration(seconds: number | undefined): string {
  if (seconds == null || !Number.isFinite(seconds) || seconds < 0) return '0:00';
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = Math.floor(seconds % 60);
  if (h > 0) return `${h}:${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
  return `${m}:${s.toString().padStart(2, '0')}`;
}

interface YtDlpVideoInfo {
  id?: string;
  title?: string;
  uploader?: string;
  duration?: number;
  thumbnail?: string;
  webpage_url?: string;
  url?: string;
}

function buildTrack(
  player: import('discord-player').Player,
  info: YtDlpVideoInfo,
  requestedBy: import('discord.js').User | null
): Track {
  const url = info.webpage_url || info.url || `https://www.youtube.com/watch?v=${info.id || ''}`;
  return new TrackClass(player, {
    title: info.title || 'Sin título',
    author: info.uploader || 'Desconocido',
    url,
    duration: formatDuration(info.duration),
    thumbnail: info.thumbnail || '',
    description: '',
    views: 0,
    requestedBy: requestedBy ?? undefined,
    source: 'youtube',
  });
}

export class YouTubeYtDlpExtractor extends BaseExtractor {
  static identifier = 'youtube-ytdlp' as const;

  createBridgeQuery = (track: Track) => `${track.title} by ${track.author} official audio`;

  async activate(): Promise<void> {
    this.protocols = ['youtube', 'youtubeSearch'];
  }

  async deactivate(): Promise<void> {
    this.protocols = [];
  }

  async validate(query: string, type?: string | null): Promise<boolean> {
    const q = query.trim();
    if (isYouTubeUrl(q)) return true;
    if (type === QueryType.YOUTUBE_SEARCH || type === 'youtubeSearch') return true;
    return false;
  }

  async handle(
    query: string,
    context: import('discord-player').ExtractorSearchContext
  ): Promise<import('discord-player').ExtractorInfo> {
    const requestedBy = context.requestedBy ?? null;
    const q = query.trim();

    try {
      if (isYouTubeUrl(q)) {
        const info = await youtubedl(q, {
          dumpSingleJson: true,
          noPlaylist: true,
          noCheckCertificates: true,
          noWarnings: true,
        }) as YtDlpVideoInfo;
        const track = buildTrack(this.context.player, info, requestedBy);
        track.extractor = this;
        return this.createResponse(null, [track]);
      }

      const searchQuery = `ytsearch1:${q}`;
      const info = await youtubedl(searchQuery, {
        dumpSingleJson: true,
        noPlaylist: true,
        noCheckCertificates: true,
        noWarnings: true,
      }) as YtDlpVideoInfo;
      if (!info?.id && !info?.webpage_url && !info?.url) {
        this.debug('YouTubeYtDlpExtractor: yt-dlp no devolvió metadata válida');
        return this.createResponse(null, []);
      }
      const track = buildTrack(this.context.player, info, requestedBy);
      track.extractor = this;
      return this.createResponse(null, [track]);
    } catch (err) {
      console.error('[YouTubeYtDlpExtractor] handle error:', err);
      this.debug(`YouTubeYtDlpExtractor handle error: ${err}`);
      return this.createResponse(null, []);
    }
  }

  async stream(track: Track): Promise<string> {
    const url = track.url;
    if (!url || !isYouTubeUrl(url)) {
      throw new Error('Track URL no es de YouTube');
    }
    const streamUrl = await youtubedl(url, {
      format: 'bestaudio/best',
      getUrl: true,
      noPlaylist: true,
      noCheckCertificates: true,
      noWarnings: true,
    });
    if (typeof streamUrl !== 'string' || !streamUrl) {
      throw new Error('No se pudo obtener la URL del stream');
    }
    return streamUrl;
  }
}
