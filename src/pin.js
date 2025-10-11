import Redis from 'ioredis';
import { randomBytes } from 'crypto';
import * as onche from './onche.js';

const redis = new Redis(process.env.REDIS_URL, { keyPrefix: 'oidc:' });
redis.on("connect", () => console.log("Redis connected"));
redis.on("error", (err) => console.error("Redis error", err));

export async function sendPin(username, uid) {
  const profile = await onche.getProfile(username);
  if (!profile) {
    throw new Error("Ce khey est une grosse pédale");
  }
  const pin = String(Math.floor(100000 + Math.random() * 900000)); // 6-digit code
  const session = randomBytes(4).toString('hex');
  const key = `pin:${username}:${uid}`;
  const ttl = 600;
  await redis.setex(key, ttl, pin);
  const token = await onche.fetchChatToken();
  if (!token) throw new Error("Token missing");

  const success = await onche.sendChatMsg(`[b][ONCHE CONNECT][/b] Code PIN pour la session [i][${session}][/i]: [b]${pin}[/b]`, username, token);
  if (!success) throw new Error("Failed to send message");

  return session;
}

export async function verifyPin(username, uid, pin) {
  const storedPin = await redis.get(`pin:${username}:${uid}`);
  if (storedPin && storedPin === pin) {
    await redis.del(`pin:${username}:${uid}`);
    return true;
  }
  return false;
}
