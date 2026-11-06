import { NextResponse } from "next/server";
import { requireUser } from "@/lib/auth/require-user";

export async function GET() {
  const context = await requireUser();

  if (!context) {
    return NextResponse.json(
      { error: "Unauthorized or user provisioning pending" },
      { status: 401 }
    );
  }

  return NextResponse.json({
    user: {
      id: context.user.id,
      email: context.user.email,
      name: context.user.name,
      demoOutcome: context.user.demoOutcome,
    },
    wallet: {
      currency: context.wallet.currency,
      availableBalanceKobo: context.wallet.availableBalanceKobo,
    },
    card: {
      status: context.card.status,
      maskedPan: context.card.maskedPan,
      balanceCents: context.card.balanceCents,
    },
  });
}
