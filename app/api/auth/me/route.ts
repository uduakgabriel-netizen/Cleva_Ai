import { NextRequest, NextResponse } from "next/server";
import { requireUser } from "@/lib/auth/require-user";

export async function GET(req?: NextRequest) {
  const userContext = await requireUser(req);

  if (!userContext) {
    return NextResponse.json(
      { error: "Unauthorized" },
      { status: 401 }
    );
  }

  const { user } = userContext;

  return NextResponse.json(
    {
      user: {
        id: user.id,
        email: user.email,
        name: user.name,
        createdAt: user.createdAt.toISOString(),
      },
    },
    { status: 200 }
  );
}
