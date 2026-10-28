import type { NeonQueryFunction } from "@neondatabase/serverless";

export type CustomerServiceRequest = {
  requestId: string;
  fullName: string;
  whatsappNumber: string;
  email: string;
  canvaEmail: string;
  reason: string;
  message: string;
  createdAt: string;
  createdDate: string;
  createdTime: string;
  status: "REQUEST_SENT";
  telegramSent: boolean;
};

type Queryable = Pick<NeonQueryFunction<false, false>, "query">;

export function createCustomerServiceStore(client: Queryable) {
  return {
    async generateRequestId(date: Date, timeZone: string): Promise<string> {
      const rows = await client.query(
        "SELECT nextval(pg_get_serial_sequence('customer_service_requests', 'id')) AS next_id",
      ) as Array<{ next_id: number | string }>;
      const nextId = String(rows[0]?.next_id ?? "");
      if (!/^[1-9]\d*$/.test(nextId)) {
        throw new Error("Unable to allocate a customer service request ID.");
      }

      const dateStamp = new Intl.DateTimeFormat("en-CA", {
        year: "numeric",
        month: "2-digit",
        day: "2-digit",
        timeZone,
      }).format(date).replace(/-/g, "");
      return `CS-${dateStamp}-${nextId.padStart(4, "0")}`;
    },

    async saveRequest(request: CustomerServiceRequest): Promise<void> {
      const rows = await client.query(
        `INSERT INTO customer_service_requests (request_id, request_data, created_at)
         VALUES ($1, $2::jsonb, $3)
         RETURNING request_id`,
        [request.requestId, JSON.stringify(request), request.createdAt],
      ) as Array<{ request_id: string }>;
      if (rows.length === 0) {
        throw new Error("Customer service request was not persisted.");
      }
    },

    async getRequests(): Promise<CustomerServiceRequest[]> {
      const rows = await client.query(
        "SELECT request_data FROM customer_service_requests ORDER BY created_at ASC",
      ) as Array<{ request_data: unknown }>;
      return rows.map(({ request_data }) => {
        const request = typeof request_data === "string" ? JSON.parse(request_data) : request_data;
        if (!request || typeof request !== "object" || !("requestId" in request)) {
          throw new Error("Invalid customer service request data returned by PostgreSQL.");
        }
        return request as CustomerServiceRequest;
      });
    },
  };
}
