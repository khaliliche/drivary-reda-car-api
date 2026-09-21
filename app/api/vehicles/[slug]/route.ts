import { NextRequest, NextResponse } from "next/server";
import { getVehicleBySlug } from "@/lib/db";

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ slug: string }> }
) {
  const { slug } = await params;
  const vehicle = await getVehicleBySlug(slug);

  if (!vehicle) {
    return NextResponse.json({ error: "not_found" }, { status: 404 });
  }

  return NextResponse.json(vehicle);
}