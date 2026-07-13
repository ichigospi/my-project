import { randomBytes } from "crypto";
import { prisma } from "./prisma";

export async function getSetting(key: string): Promise<string | null> {
  const row = await prisma.appSetting.findUnique({ where: { key } });
  return row?.value ?? null;
}

export async function setSetting(key: string, value: string): Promise<void> {
  await prisma.appSetting.upsert({
    where: { key },
    update: { value },
    create: { key, value },
  });
}

export async function getJsonSetting<T>(key: string, fallback: T): Promise<T> {
  const raw = await getSetting(key);
  if (!raw) return fallback;
  try {
    return JSON.parse(raw) as T;
  } catch {
    return fallback;
  }
}

// webhook用シークレット。未生成なら作って保存する
export async function getOrCreateIngestSecret(): Promise<string> {
  const existing = await getSetting("ingest_secret");
  if (existing) return existing;
  const secret = randomBytes(24).toString("hex");
  await setSetting("ingest_secret", secret);
  return secret;
}
