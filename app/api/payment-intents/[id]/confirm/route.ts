import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { requireUser } from "@/lib/auth/require-user";
import { confirmPaymentIntent } from "@/lib/payments/orchestrator";
import { AppError } from "@/lib/errors";
import { SIMULATION_LABEL } from "@/lib/config";
import { formatDisplayNgn, formatUsd } from "@/lib/money";

const confirmBodySchema = z.object({
  quoteId: z.string().min(1, "quoteId is required"),
  idempotencyKey: z
    .string()
    .min(8, "idempotencyKey must be at least 8 characters")
    .max(128, "idempotencyKey must be at most 128 characters"),
});

export async function POST(
  req: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  // 1. requireUser() → 401 if null
  const userContext = await requireUser(req);
  if (!userContext) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id: intentId } = await context.params;

  // 2. Parse body → 400 VALIDATION on failure
  let jsonBody: unknown;
  try {
    jsonBody = await req.json();
  } catch {
    return NextResponse.json(
      { error: "VALIDATION", message: "Invalid JSON request body" },
      { status: 400 }
    );
  }

  const parseResult = confirmBodySchema.safeParse(jsonBody);
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

  const { quoteId, idempotencyKey } = parseResult.data;

  // 3. Confirm flow
  try {
    const { transaction, idempotentReplay } = await confirmPaymentIntent({
      userId: userContext.user.id,
      intentId,
      quoteId,
      idempotencyKey,
    });

    // 4. Return 200 OK
    return NextResponse.json(
      {
        simulation: SIMULATION_LABEL,
        idempotentReplay,
        transaction: {
          id: transaction.id,
          status: transaction.status,
          receiptId: transaction.receiptId,
          authorizationCode: transaction.authorizationCode,
          declineReason: transaction.declineReason,
          usdAmountCents: transaction.usdAmountCents,
          totalNgnKobo: transaction.totalNgnKobo,
          display: {
            usd: formatUsd(transaction.usdAmountCents),
            totalNgn: formatDisplayNgn(transaction.totalNgnKobo),
            status: transaction.status,
          },
        },
      },
      { status: 200 }
    );
  } catch (err: unknown) {
    if (err instanceof AppError) {
      return NextResponse.json(
        {
          error: err.code,
          message: err.message,
          details: err.details,
        },
        { status: err.statusCode }
      );
    }

    console.error("Unhandled error during confirmPaymentIntent:", err);
    return NextResponse.json(
      { error: "INTERNAL_ERROR", message: "An unexpected error occurred" },
      { status: 500 }
    );
  }
}
