import { NextRequest, NextResponse } from "next/server";
import { requireUser } from "@/lib/auth/require-user";
import { SIMULATION_LABEL } from "@/lib/config";
import { formatUsd } from "@/lib/money";

export async function GET(req: NextRequest) {
  const userContext = await requireUser(req);
  if (!userContext) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { card } = userContext;

  return NextResponse.json(
    {
      simulation: SIMULATION_LABEL,
      card: {
        provider: card.provider,
        currency: card.currency,
        status: card.status,
        maskedPan: card.maskedPan,
        balanceCents: card.balanceCents,
        display: formatUsd(card.balanceCents),
      },
    },
    { status: 200 }
  );
}
