import Redis from 'ioredis';
import { env } from './env';

let redisClient: Redis | null = null;

export function getRedisClient(): Redis | null {
  if (!env.REDIS_URL) {
    return null;
  }

  if (!redisClient) {
    redisClient = new Redis(env.REDIS_URL, {
      maxRetriesPerRequest: 3,
      lazyConnect: true,
      enableReadyCheck: true,
    });

    redisClient.on('connect', () => {
      console.log('Redis conectado');
    });

    redisClient.on('error', (err: Error) => {
      console.error('Error de Redis:', err.message);
    });

    redisClient.on('close', () => {
      console.log('Conexion Redis cerrada');
    });
  }

  return redisClient;
}

export async function connectRedis(): Promise<void> {
  const client = getRedisClient();
  if (!client) {
    console.log('Cache Redis no configurado. La API continuara sin cache.');
    return;
  }

  await client.connect();
}

export async function disconnectRedis(): Promise<void> {
  if (redisClient) {
    await redisClient.quit();
    redisClient = null;
  }
}

export async function cacheGet<T>(key: string): Promise<T | null> {
  const redis = getRedisClient();
  if (!redis) return null;

  try {
    const value = await redis.get(key);
    return value ? (JSON.parse(value) as T) : null;
  } catch (error) {
    console.warn('No se pudo leer cache Redis:', error);
    return null;
  }
}

export async function cacheSet(key: string, value: unknown, ttlSeconds = 300): Promise<void> {
  const redis = getRedisClient();
  if (!redis) return;

  try {
    await redis.setex(key, ttlSeconds, JSON.stringify(value));
  } catch (error) {
    console.warn('No se pudo guardar cache Redis:', error);
  }
}

export async function cacheDel(key: string): Promise<void> {
  const redis = getRedisClient();
  if (!redis) return;

  try {
    await redis.del(key);
  } catch (error) {
    console.warn('No se pudo eliminar cache Redis:', error);
  }
}
