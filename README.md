# Orfeo v2

Bot de Discord para reproducción de música (TypeScript), equivalente al bot Python original.

## Comandos (prefijo `!`)

| Comando | Alias | Descripción |
|---------|--------|-------------|
| `!help` | `!commands` | Muestra todos los comandos |
| `!play` | `!p` | Reproduce una canción (búsqueda o URL) |
| `!pause` | — | Pausa la reproducción |
| `!resume` | — | Reanuda la reproducción |
| `!skip` | — | Salta la canción actual |
| `!queue` | — | Muestra la cola |
| `!playing` | — | Muestra la canción que suena ahora |

## Requisitos

- **Node.js 20.18+** (requerido por dependencias como `undici` / discord-player-youtubei)
- Cuenta de Discord y token del bot (con **Message Content Intent** activado en el portal de desarrolladores)

## Uso local

```bash
cp .env.example .env
# Edita .env y pon tu DISCORD_TOKEN

yarn install
yarn dev    # desarrollo con recarga
# o
yarn build && yarn start
```

## Desplegar en Render

1. Crea un **Background Worker** (no Web Service) en [Render](https://render.com).
2. Conecta el repo y usa:
   - **Build Command:** `yarn install && yarn build`
   - **Start Command:** `yarn start`
3. Añade la variable de entorno `DISCORD_TOKEN` con el token del bot.
4. Opcional: usa `render.yaml` como Blueprint para definir el servicio.

**Nota sobre YouTube:** YouTube cambia a menudo su API y el "signature decipher", por lo que a veces el bot encuentra la canción pero no reproduce audio (error típico: "Failed to extract signature decipher algorithm"). El extractor usa el cliente ANDROID para intentar evitarlo. Si sigue fallando, prueba con enlaces de **SoundCloud** o **URLs directas** de otras fuentes soportadas. En Render/VPS, YouTube puede bloquear además por IP.

## Estructura del proyecto

```
src/
  index.ts        # Cliente Discord, Player, handler de mensajes
  config.ts       # Prefijo y lista de comandos
  commands/
    music.ts      # Comandos de música (play, pause, skip, queue, etc.)
```

## Licencia

MIT
