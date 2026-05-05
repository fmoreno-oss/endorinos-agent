FROM node:20-slim

# ffmpeg is required for MP3 → OGG/Opus audio conversion
RUN apt-get update && apt-get install -y ffmpeg && rm -rf /var/lib/apt/lists/*

WORKDIR /app

COPY package.json package-lock.json ./
RUN npm ci

COPY . .
RUN npm run build

CMD ["node", "dist/index.js"]
