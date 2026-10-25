import { NextRequest, NextResponse } from "next/server";
import { hasAdminSession } from "@/lib/admin-auth";
import { getReceiptFile } from "@/lib/order-system";

export async function GET(request: NextRequest, { params }: { params: Promise<{ orderId: string }> }) {
  if (!hasAdminSession(request)) {
    return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });
  }

  try {
    const { orderId } = await params;
    const receipt = await getReceiptFile(orderId);
    if (!receipt) {
      return NextResponse.json({ ok: false, error: "Receipt not found." }, { status: 404 });
    }

    return new Response(new Blob([new Uint8Array(receipt.buffer)], { type: receipt.mimeType }), {
      headers: {
        "Content-Type": receipt.mimeType,
        "Content-Disposition": `attachment; filename="${receipt.filename}"`,
        "Cache-Control": "private, no-store",
      },
    });
  } catch (error) {
    console.error("Admin receipt API error:", error instanceof Error ? error.name : "UnknownError");
    return NextResponse.json({ ok: false, error: "Unable to retrieve receipt." }, { status: 500 });
  }
}
