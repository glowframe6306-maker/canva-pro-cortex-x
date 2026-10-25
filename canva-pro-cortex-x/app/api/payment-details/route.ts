import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

export async function GET() {
  return NextResponse.json({
    bankName: process.env.PAYMENT_BANK_NAME || "",
    accountName: process.env.PAYMENT_ACCOUNT_NAME || "",
    accountNumber: process.env.PAYMENT_ACCOUNT_NUMBER || "",
    branch: process.env.PAYMENT_BRANCH || "",
    branchCode: process.env.PAYMENT_BRANCH_CODE || "",
    swiftCode: process.env.PAYMENT_SWIFT_CODE || "",
  });
}