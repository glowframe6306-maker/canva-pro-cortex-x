import { getPostgresClient } from "@/lib/postgres";
import { createCustomerServiceStore } from "@/lib/customer-service-store";
import type { CustomerServiceRequest } from "@/lib/customer-service-store";

export type { CustomerServiceRequest } from "@/lib/customer-service-store";

function getStore() {
  return createCustomerServiceStore(getPostgresClient());
}

export function generateCustomerServiceRequestId(date: Date, timeZone: string): Promise<string> {
  return getStore().generateRequestId(date, timeZone);
}

export function saveCustomerServiceRequest(request: CustomerServiceRequest): Promise<void> {
  return getStore().saveRequest(request);
}

export function getCustomerServiceRequests(): Promise<CustomerServiceRequest[]> {
  return getStore().getRequests();
}
