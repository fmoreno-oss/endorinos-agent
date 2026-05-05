import { spawn } from 'child_process';
import { logger } from '../lib/logger.js';

export async function convertToWhatsAppAudio(mp3Buffer: Buffer): Promise<Buffer> {
  logger.info('Converting MP3 to OGG/Opus for WhatsApp...');

  return new Promise((resolve, reject) => {
    const ffmpeg = spawn('ffmpeg', [
      '-i', 'pipe:0',
      '-c:a', 'libopus',
      '-b:a', '64k',
      '-f', 'ogg',
      'pipe:1',
    ], { stdio: ['pipe', 'pipe', 'pipe'] });

    const chunks: Buffer[] = [];

    ffmpeg.stdout.on('data', (chunk: Buffer) => chunks.push(chunk));
    ffmpeg.stderr.on('data', () => {}); // suppress ffmpeg stderr output

    ffmpeg.on('close', (code) => {
      if (code === 0) {
        const result = Buffer.concat(chunks);
        logger.info(`Audio converted: ${result.byteLength} bytes OGG/Opus`);
        resolve(result);
      } else {
        reject(new Error(`ffmpeg exited with code ${code}`));
      }
    });

    ffmpeg.on('error', (err) => {
      reject(new Error(`ffmpeg not found or failed: ${err.message}`));
    });

    ffmpeg.stdin.write(mp3Buffer);
    ffmpeg.stdin.end();
  });
}
