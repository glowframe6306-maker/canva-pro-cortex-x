import { NextRequest, NextResponse } from "next/server";
import { getAdminAuthConfigError, setPendingLogin, verifyAdminCredentials } from "@/lib/admin-auth";

export async function POST(request: NextRequest) {
  try {
    const configError = getAdminAuthConfigError();
    if (configError) return NextResponse.json({ ok: false, error: "Admin authentication is not configured on the server." }, { status: 503 });

    const body = await request.json();
    const result = verifyAdminCredentials(request, String(body.username || ""), String(body.password || ""));
    if (result.locked) return NextResponse.json({ ok: false, error: "Too many failed attempts. Try again later." }, { status: 429 });
    if (!result.ok) return NextResponse.json({ ok: false, error: "Invalid admin credentials." }, { status: 401 });

    const response = NextResponse.json({ ok: true, requiresPin: true });
    setPendingLogin(response);
    return response;
  } catch {
    return NextResponse.json({ ok: false, error: "Unable to sign in." }, { status: 500 });
  }
}
