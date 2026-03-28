import { readFile, writeFile, mkdir, readdir, chmod } from "node:fs/promises";
import { existsSync } from "node:fs";
import { join } from "node:path";
import { CREDENTIALS_DIR } from "./constants.js";
async function ensureCredentialsDir() {
  if (!existsSync(CREDENTIALS_DIR)) {
    await mkdir(CREDENTIALS_DIR, { recursive: true });
    await chmod(CREDENTIALS_DIR, 0o700);
  }
}
function credentialPath(channel) {
  return join(CREDENTIALS_DIR, `${channel}.json`);
}
async function loadChannelCredentials(channel) {
  const filePath = credentialPath(channel);
  if (!existsSync(filePath)) {
    return {};
  }
  const raw = await readFile(filePath, "utf-8");
  try {
    return JSON.parse(raw);
  } catch {
    return {};
  }
}
async function persistChannelCredentials(channel, credentials) {
  await ensureCredentialsDir();
  const filePath = credentialPath(channel);
  await writeFile(
    filePath,
    JSON.stringify(credentials, null, 2) + "\n",
    "utf-8",
  );
  await chmod(filePath, 0o600);
}
export async function saveCredential(channel, key, value) {
  const creds = await loadChannelCredentials(channel);
  creds[key] = value;
  await persistChannelCredentials(channel, creds);
}
export async function getCredential(channel, key) {
  const creds = await loadChannelCredentials(channel);
  return creds[key];
}
export async function listCredentials(channel) {
  const creds = await loadChannelCredentials(channel);
  return Object.keys(creds);
}
export async function deleteCredential(channel, key) {
  const creds = await loadChannelCredentials(channel);
  if (!(key in creds)) return false;
  delete creds[key];
  await persistChannelCredentials(channel, creds);
  return true;
}
export async function listConfiguredChannels() {
  await ensureCredentialsDir();
  const files = await readdir(CREDENTIALS_DIR);
  return files
    .filter((f) => f.endsWith(".json"))
    .map((f) => f.replace(".json", ""));
}
//# sourceMappingURL=credentials.js.map
