import { NextRequest, NextResponse } from "next/server";
import { completeAdminLogin, getAdminAuthConfigError, verifyAdminPin } from "@/lib/admin-auth";

export async function POST(request: NextRequest) {
  try {
    const configError = getAdminAuthConfigError();
    if (configError) return NextResponse.json({ ok: false, error: "Admin authentication is not configured on the server." }, { status: 503 });

    const pendingCookie = request.cookies.get("admin_pending")?.value;
    if (!pendingCookie) return NextResponse.json({ ok: false, error: "Login expired. Sign in again." }, { status: 401 });

    const result = verifyAdminPin(request, String((await request.json()).pin || ""));
    if (result.locked) return NextResponse.json({ ok: false, error: "Too many failed attempts. Try again later." }, { status: 429 });
    if (!result.ok) return NextResponse.json({ ok: false, error: "Incorrect Security PIN" }, { status: 401 });

    const response = NextResponse.json({ ok: true });
    if (!completeAdminLogin(request, response)) return NextResponse.json({ ok: false, error: "Login expired. Sign in again." }, { status: 401 });
    return response;
  } catch {
    return NextResponse.json({ ok: false, error: "Unable to verify security PIN." }, { status: 500 });
  }
}
