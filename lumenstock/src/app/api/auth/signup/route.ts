import { NextResponse } from "next/server";
import { createUser } from "@/lib/authStore";

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as {
      name?: string;
      email?: string;
      password?: string;
    };
    const name = (body.name || "").trim();
    const email = (body.email || "").trim();
    const password = body.password || "";

    if (!name || !email || !password) {
      return NextResponse.json({ error: "Name, email, and password are required." }, { status: 400 });
    }

    const result = createUser({ name, email, password });
    if (!result.ok) {
      return NextResponse.json({ error: result.error }, { status: 409 });
    }

    return NextResponse.json({
      user: result.user,
      notice: {
        cards: "We do not store card details.",
        renewal:
          "Subscriptions are not auto-renewed. Before your plan ends we email you a payment link to renew.",
      },
    });
  } catch {
    return NextResponse.json({ error: "Could not create account." }, { status: 500 });
  }
}
