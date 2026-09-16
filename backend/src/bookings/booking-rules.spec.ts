import { calculateBookingPricing, dateRangesOverlap } from './booking-rules';

describe('booking rules', () => {
  it('calculates a property-specific deposit from integer VND snapshots', () => {
    expect(calculateBookingPricing(1_000_000, 40, 3)).toEqual({ totalAmount: 3_000_000, depositAmount: 1_200_000, remainingAmount: 1_800_000 });
  });

  it('treats checkout as exclusive so adjacent bookings are allowed', () => {
    const existingIn = new Date('2027-10-10T00:00:00Z');
    const existingOut = new Date('2027-10-15T00:00:00Z');
    expect(dateRangesOverlap(existingIn, existingOut, new Date('2027-10-15T00:00:00Z'), new Date('2027-10-18T00:00:00Z'))).toBe(false);
    expect(dateRangesOverlap(existingIn, existingOut, new Date('2027-10-14T00:00:00Z'), new Date('2027-10-18T00:00:00Z'))).toBe(true);
  });
});
