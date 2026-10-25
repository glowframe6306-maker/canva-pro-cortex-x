import { NextRequest, NextResponse } from "next/server";
import { generateRegistrationOptions, verifyRegistrationResponse } from "@simplewebauthn/server";
import { hasAdminSession, getWebAuthnChallenge, setWebAuthnChallenge, clearWebAuthnChallenge } from "@/lib/admin-auth";
import { getAdminCredential, hasRegisteredAdminPasskey, saveAdminCredential } from "@/lib/admin-webauthn";

const rpID = process.env.WEBAUTHN_RP_ID || "localhost";
const origin = process.env.WEBAUTHN_ORIGIN || "http://localhost:3000";

export async function GET(request: NextRequest) {
  if (!hasAdminSession(request)) return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });
  const existing = await hasRegisteredAdminPasskey();
  const existingCredential = existing ? await getAdminCredential() : null;
  const options = await generateRegistrationOptions({
    rpName: "MI CORTEX X INC. Admin",
    rpID,
    userName: process.env.ADMIN_USERNAME || "admin",
    userDisplayName: "MI CORTEX X Administrator",
    authenticatorSelection: { residentKey: "required", userVerification: "required" },
    excludeCredentials: existingCredential ? [{ id: existingCredential.id, transports: existingCredential.transports }] : [],
    preferredAuthenticatorType: "localDevice",
  });
  const response = NextResponse.json({ ok: true, options });
  setWebAuthnChallenge(response, options.challenge, "registration");
  return response;
}

export async function POST(request: NextRequest) {
  if (!hasAdminSession(request)) return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });
  const expectedChallenge = getWebAuthnChallenge(request, "registration");
  if (!expectedChallenge) return NextResponse.json({ ok: false, error: "Registration expired. Try again." }, { status: 401 });

  try {
    const result = await verifyRegistrationResponse({
      response: await request.json(),
      expectedChallenge,
      expectedOrigin: origin,
      expectedRPID: rpID,
      requireUserVerification: true,
    });
    if (!result.verified) return NextResponse.json({ ok: false, error: "Face ID registration failed." }, { status: 400 });

    const credential = result.registrationInfo.credential;
    await saveAdminCredential({
      id: credential.id,
      publicKey: Buffer.from(credential.publicKey).toString("base64url"),
      counter: credential.counter,
      transports: credential.transports,
    });
    const response = NextResponse.json({ ok: true });
    clearWebAuthnChallenge(response);
    return response;
  } catch {
    return NextResponse.json({ ok: false, error: "Face ID registration failed." }, { status: 400 });
  }
}
