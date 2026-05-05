import { eq } from 'drizzle-orm';
import { db } from '../db/index.js';
import { authState } from '../db/schema.js';
import { logger } from '../lib/logger.js';
import type { AuthenticationState, SignalDataTypeMap } from 'baileys';
import { proto } from 'baileys';
import { initAuthCreds, BufferJSON } from 'baileys';

async function readData(key: string): Promise<unknown | null> {
  const [row] = await db.select().from(authState).where(eq(authState.id, key)).limit(1);
  if (!row) return null;
  return JSON.parse(JSON.stringify(row.data), BufferJSON.reviver);
}

async function writeData(key: string, data: unknown): Promise<void> {
  const serialized = JSON.parse(JSON.stringify(data, BufferJSON.replacer));
  await db
    .insert(authState)
    .values({ id: key, data: serialized })
    .onConflictDoUpdate({ target: authState.id, set: { data: serialized, updatedAt: new Date() } });
}

async function removeData(key: string): Promise<void> {
  await db.delete(authState).where(eq(authState.id, key));
}

export async function usePostgreSQLAuthState(): Promise<{
  state: AuthenticationState;
  saveCreds: () => Promise<void>;
}> {
  const creds = (await readData('creds')) || initAuthCreds();

  return {
    state: {
      creds: creds as AuthenticationState['creds'],
      keys: {
        get: async <T extends keyof SignalDataTypeMap>(type: T, ids: string[]) => {
          const data: { [id: string]: SignalDataTypeMap[T] } = {};
          for (const id of ids) {
            const value = await readData(`${type}-${id}`);
            if (value) {
              if (type === 'app-state-sync-key') {
                data[id] = proto.Message.AppStateSyncKeyData.fromObject(value) as unknown as SignalDataTypeMap[T];
              } else {
                data[id] = value as SignalDataTypeMap[T];
              }
            }
          }
          return data;
        },
        set: async (data: Record<string, Record<string, unknown>>) => {
          for (const [type, entries] of Object.entries(data)) {
            for (const [id, value] of Object.entries(entries)) {
              if (value) {
                await writeData(`${type}-${id}`, value);
              } else {
                await removeData(`${type}-${id}`);
              }
            }
          }
        },
      },
    },
    saveCreds: async () => {
      await writeData('creds', creds);
      logger.info('Credentials saved to PostgreSQL');
    },
  };
}
