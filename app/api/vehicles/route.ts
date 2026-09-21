import { NextRequest, NextResponse } from "next/server";
import { getAvailableVehicles } from "@/lib/db";

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const startDate = searchParams.get("start_date") ?? undefined;
  const endDate = searchParams.get("end_date") ?? undefined;

  const vehicles = await getAvailableVehicles(startDate, endDate);
  return NextResponse.json(vehicles);
}