export function calculateBookingPricing(pricePerNight: number, depositPercent: number, totalNights: number) {
  const totalAmount = pricePerNight * totalNights;
  const depositAmount = Math.round((totalAmount * depositPercent) / 100);
  return { totalAmount, depositAmount, remainingAmount: totalAmount - depositAmount };
}

export function dateRangesOverlap(existingCheckIn: Date, existingCheckOut: Date, newCheckIn: Date, newCheckOut: Date) {
  return existingCheckIn < newCheckOut && existingCheckOut > newCheckIn;
}
