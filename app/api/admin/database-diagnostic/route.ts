import { currentUser } from "@clerk/nextjs/server";
import { NextResponse } from "next/server";
import { getSafeDatabaseDiagnostic } from "@/lib/admin/database-diagnostic";
import { isOperatorEmail } from "@/lib/admin/operator";

export async function GET() {
  const user = await currentUser();
  const email = user?.emailAddresses[0]?.emailAddress;
  if (!isOperatorEmail(email)) {
    return NextResponse.json({ error: "Operator access is required." }, { status: 403 });
  }

  // Temporary diagnostic utility: remove after the production database migration issue is resolved.
  try {
    return NextResponse.json(getSafeDatabaseDiagnostic());
  } catch {
    return NextResponse.json({ error: "DATABASE_URL could not be parsed safely." }, { status: 500 });
  }
}
