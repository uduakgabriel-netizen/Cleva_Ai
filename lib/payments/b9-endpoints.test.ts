import { describe, it, expect } from "vitest";
import { prisma } from "../db";
import { GET as authMeGet } from "../../app/api/auth/me/route";
import { GET as walletGet } from "../../app/api/wallet/route";
import { GET as cardGet } from "../../app/api/card/route";
import { GET as transactionsGet } from "../../app/api/transactions/route";
import { GET as transactionDetailGet } from "../../app/api/transactions/[id]/route";
import { GET as catalogueGet } from "../../app/api/catalogue/route";
import { PATCH as demoControlsPatch } from "../../app/api/demo/controls/route";
import { POST as demoResetPost } from "../../app/api/demo/reset/route";
import { POST as paymentIntentsPost } from "../../app/api/payment-intents/route";
import { POST as confirmPost } from "../../app/api/payment-intents/[id]/confirm/route";
import { reconcile } from "../../scripts/reconcile";
import { NextRequest } from "next/server";
import { randomUUID } from "crypto";

describe("Stage B9 — Read Endpoints & Demo Controls", () => {
  const getDemoUser = async () => {
    return await prisma.user.findFirstOrThrow({
      where: { email: "demo@cleva.ai" },
      include: { wallet: true, cards: true },
    });
  };

  const reqWithAuth = (url: string, method = "GET", body?: unknown, clerkId?: string) => {
    return new NextRequest(url, {
      method,
      headers: {
        "Content-Type": "application/json",
        ...(clerkId ? { "x-cleva-test-session-clerk-id": clerkId } : {}),
      },
      ...(body ? { body: JSON.stringify(body) } : {}),
    });
  };

  // B1. GET /api/auth/me
  it("B1: GET /api/auth/me returns user object without sensitive internal fields", async () => {
    const demo = await getDemoUser();
    const req = reqWithAuth("http://localhost:3000/api/auth/me", "GET", undefined, demo.clerkUserId!);
    const res = await authMeGet(req);
    expect(res.status).toBe(200);

    const json = await res.json();
    expect(json.user).toBeDefined();
    expect(json.user.id).toBe(demo.id);
    expect(json.user.email).toBe(demo.email);
    expect(json.user.name).toBe(demo.name);
    expect(json.user.createdAt).toBeDefined();

    // Sensitive field guards
    expect(json.user.clerkUserId).toBeUndefined();
    expect(json.user.demoOutcome).toBeUndefined();
  });

  // B2. GET /api/wallet
  it("B2: GET /api/wallet returns wallet details with formatted display and recent ledger", async () => {
    const demo = await getDemoUser();
    const req = reqWithAuth("http://localhost:3000/api/wallet", "GET", undefined, demo.clerkUserId!);
    const res = await walletGet(req);
    expect(res.status).toBe(200);

    const json = await res.json();
    expect(json.simulation).toContain("Simulation only");
    expect(json.wallet.currency).toBe("NGN");
    expect(json.wallet.availableBalanceKobo).toBeTypeOf("number");
    expect(json.wallet.display).toMatch(/^₦[\d,]+$/);
    expect(Array.isArray(json.recentLedger)).toBe(true);

    if (json.recentLedger.length > 0) {
      const entry = json.recentLedger[0];
      expect(entry.display.amount).toBeDefined();
      expect(entry.display.balanceAfter).toBeDefined();
    }
  });

  // B3. GET /api/card
  it("B3: GET /api/card returns masked card, never raw PAN, CVV, or token", async () => {
    const demo = await getDemoUser();
    const req = reqWithAuth("http://localhost:3000/api/card", "GET", undefined, demo.clerkUserId!);
    const res = await cardGet(req);
    expect(res.status).toBe(200);

    const json = await res.json();
    expect(json.card.provider).toBe("MOCK_CLEVA");
    expect(json.card.currency).toBe("USD");
    expect(json.card.status).toBe("ACTIVE");
    expect(json.card.maskedPan).toBe("5399 •••• •••• 4242");
    expect(json.card.display).toMatch(/^\$[\d,.]+/);

    expect(json.card.pan).toBeUndefined();
    expect(json.card.cvv).toBeUndefined();
    expect(json.card.expiry).toBeUndefined();
  });

  // B4. GET /api/transactions
  it("B4: GET /api/transactions returns newest-first list with pagination cursor", async () => {
    const demo = await getDemoUser();
    const req = reqWithAuth("http://localhost:3000/api/transactions?limit=10", "GET", undefined, demo.clerkUserId!);
    const res = await transactionsGet(req);
    expect(res.status).toBe(200);

    const json = await res.json();
    expect(Array.isArray(json.transactions)).toBe(true);
    expect(json.nextCursor).toBeDefined(); // string or null
  });

  // B5. GET /api/transactions/:id
  it("B5: GET /api/transactions/:id returns receipt for owner, 404 for cross-user access", async () => {
    const demo = await getDemoUser();

    // Find or create transaction for demo user
    let tx = await prisma.transaction.findFirst({ where: { userId: demo.id } });
    if (!tx) {
      // Create a test transaction
      const intent = await prisma.paymentIntent.create({
        data: { userId: demo.id, confidence: 1.0, status: "SUCCEEDED" },
      });
      const quote = await prisma.quote.create({
        data: {
          intentId: intent.id,
          usdAmountCents: 1999,
          fxRateNgnPerUsd: 1600,
          convertedNgnKobo: 3198400,
          feeNgnKobo: 50000,
          totalNgnKobo: 3248400,
          assumptions: "test quote",
          expiresAt: new Date(Date.now() + 600000),
        },
      });
      tx = await prisma.transaction.create({
        data: {
          userId: demo.id,
          intentId: intent.id,
          quoteId: quote.id,
          status: "SUCCEEDED",
          usdAmountCents: 1999,
          totalNgnKobo: 3248400,
          receiptId: `CLV-TEST-${Date.now()}`,
          idempotencyKey: `IDEM-TEST-${Date.now()}`,
        },
      });
    }

    // Owner fetch -> 200
    const ownerReq = reqWithAuth(`http://localhost:3000/api/transactions/${tx.id}`, "GET", undefined, demo.clerkUserId!);
    const ownerRes = await transactionDetailGet(ownerReq, { params: Promise.resolve({ id: tx.id }) });
    expect(ownerRes.status).toBe(200);

    const ownerJson = await ownerRes.json();
    expect(ownerJson.transaction.id).toBe(tx.id);
    expect(ownerJson.transaction.display.usd).toBe("$19.99");
    expect(ownerJson.transaction.display.totalNgn).toBe("₦32,484");

    // Cross-user fetch -> 404 (NOT 403). The "other" user must exist (with wallet+card) so
    // requireUser() authenticates them — otherwise this would only prove the 401 (unauthenticated) path.
    const otherUser = await prisma.user.upsert({
      where: { clerkUserId: "user_other_tenant_test" },
      update: {},
      create: { clerkUserId: "user_other_tenant_test", email: "other-tenant@cleva.ai", name: "Other Tenant" },
    });
    await prisma.wallet.upsert({
      where: { userId: otherUser.id },
      update: {},
      create: { userId: otherUser.id, currency: "NGN", availableBalanceKobo: 0 },
    });
    await prisma.virtualCard.upsert({
      where: { id: `${otherUser.id}-seed-card` },
      update: {},
      create: {
        id: `${otherUser.id}-seed-card`,
        userId: otherUser.id,
        maskedPan: "5399 •••• •••• 0000",
      },
    });

    const otherReq = reqWithAuth(`http://localhost:3000/api/transactions/${tx.id}`, "GET", undefined, "user_other_tenant_test");
    const otherRes = await transactionDetailGet(otherReq, { params: Promise.resolve({ id: tx.id }) });
    expect(otherRes.status).toBe(404);
  });

  // B6. GET /api/catalogue
  it("B6: GET /api/catalogue returns all 5 frozen catalogue merchants without auth", async () => {
    const res = await catalogueGet();
    expect(res.status).toBe(200);

    const json = await res.json();
    expect(json.merchants).toHaveLength(5);
    const slugs = json.merchants.map((m: { slug: string }) => m.slug);
    expect(slugs).toEqual(["gemini", "chatgpt", "canva", "github", "coursera"]);
    expect(json.simulation).toContain("demo reference values");
  });

  // B7. PATCH /api/demo/controls
  it("B7: PATCH /api/demo/controls updates demoOutcome when DEMO_MODE=true, returns 404 when disabled", async () => {
    const demo = await getDemoUser();

    // With DEMO_MODE=true
    process.env.DEMO_MODE = "true";
    const req = reqWithAuth(
      "http://localhost:3000/api/demo/controls",
      "PATCH",
      { demoOutcome: "DECLINE" },
      demo.clerkUserId!
    );
    const res = await demoControlsPatch(req);
    expect(res.status).toBe(200);

    const json = await res.json();
    expect(json.user.demoOutcome).toBe("DECLINE");

    // Reset back to SUCCESS
    const reqReset = reqWithAuth(
      "http://localhost:3000/api/demo/controls",
      "PATCH",
      { demoOutcome: "SUCCESS" },
      demo.clerkUserId!
    );
    await demoControlsPatch(reqReset);

    // With DEMO_MODE=false -> 404
    process.env.DEMO_MODE = "false";
    const reqDisabled = reqWithAuth(
      "http://localhost:3000/api/demo/controls",
      "PATCH",
      { demoOutcome: "DECLINE" },
      demo.clerkUserId!
    );
    const resDisabled = await demoControlsPatch(reqDisabled);
    expect(resDisabled.status).toBe(404);
    process.env.DEMO_MODE = "true";
  });

  // B8. POST /api/demo/reset
  it("B8: POST /api/demo/reset resets balances to 10M / $0, clears demo user history, reconciliation passes", async () => {
    const demo = await getDemoUser();
    process.env.DEMO_MODE = "true";

    const req = reqWithAuth("http://localhost:3000/api/demo/reset", "POST", {}, demo.clerkUserId!);
    const res = await demoResetPost(req);
    expect(res.status).toBe(200);

    const json = await res.json();
    expect(json.ok).toBe(true);
    expect(json.walletDisplay).toBe("₦100,000");
    expect(json.cardDisplay).toBe("$0.00");

    const wallet = await prisma.wallet.findUnique({ where: { userId: demo.id } });
    const card = await prisma.virtualCard.findFirst({ where: { userId: demo.id } });
    const ledger = await prisma.ledgerEntry.findMany({ where: { userId: demo.id } });

    expect(wallet!.availableBalanceKobo).toBe(10_000_000);
    expect(card!.balanceCents).toBe(0);
    expect(card!.status).toBe("ACTIVE");
    expect(ledger).toHaveLength(0);

    // Reconciliation check
    const rec = await reconcile();
    expect(rec.walletBalanceKobo).toBe(10_000_000);
    expect(rec.cardBalanceCents).toBe(0);
  });

  // Full Demo Cycle
  it("Full Demo Cycle: reset -> pay Gemini -> wallet -₦32,484 -> history shows 1 -> reset -> wallet ₦100,000", async () => {
    const demo = await getDemoUser();
    process.env.DEMO_MODE = "true";

    // 1. Reset
    const resetReq1 = reqWithAuth("http://localhost:3000/api/demo/reset", "POST", {}, demo.clerkUserId!);
    await demoResetPost(resetReq1);

    // 2. Pay Gemini
    const intentReq = reqWithAuth("http://localhost:3000/api/payment-intents", "POST", { inputText: "Pay for Gemini Advanced" }, demo.clerkUserId!);
    const intentRes = await paymentIntentsPost(intentReq);
    const intentJson = await intentRes.json();

    const confirmReq = reqWithAuth(
      `http://localhost:3000/api/payment-intents/${intentJson.intent.id}/confirm`,
      "POST",
      { quoteId: intentJson.intent.quoteId, idempotencyKey: randomUUID() },
      demo.clerkUserId!
    );
    const confirmRes = await confirmPost(confirmReq, { params: Promise.resolve({ id: intentJson.intent.id }) });
    expect(confirmRes.status).toBe(200);

    // 3. Check wallet debited by -₦32,484 (balance = ₦67,516)
    const walletReq = reqWithAuth("http://localhost:3000/api/wallet", "GET", undefined, demo.clerkUserId!);
    const walletRes = await walletGet(walletReq);
    const walletJson = await walletRes.json();
    expect(walletJson.wallet.availableBalanceKobo).toBe(6_751_600);
    expect(walletJson.wallet.display).toBe("₦67,516");

    // 4. Check history shows 1 transaction
    const txReq = reqWithAuth("http://localhost:3000/api/transactions", "GET", undefined, demo.clerkUserId!);
    const txRes = await transactionsGet(txReq);
    const txJson = await txRes.json();
    expect(txJson.transactions).toHaveLength(1);
    expect(txJson.transactions[0].display.totalNgn).toBe("₦32,484");

    // 5. Reset again -> wallet back to ₦100,000, 0 transactions
    const resetReq2 = reqWithAuth("http://localhost:3000/api/demo/reset", "POST", {}, demo.clerkUserId!);
    await demoResetPost(resetReq2);

    const walletReq2 = reqWithAuth("http://localhost:3000/api/wallet", "GET", undefined, demo.clerkUserId!);
    const walletRes2 = await walletGet(walletReq2);
    const walletJson2 = await walletRes2.json();
    expect(walletJson2.wallet.availableBalanceKobo).toBe(10_000_000);
    expect(walletJson2.wallet.display).toBe("₦100,000");

    const txReq2 = reqWithAuth("http://localhost:3000/api/transactions", "GET", undefined, demo.clerkUserId!);
    const txRes2 = await transactionsGet(txReq2);
    const txJson2 = await txRes2.json();
    expect(txJson2.transactions).toHaveLength(0);

    console.log("Full demo cycle completed and verified successfully!");
  });
});
