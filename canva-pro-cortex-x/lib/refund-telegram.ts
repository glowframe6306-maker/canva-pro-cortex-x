export type RefundTelegramResult =
  | { status: "SENT"; httpStatus: number }
  | { status: "FAILED"; httpStatus: number; errorCode?: number }
  | { status: "UNKNOWN"; errorName: string };

export async function sendRefundTelegramMessage(
  fetcher: typeof fetch,
  botToken: string,
  chatId: string,
  text: string,
): Promise<RefundTelegramResult> {
  let response: Response;
  try {
    response = await fetcher(`https://api.telegram.org/bot${botToken}/sendMessage`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        chat_id: chatId,
        text,
        parse_mode: "MarkdownV2",
        disable_web_page_preview: true,
      }),
    });
  } catch (error) {
    const errorName = error instanceof Error && ["FetchError", "AbortError", "TypeError"].includes(error.name)
      ? error.name
      : "Error";
    return { status: "UNKNOWN", errorName };
  }

  let payload: unknown;
  try {
    payload = await response.json();
  } catch (error) {
    const errorName = error instanceof Error && ["SyntaxError", "TypeError"].includes(error.name)
      ? error.name
      : "Error";
    return { status: "UNKNOWN", errorName };
  }
  if (response.ok && isTelegramAccepted(payload)) {
    return { status: "SENT", httpStatus: response.status };
  }
  if (response.ok && !isTelegramRejection(payload)) {
    return { status: "UNKNOWN", errorName: "Error" };
  }
  const errorCode = getTelegramErrorCode(payload);
  return {
    status: "FAILED",
    httpStatus: response.status,
    ...(errorCode ? { errorCode } : {}),
  };
}

function isTelegramAccepted(payload: unknown): boolean {
  return Boolean(payload && typeof payload === "object" && "ok" in payload && payload.ok === true);
}

function isTelegramRejection(payload: unknown): boolean {
  return Boolean(payload && typeof payload === "object" && "ok" in payload && payload.ok === false);
}

function getTelegramErrorCode(payload: unknown): number | undefined {
  if (!payload || typeof payload !== "object" || !("error_code" in payload)) return undefined;
  const code = payload.error_code;
  return typeof code === "number" && Number.isInteger(code) ? code : undefined;
}
