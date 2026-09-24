import type { MetadataRoute } from "next";
import { getVehicles } from "@/lib/db";

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const base = "https://drivarycar.com";

  const staticRoutes = ["", "/vehicules"].map((path) => ({
    url: `${base}${path}`,
    lastModified: new Date(),
  }));

  const vehicles = await getVehicles();

  const vehicleRoutes = vehicles.map((v) => ({
    url: `${base}/vehicules/${v.slug}`,
    lastModified: new Date(),
  }));

  return [...staticRoutes, ...vehicleRoutes];
}
