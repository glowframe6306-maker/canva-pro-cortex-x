import { NextRequest, NextResponse } from "next/server";
import { getSiteSettings, saveSiteSettings, type FAQItem, type PromoCode } from "@/lib/site-settings";
import { hasAdminSession } from "@/lib/admin-auth";
import { MissingApplicationSettingError } from "@/lib/application-settings-values";

export async function GET(request: NextRequest) {
  try {
    const settings = await getSiteSettings();
    return NextResponse.json({ ok: true, settings });
  } catch (error) {
    if (error instanceof MissingApplicationSettingError) {
      return NextResponse.json(
        { ok: false, error: "Site settings have not been migrated. Restore the existing settings before editing." },
        { status: 503 },
      );
    }
    console.error("Site settings GET error:", error);
    return NextResponse.json({ ok: false, error: "Unable to fetch settings" }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    if (!hasAdminSession(request)) {
      return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });
    }

    const body = await request.json();
    const settings = await saveSiteSettings(body);
    return NextResponse.json({ ok: true, settings });
  } catch (error) {
    if (error instanceof MissingApplicationSettingError) {
      return NextResponse.json(
        { ok: false, error: "Site settings have not been migrated. Restore the existing settings before editing." },
        { status: 503 },
      );
    }
    console.error("Site settings POST error:", error);
    return NextResponse.json({ ok: false, error: "Unable to save settings" }, { status: 500 });
  }
}

export async function PUT(request: NextRequest) {
  try {
    if (!hasAdminSession(request)) {
      return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });
    }

    const body = await request.json();
    const settings = await saveSiteSettings(body);
    return NextResponse.json({ ok: true, settings });
  } catch (error) {
    if (error instanceof MissingApplicationSettingError) {
      return NextResponse.json(
        { ok: false, error: "Site settings have not been migrated. Restore the existing settings before editing." },
        { status: 503 },
      );
    }
    console.error("Site settings PUT error:", error);
    return NextResponse.json({ ok: false, error: "Unable to update settings" }, { status: 500 });
  }
}
