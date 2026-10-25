import { NextRequest, NextResponse } from "next/server";
import { clearAdminSession, revokeAdminSession } from "@/lib/admin-auth";

export function POST(request: NextRequest) {
  revokeAdminSession(request);
  const response = NextResponse.json({ ok: true });
  clearAdminSession(response);
  return response;
}
