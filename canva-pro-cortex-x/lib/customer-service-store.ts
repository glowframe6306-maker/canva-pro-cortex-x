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
type QueryableFactory = () => Queryable;

export type CustomerServiceRequestIdPhase =
  | "DATABASE_CLIENT"
  | "SEQUENCE_QUERY"
  | "SEQUENCE_RESULT"
  | "DATE_FORMAT";

export class CustomerServiceRequestIdPhaseError extends Error {
  readonly phase: CustomerServiceRequestIdPhase;

  constructor(phase: CustomerServiceRequestIdPhase, cause: unknown) {
    super("Customer service request ID generation failed.", { cause });
    this.name = "CustomerServiceRequestIdPhaseError";
    this.phase = phase;
  }
}

async function runInRequestIdPhase<T>(
  phase: CustomerServiceRequestIdPhase,
  operation: () => T | Promise<T>,
): Promise<T> {
  try {
    return await operation();
  } catch (error) {
    throw new CustomerServiceRequestIdPhaseError(phase, error);
  }
}

export function createCustomerServiceStore(getClient: QueryableFactory) {
  return {
    async generateRequestId(date: Date, timeZone: string): Promise<string> {
      const client = await runInRequestIdPhase("DATABASE_CLIENT", getClient);
      const rows = await runInRequestIdPhase("SEQUENCE_QUERY", () => client.query(
        "SELECT nextval(pg_get_serial_sequence('customer_service_requests', 'id')) AS next_id",
      )) as Array<{ next_id: number | string }>;
      const nextId = await runInRequestIdPhase("SEQUENCE_RESULT", () => {
        const value = String(rows[0]?.next_id ?? "");
        if (!/^[1-9]\d*$/.test(value)) {
          throw new Error("Unable to allocate a customer service request ID.");
        }
        return value;
      });

      const dateStamp = await runInRequestIdPhase("DATE_FORMAT", () => new Intl.DateTimeFormat("en-CA", {
        year: "numeric",
        month: "2-digit",
        day: "2-digit",
        timeZone,
      }).format(date).replace(/-/g, ""));
      return `CS-${dateStamp}-${nextId.padStart(4, "0")}`;
    },

    async saveRequest(request: CustomerServiceRequest): Promise<void> {
      const rows = await getClient().query(
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
      const rows = await getClient().query(
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
