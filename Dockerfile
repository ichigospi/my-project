FROM node:20-slim

# yt-dlp + ffmpeg インストール（yt-dlpは最新版を使用）
RUN apt-get update && apt-get install -y \
  python3 python3-pip ffmpeg curl ca-certificates \
  && pip3 install --break-system-packages --upgrade yt-dlp \
  && apt-get clean && rm -rf /var/lib/apt/lists/*

WORKDIR /app

COPY package.json package-lock.json ./
RUN npm ci

COPY prisma ./prisma
COPY prisma.config.ts ./
RUN npx prisma generate

COPY . .
RUN npm run build

ENV NODE_ENV=production
ENV PORT=3000
EXPOSE 3000

CMD npm run migrate:turso && npm start
