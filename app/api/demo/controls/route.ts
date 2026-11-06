import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { requireUser } from "@/lib/auth/require-user";
import { prisma } from "@/lib/db";

const demoControlsSchema = z.object({
  demoOutcome: z.enum(["SUCCESS", "DECLINE", "INSUFFICIENT_FUNDS"]),
});

export async function PATCH(req: NextRequest) {
  // Guard: DEMO_MODE must be true
  if (process.env.DEMO_MODE !== "true") {
    return NextResponse.json(
      { error: "NOT_FOUND", message: "Demo controls endpoint disabled" },
      { status: 404 }
    );
  }

  const userContext = await requireUser(req);
  if (!userContext) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  let jsonBody: unknown;
  try {
    jsonBody = await req.json();
  } catch {
    return NextResponse.json(
      { error: "VALIDATION", message: "Invalid JSON request body" },
      { status: 400 }
    );
  }

  const parseResult = demoControlsSchema.safeParse(jsonBody);
  if (!parseResult.success) {
    return NextResponse.json(
      {
        error: "VALIDATION",
        message: "Invalid demo controls payload",
        details: parseResult.error.flatten(),
      },
      { status: 400 }
    );
  }

  const updatedUser = await prisma.user.update({
    where: { id: userContext.user.id },
    data: { demoOutcome: parseResult.data.demoOutcome },
  });

  return NextResponse.json(
    {
      user: {
        id: updatedUser.id,
        demoOutcome: updatedUser.demoOutcome,
      },
    },
    { status: 200 }
  );
}
