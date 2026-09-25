export function getTieredPricing(pricePerDay: number) {
  return { price_extended_15: pricePerDay, price_monthly_30: pricePerDay };
}