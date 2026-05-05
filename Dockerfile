FROM node:20-slim

# Set UTF-8 locale to prevent character encoding issues
ENV LANG=C.UTF-8
ENV LC_ALL=C.UTF-8
ENV NODE_OPTIONS="--max-old-space-size=512"

# ffmpeg is required for MP3 -> OGG/Opus audio conversion
RUN apt-get update && apt-get install -y ffmpeg locales && \
    locale-gen C.UTF-8 && \
    rm -rf /var/lib/apt/lists/*

WORKDIR /app

COPY package.json package-lock.json ./
RUN npm ci

COPY . .
RUN npm run build

CMD ["node", "dist/index.js"]
