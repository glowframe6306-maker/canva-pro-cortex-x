import { NextRequest, NextResponse } from "next/server";
import { hasAdminSession } from "@/lib/admin-auth";

export function GET(request: NextRequest) {
  return NextResponse.json({ authenticated: hasAdminSession(request) });
}
