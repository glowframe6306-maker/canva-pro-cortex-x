import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { mkdtemp, mkdir, readFile, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import test from "node:test";
import { verifyLegacyReceiptCrosswalk } from "./verify-legacy-receipt-crosswalk.mjs";

const hash = (content) => createHash("sha256").update(content).digest("hex");

async function createSnapshot(t, { inconsistentReference = false, corruptManifest = false } = {}) {
  const root = await mkdtemp(path.join(os.tmpdir(), "legacy-crosswalk-test-"));
  t.after(() => rm(root, { recursive: true, force: true }));
  await mkdir(path.join(root, "receipts"));

  const orders = {
    version: 1,
    orders: [
      {
        receiptFilename: "MI-20260101-0002.png",
        storageKey: inconsistentReference ? "different.png" : "MI-20260101-0002.png",
        customerName: "fixture-only",
      },
      { receiptFilename: "MI-20260101-0001.jpg" },
    ],
  };
  const orderBytes = Buffer.from(JSON.stringify(orders));
  const receiptA = Buffer.from([0xff, 0xd8, 0xff, 0x00]);
  const receiptB = Buffer.from([0x89, 0x50, 0x4e, 0x47]);
  const files = [
    { relative_path: ".orders.json", role: "orders", data: orderBytes },
    { relative_path: "receipts/receipt-0001.jpg", role: "receipt_0001", data: receiptA },
    { relative_path: "receipts/receipt-0002.png", role: "receipt_0002", data: receiptB },
  ];

  for (const file of files) {
    await writeFile(path.join(root, file.relative_path), file.data);
  }
  const manifest = {
    files: files.map(({ relative_path, role, data }) => ({
      relative_path,
      role,
      bytes: data.length,
      sha256: hash(data),
    })),
  };
  if (corruptManifest) manifest.files[1].sha256 = "0".repeat(64);
  await writeFile(path.join(root, "manifest.json"), JSON.stringify(manifest));
  return root;
}

test("verifies deterministic receipt mapping and emits only ordinal paths", async (t) => {
  const root = await createSnapshot(t);
  const report = await verifyLegacyReceiptCrosswalk(root);

  assert.equal(report.status, "verified");
  assert.equal(report.orderRecordCount, 2);
  assert.equal(report.referencedReceiptCount, 2);
  assert.equal(report.matchedReceiptCount, 2);
  assert.equal(report.missingReceiptCount, 0);
  assert.equal(report.orphanReceiptCount, 0);
  assert.deepEqual(report.mappings.map((entry) => entry.backupPath), [
    "receipts/receipt-0001.jpg",
    "receipts/receipt-0002.png",
  ]);
  assert.equal(JSON.stringify(report).includes("fixture-only"), false);
});

test("fails closed when receipt references conflict", async (t) => {
  const root = await createSnapshot(t, { inconsistentReference: true });
  await assert.rejects(
    verifyLegacyReceiptCrosswalk(root),
    { message: "AMBIGUOUS_ORDER_RECEIPT_REFERENCE" },
  );
});

test("fails closed when a copied file does not match its manifest hash", async (t) => {
  const root = await createSnapshot(t, { corruptManifest: true });
  await assert.rejects(
    verifyLegacyReceiptCrosswalk(root),
    { message: "MANIFEST_FILE_MISMATCH" },
  );
});

test("rejects manifest paths that escape the snapshot", async (t) => {
  const root = await createSnapshot(t);
  const manifestPath = path.join(root, "manifest.json");
  const manifest = JSON.parse(await readFile(manifestPath, "utf8"));
  manifest.files[0].relative_path = "../outside.json";
  await writeFile(manifestPath, JSON.stringify(manifest));

  await assert.rejects(
    verifyLegacyReceiptCrosswalk(root),
    { message: "UNSAFE_MANIFEST_PATH" },
  );
});

test("rejects manifest paths outside the approved snapshot files", async (t) => {
  const root = await createSnapshot(t);
  const manifestPath = path.join(root, "manifest.json");
  const manifest = JSON.parse(await readFile(manifestPath, "utf8"));
  manifest.files[0].relative_path = ".env";
  await writeFile(manifestPath, JSON.stringify(manifest));

  await assert.rejects(
    verifyLegacyReceiptCrosswalk(root),
    { message: "UNEXPECTED_MANIFEST_PATH" },
  );
});
