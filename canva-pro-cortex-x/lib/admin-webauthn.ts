import fs from "node:fs/promises";
import path from "node:path";
import type { WebAuthnCredential } from "@simplewebauthn/server";

export type StoredAdminCredential = {
  id: string;
  publicKey: string;
  counter: number;
  transports?: string[];
};

const credentialFile = path.join(process.cwd(), ".data", "admin-webauthn.json");

async function readCredential(): Promise<StoredAdminCredential | null> {
  try {
    const parsed = JSON.parse(await fs.readFile(credentialFile, "utf8"));
    return parsed && typeof parsed.id === "string" && typeof parsed.publicKey === "string" ? parsed : null;
  } catch {
    return null;
  }
}

export async function hasRegisteredAdminPasskey(): Promise<boolean> {
  return Boolean(await readCredential());
}

export async function saveAdminCredential(credential: StoredAdminCredential): Promise<void> {
  await fs.mkdir(path.dirname(credentialFile), { recursive: true });
  await fs.writeFile(credentialFile, JSON.stringify(credential, null, 2), "utf8");
}

export async function getAdminCredential(): Promise<WebAuthnCredential | null> {
  const stored = await readCredential();
  if (!stored) return null;
  return {
    id: stored.id,
    publicKey: Buffer.from(stored.publicKey, "base64url"),
    counter: stored.counter,
    transports: stored.transports,
  };
}

export async function updateAdminCredentialCounter(counter: number): Promise<void> {
  const stored = await readCredential();
  if (!stored) return;
  stored.counter = counter;
  await saveAdminCredential(stored);
}
