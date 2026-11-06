import { Webhook } from "svix";
import { headers } from "next/headers";
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import {
  SEED_WALLET_BALANCE_KOBO,
  SEED_CARD_BALANCE_CENTS,
  SEED_CARD_MASKED_PAN,
} from "@/lib/config";

export async function POST(req: NextRequest) {
  const webhookSecret = process.env.CLERK_WEBHOOK_SECRET;
  const headerPayload = await headers();
  const svixId = headerPayload.get("svix-id");
  const svixTimestamp = headerPayload.get("svix-timestamp");
  const svixSignature = headerPayload.get("svix-signature");

  const body = await req.text();

  let evt: {
    type: string;
    data: {
      id: string;
      email_addresses?: Array<{ email_address: string; id: string }>;
      first_name?: string;
      last_name?: string;
    };
  };

  if (webhookSecret) {
    if (!svixId || !svixTimestamp || !svixSignature) {
      return NextResponse.json(
        { error: "Missing svix headers" },
        { status: 400 }
      );
    }

    const wh = new Webhook(webhookSecret);
    try {
      wh.verify(body, {
        "svix-id": svixId,
        "svix-timestamp": svixTimestamp,
        "svix-signature": svixSignature,
      });
      evt = JSON.parse(body);
    } catch (err) {
      console.error("Clerk webhook verification failed:", err);
      return NextResponse.json(
        { error: "Webhook verification failed" },
        { status: 400 }
      );
    }
  } else {
    // Fallback for local testing if CLERK_WEBHOOK_SECRET is not configured
    try {
      evt = JSON.parse(body);
    } catch {
      return NextResponse.json(
        { error: "Invalid JSON payload" },
        { status: 400 }
      );
    }
  }

  const { type, data } = evt;

  if (type === "user.created") {
    const clerkUserId = data.id;
    const primaryEmail =
      data.email_addresses?.[0]?.email_address ||
      `${clerkUserId}@placeholder.cleva.ai`;
    const name =
      [data.first_name, data.last_name].filter(Boolean).join(" ") || "User";

    // Atomically create or link User + Wallet + Card in a single transaction
    await prisma.$transaction(async (tx) => {
      let user = await tx.user.findUnique({
        where: { clerkUserId },
      });

      if (!user) {
        // Check if user exists by email (e.g. pre-seeded demo user)
        const existingByEmail = await tx.user.findUnique({
          where: { email: primaryEmail },
        });

        if (existingByEmail) {
          user = await tx.user.update({
            where: { id: existingByEmail.id },
            data: {
              clerkUserId,
              name: existingByEmail.name || name,
            },
          });
        } else {
          user = await tx.user.create({
            data: {
              clerkUserId,
              email: primaryEmail,
              name,
              demoOutcome: "SUCCESS",
            },
          });
        }
      }

      // Check wallet idempotently
      const existingWallet = await tx.wallet.findUnique({
        where: { userId: user.id },
      });

      if (!existingWallet) {
        await tx.wallet.create({
          data: {
            userId: user.id,
            currency: "NGN",
            availableBalanceKobo: SEED_WALLET_BALANCE_KOBO,
          },
        });
      }

      // Check card idempotently
      const existingCard = await tx.virtualCard.findFirst({
        where: { userId: user.id },
      });

      if (!existingCard) {
        await tx.virtualCard.create({
          data: {
            userId: user.id,
            provider: "MOCK_CLEVA",
            currency: "USD",
            status: "ACTIVE",
            maskedPan: SEED_CARD_MASKED_PAN,
            balanceCents: SEED_CARD_BALANCE_CENTS,
          },
        });
      }
    });

    return NextResponse.json({ ok: true, message: "User provisioned" });
  }

  if (type === "user.deleted") {
    // Soft no-op for the hackathon (do not delete financial history) — just log.
    console.log(`Clerk user.deleted received for ID: ${data.id} (soft no-op)`);
    return NextResponse.json({ ok: true, message: "User deletion logged" });
  }

  return NextResponse.json({ ok: true });
}
