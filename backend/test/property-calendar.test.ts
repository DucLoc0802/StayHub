import 'reflect-metadata';
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { BookingsService } from '../src/bookings/bookings.service';
import { PrismaService } from '../src/prisma/prisma.service';
import { InventoryService } from '../src/bookings/inventory.service';

test('property calendar batches rooms and uses the existing inventory engine for cheapest bookable prices', async () => {
  let queries = 0;
  const tx = {
    property: { findFirst: async () => {
      queries++;
      return { roomTypes: [
        { id: 'standard', pricePerNight: 500000, totalUnits: 7 },
        { id: 'deluxe', pricePerNight: 800000, totalUnits: 5 },
      ] };
    } },
    booking: { findMany: async () => {
      queries++;
      return [
        ['standard', '09', '10', 7], ['deluxe', '09', '10', 2],
        ['standard', '11', '12', 3], ['standard', '12', '13', 6],
        ['standard', '13', '14', 7], ['deluxe', '13', '14', 5],
      ].map(([roomTypeId, from, to, quantity]) => ({
        roomTypeId, quantity, checkIn: new Date(`2027-10-${from}`), checkOut: new Date(`2027-10-${to}`),
      }));
    } },
  };
  const prisma = { $transaction: (work: (client: typeof tx) => unknown) => work(tx) } as unknown as PrismaService;
  const service = new BookingsService(prisma, {} as InventoryService);
  const result = await service.propertyCalendar('property', { checkIn: '2027-10-09', checkOut: '2027-10-14' });
  assert.equal(queries, 2);
  assert.deepEqual(result.days.map(({ pricePerNight, availableUnits }) => [pricePerNight, availableUnits]), [
    [800000, 3], [500000, 7], [500000, 4], [500000, 1], [null, 0],
  ]);
});
