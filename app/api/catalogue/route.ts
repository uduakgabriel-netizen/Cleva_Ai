import { NextResponse } from "next/server";
import { CATALOGUE } from "@/lib/merchants/catalogue";
import { formatUsd } from "@/lib/money";

export async function GET() {
  const merchants = CATALOGUE.map((plan) => {
    const usd = formatUsd(plan.usdAmountCents);
    const intervalLabel =
      plan.interval === "MONTHLY"
        ? "month"
        : plan.interval === "YEARLY"
          ? "year"
          : "one-time";

    return {
      slug: plan.merchantSlug,
      name: plan.merchantName,
      plans: [
        {
          planId: plan.planId,
          planName: plan.planName,
          usdAmountCents: plan.usdAmountCents,
          interval: plan.interval,
          display: {
            usd,
            billing: `${usd} / ${intervalLabel}`,
          },
        },
      ],
    };
  });

  return NextResponse.json(
    {
      merchants,
      simulation:
        "Catalogue prices are demo reference values, not live merchant prices.",
    },
    { status: 200 }
  );
}
