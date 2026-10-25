import { createHash } from "node:crypto";
import { lstat, readFile } from "node:fs/promises";
import path from "node:path";
import { pathToFileURL } from "node:url";

function sha256(buffer) {
  return createHash("sha256").update(buffer).digest("hex");
}

function safeRelativePath(root, relativePath) {
  if (
    typeof relativePath !== "string"
    || path.posix.isAbsolute(relativePath)
    || path.win32.isAbsolute(relativePath)
    || relativePath.split(/[\\/]/).includes("..")
  ) {
    throw new Error("UNSAFE_MANIFEST_PATH");
  }
  if (
    relativePath !== ".orders.json"
    && relativePath !== ".order-counter.json"
    && relativePath !== ".free-trial-counter.json"
    && !/^receipts\/receipt-\d{4}\.(png|jpg|jpeg|pdf)$/.test(relativePath)
  ) {
    throw new Error("UNEXPECTED_MANIFEST_PATH");
  }
  return path.join(root, ...relativePath.split(/[\\/]/));
}

function referenceBasename(value) {
  const normalized = String(value).replaceAll("\\", "/");
  return normalized.slice(normalized.lastIndexOf("/") + 1);
}

function collectReferences(orders) {
  const references = new Map();

  for (const order of orders) {
    const values = ["receiptFilename", "storageKey", "receiptPath"]
      .map((key) => order[key])
      .filter((value) => typeof value === "string" && value.trim());
    if (values.length === 0) continue;

    const names = values.map((value) => referenceBasename(value.trim()));
    const normalizedNames = new Set(names.map((name) => name.toLowerCase()));
    if (names.some((name) => !name || name === "." || name === "..") || normalizedNames.size !== 1) {
      throw new Error("AMBIGUOUS_ORDER_RECEIPT_REFERENCE");
    }

    const basename = names[0];
    if (!references.has(basename.toLowerCase())) {
      references.set(basename.toLowerCase(), path.posix.extname(basename).toLowerCase());
    }
  }

  return [...references.entries()]
    .map(([normalizedName, extension]) => ({ normalizedName, extension }))
    .sort((left, right) => (
      left.normalizedName < right.normalizedName ? -1
        : left.normalizedName > right.normalizedName ? 1
          : 0
    ));
}

export async function verifyLegacyReceiptCrosswalk(snapshotDirectory) {
  const root = path.resolve(snapshotDirectory);
  const manifest = JSON.parse(await readFile(path.join(root, "manifest.json"), "utf8"));
  if (!Array.isArray(manifest.files)) throw new Error("INVALID_MANIFEST");

  const manifestEntries = new Map();
  for (const entry of manifest.files) {
    if (
      !entry
      || typeof entry.relative_path !== "string"
      || !Number.isSafeInteger(entry.bytes)
      || typeof entry.sha256 !== "string"
      || !/^[a-f0-9]{64}$/.test(entry.sha256)
    ) {
      throw new Error("INVALID_MANIFEST_ENTRY");
    }
    if (manifestEntries.has(entry.relative_path)) throw new Error("DUPLICATE_MANIFEST_PATH");
    manifestEntries.set(entry.relative_path, entry);

    const filePath = safeRelativePath(root, entry.relative_path);
    const fileStat = await lstat(filePath);
    if (!fileStat.isFile() || fileStat.isSymbolicLink()) throw new Error("UNSAFE_MANIFEST_FILE");
    const data = await readFile(filePath);
    if (data.length !== entry.bytes || sha256(data) !== entry.sha256) {
      throw new Error("MANIFEST_FILE_MISMATCH");
    }
  }

  const orderEntry = manifestEntries.get(".orders.json");
  if (!orderEntry) throw new Error("ORDER_SNAPSHOT_NOT_IN_MANIFEST");
  const orderSnapshot = JSON.parse(await readFile(path.join(root, ".orders.json"), "utf8"));
  if (!Array.isArray(orderSnapshot.orders)) throw new Error("INVALID_ORDER_SNAPSHOT");

  const references = collectReferences(orderSnapshot.orders);
  const receiptEntries = [...manifestEntries.values()]
    .filter((entry) => typeof entry.role === "string" && entry.role.startsWith("receipt_"));
  const mapping = [];

  for (const [index, reference] of references.entries()) {
    if (![".png", ".jpg", ".jpeg", ".pdf"].includes(reference.extension)) {
      throw new Error("UNSUPPORTED_RECEIPT_EXTENSION");
    }
    const ordinal = String(index + 1).padStart(4, "0");
    const relativePath = `receipts/receipt-${ordinal}${reference.extension}`;
    const entry = manifestEntries.get(relativePath);
    if (!entry || entry.role !== `receipt_${ordinal}`) {
      throw new Error("RECEIPT_CROSSWALK_MISMATCH");
    }
    mapping.push({
      ordinal: index + 1,
      backupPath: relativePath,
      bytes: entry.bytes,
      sha256: entry.sha256,
    });
  }

  if (receiptEntries.length !== references.length) throw new Error("UNREFERENCED_RECEIPT_ENTRY");

  return {
    status: "verified",
    orderRecordCount: orderSnapshot.orders.length,
    referencedReceiptCount: references.length,
    matchedReceiptCount: mapping.length,
    missingReceiptCount: 0,
    orphanReceiptCount: receiptEntries.length - mapping.length,
    mappings: mapping,
  };
}

async function runCli() {
  const snapshotDirectory = process.argv[2];
  if (!snapshotDirectory) {
    console.error("Usage: node scripts/verify-legacy-receipt-crosswalk.mjs <verified-snapshot-directory>");
    process.exitCode = 2;
    return;
  }

  try {
    const report = await verifyLegacyReceiptCrosswalk(snapshotDirectory);
    process.stdout.write(`${JSON.stringify(report, null, 2)}\n`);
  } catch (error) {
    const code = error instanceof Error ? error.message : "UNEXPECTED_VALIDATION_ERROR";
    console.error(`Receipt crosswalk verification failed: ${code}`);
    process.exitCode = 1;
  }
}

if (process.argv[1] && import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href) {
  await runCli();
}
