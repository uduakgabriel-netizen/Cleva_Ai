import { NextRequest, NextResponse } from "next/server";
import { requireUser } from "@/lib/auth/require-user";
import { createPaymentIntentSchema } from "@/lib/validation";
import { getIntentParser } from "@/lib/ai/parser";
import { resolveMerchant } from "@/lib/merchants/resolve";
import { buildQuote } from "@/lib/pricing/quote";
import { prisma } from "@/lib/db";
import { SIMULATION_LABEL } from "@/lib/config";
import { formatDisplayNgn } from "@/lib/money";

export async function POST(req: NextRequest) {
  // 1. requireUser() → 401 if no session
  const userContext = await requireUser(req);
  if (!userContext) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  // 2. zod-parse body → 400 VALIDATION on failure
  let jsonBody: unknown;
  try {
    jsonBody = await req.json();
  } catch {
    return NextResponse.json(
      { error: "VALIDATION", message: "Invalid JSON request body" },
      { status: 400 }
    );
  }

  const parseResult = createPaymentIntentSchema.safeParse(jsonBody);
  if (!parseResult.success) {
    return NextResponse.json(
      {
        error: "VALIDATION",
        message: "Invalid request payload",
        details: parseResult.error.flatten(),
      },
      { status: 400 }
    );
  }

  const { inputText, url } = parseResult.data;

  // 3. getIntentParser().parse({ text, url })
  const parser = getIntentParser();
  const parsedIntent = await parser.parse({ text: inputText, url });

  // 4. resolveMerchant({ text, url }) — re-validate independently (never trust AI)
  const resolved = resolveMerchant({ text: inputText, url });

  // 5. If unsupported → return 422 MERCHANT_UNSUPPORTED, DO NOT create intent
  if (!resolved.supported) {
    return NextResponse.json(
      {
        error: "MERCHANT_UNSUPPORTED",
        message: "The requested merchant or plan is not supported in the catalogue",
      },
      { status: 422 }
    );
  }

  const { plan } = resolved;

  // 6. Upsert Merchant row by slug
  const merchant = await prisma.merchant.upsert({
    where: { slug: plan.merchantSlug },
    update: {
      name: plan.merchantName,
      supported: true,
    },
    create: {
      slug: plan.merchantSlug,
      name: plan.merchantName,
      supported: true,
    },
  });

  // 7. buildQuote(plan.usdAmountCents)
  const quoteData = buildQuote(plan.usdAmountCents);

  // 8. In one prisma.$transaction:
  //    create PaymentIntent (status AWAITING_APPROVAL, confidence, parsedBy)
  //    create Quote (all fields from buildQuote)
  const parsedBy = process.env.AI_PROVIDER === "gemma" ? "gemma" : "deterministic";

  const { intent, quote } = await prisma.$transaction(async (tx) => {
    const createdIntent = await tx.paymentIntent.create({
      data: {
        userId: userContext.user.id,
        merchantId: merchant.id,
        inputText: inputText ?? null,
        inputUrl: url ?? null,
        planId: plan.planId,
        planName: plan.planName,
        interval: plan.interval,
        confidence: parsedIntent.confidence,
        parsedBy,
        status: "AWAITING_APPROVAL",
      },
    });

    const createdQuote = await tx.quote.create({
      data: {
        intentId: createdIntent.id,
        usdAmountCents: quoteData.usdAmountCents,
        fxRateNgnPerUsd: quoteData.fxRateNgnPerUsd,
        convertedNgnKobo: quoteData.convertedNgnKobo,
        feeNgnKobo: quoteData.feeNgnKobo,
        totalNgnKobo: quoteData.totalNgnKobo,
        assumptions: quoteData.assumptions,
        expiresAt: quoteData.expiresAt,
      },
    });

    return { intent: createdIntent, quote: createdQuote };
  });

  // 9. Format response
  const walletAvailable = userContext.wallet.availableBalanceKobo;
  const sufficientBalance = walletAvailable >= quote.totalNgnKobo;

  const display = {
    usd: `$${(quote.usdAmountCents / 100).toFixed(2)}`,
    convertedNgn: formatDisplayNgn(quote.convertedNgnKobo),
    feeNgn: formatDisplayNgn(quote.feeNgnKobo),
    totalNgn: formatDisplayNgn(quote.totalNgnKobo),
    fxRate: `₦${quote.fxRateNgnPerUsd.toLocaleString("en-US")} / $1`,
    expiresAt: quote.expiresAt.toISOString(),
  };

  return NextResponse.json(
    {
      simulation: SIMULATION_LABEL,
      intent: {
        id: intent.id,
        status: intent.status,
        merchant: merchant.name,
        plan: intent.planName,
        interval: intent.interval,
        confidence: intent.confidence,
        parsedBy: intent.parsedBy,
        quoteId: quote.id,
        display,
        quote: {
          usdAmountCents: quote.usdAmountCents,
          fxRateNgnPerUsd: quote.fxRateNgnPerUsd,
          convertedNgnKobo: quote.convertedNgnKobo,
          feeNgnKobo: quote.feeNgnKobo,
          totalNgnKobo: quote.totalNgnKobo,
          assumptions: quote.assumptions,
          expiresAt: quote.expiresAt.toISOString(),
        },
        walletAvailable,
        sufficientBalance,
      },
    },
    { status: 200 }
  );
}
