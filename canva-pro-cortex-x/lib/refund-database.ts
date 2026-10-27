import { getPostgresClient } from "@/lib/postgres";
import { createRefundStore } from "@/lib/refund-store";
import type { RefundRequest, RefundStatus, RefundDeliveryStatus } from "@/lib/refund-store";

export type { RefundRequest, RefundStatus, RefundDeliveryStatus } from "@/lib/refund-store";

function getStore() {
  return createRefundStore(getPostgresClient());
}

export function generateRefundCode(): string {
  const alphabet = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  let result = "RFD-";
  for (let index = 0; index < 6; index += 1) {
    result += alphabet[Math.floor(Math.random() * alphabet.length)];
  }
  return result;
}

export function generateRefundRequestId(): Promise<string> {
  return getStore().generateRefundRequestId();
}

export function saveRefundRequest(
  request: RefundRequest,
): Promise<{ request: RefundRequest; created: boolean }> {
  return getStore().saveRefundRequest(request);
}

export function getAllRefundRequests(): Promise<RefundRequest[]> {
  return getStore().getAllRefundRequests();
}

export function getRefundRequestById(refundRequestId: string): Promise<RefundRequest | null> {
  return getStore().getRefundRequestById(refundRequestId);
}

export function getRefundRequestByOrderNumber(orderNumber: string): Promise<RefundRequest | null> {
  return getStore().getRefundRequestByOrderNumber(orderNumber);
}

export function updateRefundRequestStatus(
  refundRequestId: string,
  status: RefundStatus,
): Promise<RefundRequest | null> {
  return getStore().updateRefundRequestStatus(refundRequestId, status);
}

export function hasActiveRefundRequest(orderNumber: string): Promise<boolean> {
  return getStore().hasActiveRefundRequest(orderNumber);
}

export function claimRefundDelivery(
  refundRequestId: string,
  kind: "telegram" | "next",
): Promise<boolean> {
  return getStore().claimRefundDelivery(refundRequestId, kind);
}

export function setRefundDeliveryStatus(
  refundRequestId: string,
  kind: "telegram" | "next",
  status: RefundDeliveryStatus,
): Promise<void> {
  return getStore().setRefundDeliveryStatus(refundRequestId, kind, status);
}
