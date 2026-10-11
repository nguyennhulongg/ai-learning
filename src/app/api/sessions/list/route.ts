import { NextResponse } from "next/server";
import { db } from "@/db";
import { sessions } from "@/db/schema";
import { desc, sql } from "drizzle-orm";

export async function GET() {
  try {
    const allSessions = await db
      .select()
      .from(sessions)
      .orderBy(
        sql`case when is_pinned = true then 0 else 1 end, ${sessions.createdAt} desc`
      );
    return NextResponse.json(allSessions);
  } catch (error) {
    console.error("Error fetching sessions:", error);
    return NextResponse.json(
      { error: "Failed to fetch sessions" },
      { status: 500 }
    );
  }
}
