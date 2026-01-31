# Bot Discord Orfeo v2 - Railway (con yt-dlp standalone, sin Python)
FROM node:20-bookworm-slim

# curl + ffmpeg (reproducción de audio; ffmpeg-static a veces falla en contenedores)
RUN apt-get update && apt-get install -y --no-install-recommends curl ca-certificates ffmpeg \
  && rm -rf /var/lib/apt/lists/*

# Binario standalone de yt-dlp para Linux (yt-dlp es el script Python; yt-dlp_linux es el ejecutable)
ENV YT_DLP_BINARY_PATH=/app/bin/yt-dlp
RUN mkdir -p /app/bin \
  && curl -L "https://github.com/yt-dlp/yt-dlp/releases/latest/download/yt-dlp_linux" -o /app/bin/yt-dlp \
  && chmod +x /app/bin/yt-dlp

WORKDIR /app

COPY package.json yarn.lock ./
# Saltar la comprobación de Python; usamos el binario standalone de yt-dlp descargado arriba
ENV YOUTUBE_DL_SKIP_PYTHON_CHECK=1
RUN yarn install --frozen-lockfile --production=false

COPY tsconfig.json ./
COPY src ./src
RUN yarn build

# Producción: solo dependencias de runtime
RUN yarn install --frozen-lockfile --production

EXPOSE 3000
CMD ["node", "dist/index.js"]
