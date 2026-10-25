import { NextRequest, NextResponse } from "next/server";
import { generateAuthenticationOptions, verifyAuthenticationResponse } from "@simplewebauthn/server";
import { createAdminSession, getWebAuthnChallenge, setWebAuthnChallenge, clearWebAuthnChallenge } from "@/lib/admin-auth";
import { getAdminCredential, hasRegisteredAdminPasskey, updateAdminCredentialCounter } from "@/lib/admin-webauthn";

const rpID = process.env.WEBAUTHN_RP_ID || "localhost";
const origin = process.env.WEBAUTHN_ORIGIN || "http://localhost:3000";

export async function GET() {
  if (!(await hasRegisteredAdminPasskey())) return NextResponse.json({ ok: false, error: "Face ID is not configured yet." }, { status: 404 });
  const options = await generateAuthenticationOptions({ rpID, userVerification: "required" });
  const response = NextResponse.json({ ok: true, options });
  setWebAuthnChallenge(response, options.challenge, "authentication");
  return response;
}

export async function POST(request: NextRequest) {
  const expectedChallenge = getWebAuthnChallenge(request, "authentication");
  const credential = await getAdminCredential();
  if (!expectedChallenge || !credential) return NextResponse.json({ ok: false, error: "Face ID login expired or is not configured." }, { status: 401 });

  try {
    const result = await verifyAuthenticationResponse({
      response: await request.json(),
      expectedChallenge,
      expectedOrigin: origin,
      expectedRPID: rpID,
      credential,
      requireUserVerification: true,
    });
    if (!result.verified) return NextResponse.json({ ok: false, error: "Face ID verification failed." }, { status: 401 });

    await updateAdminCredentialCounter(result.authenticationInfo.newCounter);
    const response = NextResponse.json({ ok: true });
    createAdminSession(response);
    clearWebAuthnChallenge(response);
    return response;
  } catch {
    return NextResponse.json({ ok: false, error: "Face ID verification failed." }, { status: 401 });
  }
}
