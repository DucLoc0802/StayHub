import 'reflect-metadata';
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { createRequire } from 'node:module';
import { NestFactory } from '@nestjs/core';
import { ValidationPipe } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { PrismaService } from '../src/prisma/prisma.service';
import { ApiExceptionFilter } from '../src/common/errors';

const database = process.env.INVENTORY_TEST_DATABASE_URL;
test(
  'business features enforce profile, booking access, snapshots, feedback and admin permissions over HTTP',
  { skip: !database },
  async (t) => {
    assert.match(
      new URL(database!).pathname,
      /^\/stayhub_(inventory|seed)_test$/,
    );
    process.env.DATABASE_URL = database;
    process.env.JWT_SECRET =
      'synthetic-test-secret-with-at-least-32-characters';
    // Use Nest's compiled decorator metadata, which tsx/esbuild does not emit.
    const load = createRequire(process.cwd() + '/package.json');
    const { AppModule } = load('./dist/app.module.js');
    const { PrismaService: RuntimePrismaService } = load(
      './dist/prisma/prisma.service.js',
    );
    const app = await NestFactory.create(AppModule, { logger: false });
    app.setGlobalPrefix('api');
    app.useGlobalPipes(
      new ValidationPipe({
        whitelist: true,
        forbidNonWhitelisted: true,
        transform: true,
      }),
    );
    app.useGlobalFilters(new ApiExceptionFilter());
    await app.listen(0, '127.0.0.1');
    const base = `${await app.getUrl()}/api`,
      prisma = app.get<PrismaService>(RuntimePrismaService),
      jwt = app.get(JwtService);
    const users: string[] = [],
      properties: string[] = [],
      amenities: string[] = [];
    const makeUser = async (
      role: 'GUEST' | 'HOST' | 'ADMIN',
      phoneNumber: string | null = '0901234567',
    ) => {
      const user = await prisma.user.create({
        data: {
          email: `${randomUUID()}@synthetic.test`,
          fullName: 'Khách tổng hợp',
          phoneNumber,
          passwordHash: 'unused-test-hash',
          role,
          status: 'ACTIVE',
        },
      });
      users.push(user.id);
      return { ...user, token: await jwt.signAsync({ sub: user.id }) };
    };
    const request = async (
      method: string,
      path: string,
      token: string | undefined,
      body: unknown = undefined,
      status = 200,
    ) => {
      const response = await fetch(base + path, {
        method,
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        ...(body === undefined ? {} : { body: JSON.stringify(body) }),
      });
      const json = await response.json();
      assert.equal(
        response.status,
        status,
        `${method} ${path}: ${JSON.stringify(json)}`,
      );
      return json;
    };
    try {
      const admin = await makeUser('ADMIN'),
        host = await makeUser('HOST'),
        strangerHost = await makeUser('HOST'),
        guest = await makeUser('GUEST'),
        stranger = await makeUser('GUEST'),
        incomplete = await makeUser('GUEST', null);
      const amenity = await request(
        'POST',
        '/admin/amenities',
        admin.token,
        {
          code: `TEST_${randomUUID().replace(/-/g, '').toUpperCase()}`,
          nameVi: 'Tiện ích tổng hợp',
          active: true,
        },
        201,
      );
      amenities.push(amenity.id);
      const roomFields = {
        name: 'Phòng tổng hợp',
        description: 'Phòng thử nghiệm',
        pricePerNight: 600000,
        totalUnits: 10,
        maxGuests: 2,
        bedrooms: 1,
        beds: 1,
        bathrooms: 1,
        status: 'ACTIVE',
      };
      const propertyPayload = {
        name: `Cơ sở tổng hợp ${randomUUID()}`,
        type: 'HOTEL',
        description: 'Cơ sở tổng hợp dùng cho kiểm thử nghiệp vụ.',
        district: 'Quận 1',
        address: 'Địa chỉ tổng hợp không phải địa chỉ thật',
        depositPercent: 30,
        paymentWindowHours: 6,
        checkInTime: '14:00',
        checkOutTime: '12:00',
        images: ['https://example.com/synthetic.jpg'],
        amenityIds: [amenity.id],
        roomTypes: [
          roomFields,
          {
            ...roomFields,
            name: 'Phòng gia đình',
            pricePerNight: 1200000,
            totalUnits: 3,
            beds: 2,
            maxGuests: 4,
          },
        ],
      };
      const property = await request(
        'POST',
        '/host/properties',
        host.token,
        propertyPayload,
        201,
      );
      properties.push(property.id);
      const dates = {
        checkIn: new Date(Date.now() + 30 * 86400000)
          .toISOString()
          .slice(0, 10),
        checkOut: new Date(Date.now() + 32 * 86400000)
          .toISOString()
          .slice(0, 10),
      };
      const payload = {
        ...dates,
        roomTypeId: property.roomTypes[0].id,
        quantity: 2,
        guestCount: 4,
      };
      await t.test('batched Property calendar excludes inactive inventory and projects the cheapest bookable daily price', async () => {
        const fixtureIds: string[] = [];
        const start = new Date(Date.now() + 90 * 86400000);
        start.setUTCHours(0, 0, 0, 0);
        const at = (offset: number) => new Date(start.getTime() + offset * 86400000);
        const rooms = property.roomTypes;
        const inactive = await prisma.roomType.create({ data: {
          ...roomFields, propertyId: property.id, name: 'Inactive cheaper', pricePerNight: 1, status: 'INACTIVE',
        } });
        try {
          for (const [roomTypeId, offset, quantity] of [
            [rooms[0].id, 0, 10], [rooms[0].id, 2, 6], [rooms[0].id, 3, 9],
            [rooms[0].id, 4, 10], [rooms[1].id, 4, 3],
          ] as [string, number, number][]) {
            const row = await prisma.booking.create({ data: {
              bookingCode: `STB-${randomUUID()}`, guestId: guest.id, roomTypeId, quantity,
              guestCount: 1, checkIn: at(offset), checkOut: at(offset + 1),
              roomTypeNameSnapshot: 'Calendar fixture', nightlyPriceSnapshot: 1, totalNights: 1,
              totalAmount: quantity, depositPercentSnapshot: 0, depositAmount: 0, remainingAmount: quantity,
              paymentDeadlineAt: new Date(), status: 'CONFIRMED',
            } });
            fixtureIds.push(row.id);
          }
          const query = `checkIn=${at(0).toISOString().slice(0, 10)}&checkOut=${at(5).toISOString().slice(0, 10)}`;
          const calendar = await request('GET', `/properties/${property.id}/calendar?${query}`, undefined);
          assert.deepEqual(calendar.days.map((day: { pricePerNight: number | null; availableUnits: number }) => [day.pricePerNight, day.availableUnits]), [
            [1200000, 3], [600000, 10], [600000, 4], [600000, 1], [null, 0],
          ]);
          const availability = await request('GET', `/room-types/${rooms[0].id}/availability?${query}`, undefined);
          assert.deepEqual(availability.days.map((day: { availableUnits: number }) => day.availableUnits), [0, 10, 4, 1, 0]);
          await request('GET', `/properties/${property.id}/calendar?checkIn=bad&checkOut=bad`, undefined, undefined, 400);
        } finally {
          await prisma.booking.deleteMany({ where: { id: { in: fixtureIds } } });
          await prisma.roomType.delete({ where: { id: inactive.id } });
        }
      });
      await t.test(
        'incomplete guest browses but cannot book; profile updates are self-only and validated',
        async () => {
          await request('GET', `/properties/${property.slug}`, undefined);
          await request('POST', '/bookings', incomplete.token, payload, 403);
          await request(
            'PATCH',
            '/auth/profile',
            incomplete.token,
            { fullName: 'Khách tổng hợp', phoneNumber: '123' },
            400,
          );
          await request(
            'PATCH',
            '/auth/profile',
            incomplete.token,
            {
              fullName: 'Khách tổng hợp',
              phoneNumber: '0901234567',
              id: guest.id,
            },
            400,
          );
          const saved = await request(
            'PATCH',
            '/auth/profile',
            incomplete.token,
            { fullName: 'Khách hoàn thiện', phoneNumber: '+84901234567' },
          );
          assert.equal(saved.id, incomplete.id);
          assert.equal(saved.passwordHash, undefined);
          for (const phoneNumber of ['0901234567', '090 123 4567', '090-123-4567', '+84 90 123 4567']) {
            const profile = await request('PATCH', '/auth/profile', incomplete.token, { fullName: 'Khách hoàn thiện', phoneNumber });
            assert.equal(profile.phoneNumber, '0901234567');
            assert.equal((await prisma.user.findUniqueOrThrow({ where: { id: incomplete.id } })).phoneNumber, '0901234567');
          }
          const booking = await request(
            'POST',
            '/bookings',
            incomplete.token,
            {
              ...payload,
              roomTypeId: property.roomTypes[1].id,
              quantity: 1,
              guestCount: 1,
            },
            201,
          );
          await request(
            'PATCH',
            `/bookings/${booking.id}/cancel`,
            incomplete.token,
          );
        },
      );
      const booking = await request(
        'POST',
        '/bookings',
        guest.token,
        payload,
        201,
      );
      await t.test(
        'codes are generated, stable, database-unique and scoped to the guest/host/admin',
        async () => {
          assert.match(booking.bookingCode, /^STB-[A-F0-9]{16}$/);
          assert.equal(
            (
              await request(
                'GET',
                `/bookings/lookup/${booking.bookingCode}`,
                guest.token,
              )
            ).id,
            booking.id,
          );
          await request(
            'GET',
            `/bookings/lookup/${booking.bookingCode}`,
            stranger.token,
            undefined,
            404,
          );
          await request(
            'GET',
            `/bookings/lookup/${booking.bookingCode}`,
            strangerHost.token,
            undefined,
            404,
          );
          assert.equal(
            (
              await request(
                'GET',
                `/bookings/lookup/${booking.bookingCode}`,
                host.token,
              )
            ).id,
            booking.id,
          );
          assert.equal(
            (
              await request(
                'GET',
                `/bookings/lookup/${booking.bookingCode}`,
                admin.token,
              )
            ).id,
            booking.id,
          );
          await assert.rejects(
            prisma.booking.create({
              data: {
                ...payload,
                checkIn: new Date(dates.checkIn),
                checkOut: new Date(dates.checkOut),
                guestId: stranger.id,
                bookingCode: booking.bookingCode,
                roomTypeNameSnapshot: 'Test',
                paymentDeadlineAt: new Date(),
                nightlyPriceSnapshot: 1,
                totalNights: 2,
                totalAmount: 2,
                depositPercentSnapshot: 50,
                depositAmount: 1,
                remainingAmount: 1,
              },
            }),
            (e: unknown) => (e as { code: string }).code === 'P2002',
          );
        },
      );
      await t.test(
        'public lookup requires code plus snapshot email, returns safe fields and rate limits anonymous calls',
        async () => {
          const body = { bookingCode: booking.bookingCode.toLowerCase(), email: ` ${guest.email.toUpperCase()} ` };
          const result = await request('POST', '/booking-lookup', undefined, body, 201);
          assert.equal(result.bookingCode, booking.bookingCode);
          assert.equal(result.propertyName, propertyPayload.name);
          assert.deepEqual(Object.keys(result).sort(), ['bookingCode', 'status', 'propertyName', 'roomTypeName', 'checkIn', 'checkOut', 'quantity', 'guestCount', 'paymentState', 'paymentDeadlineAt'].sort());
          const wrongEmail = await request('POST', '/booking-lookup', undefined, { ...body, email: 'wrong@synthetic.test' }, 404);
          const wrongCode = await request('POST', '/booking-lookup', undefined, { ...body, bookingCode: 'STB-UNKNOWN' }, 404);
          assert.deepEqual(wrongEmail, wrongCode);
          await request('POST', '/booking-lookup', undefined, { ...body, email: stranger.email }, 404);
          await request('POST', '/booking-lookup', undefined, { bookingCode: body.bookingCode }, 400);
          await request('POST', '/booking-lookup', undefined, body, 429);
        },
      );
      await t.test(
        'QR contains exact deposit/reference; timely payment confirms once and pending invoice is refused',
        async () => {
          await request(
            'GET',
            `/bookings/${booking.id}/invoice`,
            guest.token,
            undefined,
            409,
          );
          const demo = await request(
            'GET',
            `/bookings/${booking.id}/payment-demo`,
            guest.token,
          );
          assert.equal(demo.payload.amount, booking.depositAmount);
          assert.equal(demo.payload.reference, booking.bookingCode);
          assert.equal(demo.payload.mode, 'DEMO');
          assert.match(demo.qrDataUrl, /^data:image\/png;base64,/);
          await request(
            'GET',
            `/bookings/${booking.id}/payment-demo`,
            stranger.token,
            undefined,
            404,
          );
          const paid = await request(
            'POST',
            `/bookings/${booking.id}/pay`,
            guest.token,
            undefined,
            201,
          );
          assert.equal(paid.status, 'CONFIRMED');
          assert.equal(paid.payment.amount, booking.depositAmount);
          await request(
            'POST',
            `/bookings/${booking.id}/pay`,
            guest.token,
            undefined,
            409,
          );
        },
      );
      await t.test(
        'invoice preserves customer/property/price snapshots after edits and prevents cross-user access',
        async () => {
          await request('PATCH', '/auth/profile', guest.token, {
            fullName: 'Tên mới',
            phoneNumber: '0981234567',
          });
          await request(
            'PATCH',
            `/host/properties/${property.id}`,
            host.token,
            {
              name: 'Tên cơ sở mới',
              address: 'Địa chỉ mới tổng hợp',
              roomTypes: property.roomTypes.map(
                (r: typeof roomFields & { id: string }) => ({
                  ...roomFields,
                  id: r.id,
                  name: r.name,
                  pricePerNight: 999999,
                  totalUnits: r.totalUnits,
                }),
              ),
            },
          );
          const invoice = await request(
            'GET',
            `/bookings/${booking.id}/invoice`,
            guest.token,
          );
          assert.equal(
            invoice.nightlyPriceSnapshot,
            booking.nightlyPriceSnapshot,
          );
          assert.equal(
            invoice.customerNameSnapshot,
            booking.customerNameSnapshot,
          );
          assert.equal(invoice.customerPhoneSnapshot, '0901234567');
          assert.equal(invoice.customerEmailSnapshot, guest.email);
          assert.equal(invoice.propertyNameSnapshot, property.name);
          assert.equal(invoice.propertyAddressSnapshot, property.address);
          await request(
            'GET',
            `/bookings/${booking.id}/invoice`,
            stranger.token,
            undefined,
            404,
          );
        },
      );
      await t.test(
        'feedback requires ownership, confirmed state and checkout; duplicates refused and property summary updated',
        async () => {
          const feedback = {
            rating: 5,
            content: 'Nội dung đánh giá tổng hợp cho kiểm thử.',
          };
          await request(
            'POST',
            `/bookings/${booking.id}/feedback`,
            guest.token,
            feedback,
            409,
          );
          await request(
            'POST',
            `/bookings/${booking.id}/feedback`,
            stranger.token,
            feedback,
            404,
          );
          await request(
            'POST',
            `/bookings/${booking.id}/feedback`,
            undefined,
            feedback,
            401,
          );
          await prisma.booking.update({
            where: { id: booking.id },
            data: {
              checkIn: new Date('2020-01-01'),
              checkOut: new Date('2020-01-03'),
            },
          });
          const saved = await request(
            'POST',
            `/bookings/${booking.id}/feedback`,
            guest.token,
            feedback,
            201,
          );
          assert.equal(saved.propertyId, property.id);
          await request(
            'POST',
            `/bookings/${booking.id}/feedback`,
            guest.token,
            feedback,
            409,
          );
          const summary = await request(
            'GET',
            `/properties/${property.id}/feedback`,
            undefined,
          );
          assert.equal(summary.count, 1);
          assert.equal(summary.averageRating, 5);
          assert.equal(summary.items[0].content, feedback.content);
          assert.equal(summary.items[0].guest.email, undefined);
        },
      );
      await t.test(
        'late payment commits expiration and returns 409 without a Payment',
        async () => {
          const late = await request(
            'POST',
            '/bookings',
            stranger.token,
            { ...payload, quantity: 1, guestCount: 1 },
            201,
          );
          await prisma.booking.update({
            where: { id: late.id },
            data: { paymentDeadlineAt: new Date(Date.now() - 1000) },
          });
          const error = await request(
            'POST',
            `/bookings/${late.id}/pay`,
            stranger.token,
            undefined,
            409,
          );
          assert.equal(
            error.message,
            'Đơn đặt phòng đã hết thời gian thanh toán.',
          );
          assert.equal(
            (await prisma.booking.findUniqueOrThrow({ where: { id: late.id } }))
              .status,
            'EXPIRED',
          );
          assert.equal(
            await prisma.payment.count({ where: { bookingId: late.id } }),
            0,
          );
        },
      );
      await t.test(
        'admin statistics/search/customer history match database aggregates and deny non-admins',
        async () => {
          const stats = await request('GET', '/admin/statistics', admin.token);
          assert.equal(stats.totalBookings, await prisma.booking.count());
          assert.equal(
            stats.guests,
            await prisma.user.count({ where: { role: 'GUEST' } }),
          );
          assert.equal(stats.roomTypes, await prisma.roomType.count());
          assert.equal(
            stats.successfulDepositAmount,
            (
              await prisma.payment.aggregate({
                where: { status: 'SUCCESS' },
                _sum: { amount: true },
              })
            )._sum.amount ?? 0,
          );
          const search = await request(
            'GET',
            `/admin/bookings?bookingCode=${booking.bookingCode}&status=CONFIRMED`,
            admin.token,
          );
          assert.equal(search.total, 1);
          assert.equal(search.items[0].id, booking.id);
          assert.equal(
            (
              await request(
                'GET',
                `/admin/bookings?q=${encodeURIComponent(guest.email)}`,
                admin.token,
              )
            ).total,
            1,
          );
          const history = await request(
            'GET',
            `/admin/customers/${guest.id}/history`,
            admin.token,
          );
          assert.equal(history.user.id, guest.id);
          assert.equal(history.confirmed, 1);
          assert.equal(history.successfulDepositAmount, booking.depositAmount);
          assert.equal(history.user.passwordHash, undefined);
          for (const path of [
            '/admin/statistics',
            '/admin/bookings',
            '/admin/users',
            `/admin/customers/${guest.id}/history`,
            '/admin/feedback',
          ])
            await request('GET', path, guest.token, undefined, 403);
        },
      );
      await t.test(
        'admin roles protected; Guest to Host forced PENDING; original host approval works',
        async () => {
          await request(
            'PATCH',
            `/admin/users/${admin.id}`,
            admin.token,
            { role: 'HOST' },
            403,
          );
          await request(
            'PATCH',
            `/admin/users/${stranger.id}`,
            admin.token,
            { role: 'ADMIN' },
            400,
          );
          await request(
            'PATCH',
            `/admin/users/${stranger.id}`,
            guest.token,
            { role: 'HOST' },
            403,
          );
          const changed = await request(
            'PATCH',
            `/admin/users/${incomplete.id}`,
            admin.token,
            { role: 'HOST', status: 'ACTIVE' },
          );
          assert.equal(changed.status, 'PENDING');
          assert.equal(changed.passwordHash, undefined);
          await request(
            'GET',
            '/host/properties',
            incomplete.token,
            undefined,
            403,
          );
          await request(
            'PATCH',
            `/admin/hosts/${incomplete.id}/approve`,
            admin.token,
          );
          await request('GET', '/host/properties', incomplete.token);
        },
      );
      await t.test(
        'amenity management is admin-only; deactivation retains assignments and prevents new selection',
        async () => {
          await request(
            'PATCH',
            `/admin/amenities/${amenity.id}`,
            guest.token,
            { active: false },
            403,
          );
          await request(
            'PATCH',
            `/admin/amenities/${amenity.id}`,
            admin.token,
            { nameVi: 'Tiện ích đã sửa', active: false },
          );
          assert.equal(
            (await request('GET', '/amenities', undefined)).some(
              (a: { id: string }) => a.id === amenity.id,
            ),
            false,
          );
          await request(
            'PATCH',
            `/host/properties/${property.id}`,
            host.token,
            { amenityIds: [amenity.id] },
          );
          await request(
            'POST',
            '/host/properties',
            host.token,
            { ...propertyPayload, name: 'Cơ sở không được tạo' },
            400,
          );
          assert.equal(
            await prisma.propertyAmenity.count({
              where: { propertyId: property.id, amenityId: amenity.id },
            }),
            1,
          );
        },
      );
      await t.test('paid Guest converted to pending/active Host retains only owned history, invoice and eligible feedback', async () => {
        const own = await request('GET', '/bookings/my', guest.token);
        assert.ok(own.some((item: { id: string }) => item.id === booking.id));
        await request('PATCH', `/admin/users/${guest.id}`, admin.token, { role: 'HOST' });
        await request('PATCH', `/admin/users/${stranger.id}`, admin.token, { role: 'HOST' });
        assert.ok((await request('GET', '/bookings/my', stranger.token)).every((item: { guestId: string }) => item.guestId === stranger.id));
        const noBookings = await makeUser('GUEST');
        await request('PATCH', `/admin/users/${noBookings.id}`, admin.token, { role: 'HOST' });
        assert.deepEqual(await request('GET', '/bookings/my', noBookings.token), []);
        await request('PATCH', `/admin/hosts/${noBookings.id}/approve`, admin.token);
        assert.deepEqual(await request('GET', '/host/properties', noBookings.token), []);
        for (const approved of [false, true]) {
          if (approved) await request('PATCH', `/admin/hosts/${guest.id}/approve`, admin.token);
          const history = await request('GET', '/bookings/my', guest.token);
          assert.ok(history.some((item: { id: string }) => item.id === booking.id));
          assert.equal((await request('GET', `/bookings/${booking.id}`, guest.token)).id, booking.id);
          assert.equal((await request('GET', `/bookings/${booking.id}/invoice`, guest.token)).id, booking.id);
          assert.equal((await request('GET', `/bookings/lookup/${booking.bookingCode}`, guest.token)).id, booking.id);
          await request('GET', `/bookings/${booking.id}`, stranger.token, undefined, 404);
          await request('GET', `/bookings/${booking.id}/invoice`, stranger.token, undefined, 404);
          await request('GET', '/admin/statistics', guest.token, undefined, 403);
          if (!approved) {
            for (const path of ['/host/properties', '/host/bookings', `/host/properties/${property.id}`])
              await request('GET', path, guest.token, undefined, 403);
            await request('POST', '/host/properties', guest.token, propertyPayload, 403);
            await request('GET', `/bookings/${booking.id}`, host.token);
            const outsiderBooking = await prisma.booking.create({ data: {
              guestId: stranger.id, roomTypeId: property.roomTypes[0].id, bookingCode: `STB-${randomUUID()}`,
              roomTypeNameSnapshot: 'Room', quantity: 1, guestCount: 1, checkIn: new Date('2020-01-01'), checkOut: new Date('2020-01-02'),
              nightlyPriceSnapshot: 1, totalNights: 1, totalAmount: 1, depositPercentSnapshot: 0,
              depositAmount: 0, remainingAmount: 1, paymentDeadlineAt: new Date('2020-01-01'), status: 'CONFIRMED',
            } });
            await request('GET', `/bookings/${outsiderBooking.id}`, guest.token, undefined, 404);
            await request('POST', `/bookings/${outsiderBooking.id}/feedback`, guest.token, { rating: 5, content: 'Not my booking' }, 404);
            const ownPast = await prisma.booking.create({ data: {
              guestId: guest.id, roomTypeId: property.roomTypes[0].id, bookingCode: `STB-${randomUUID()}`,
              roomTypeNameSnapshot: 'Room', quantity: 1, guestCount: 1, checkIn: new Date('2020-02-01'), checkOut: new Date('2020-02-02'),
              nightlyPriceSnapshot: 1, totalNights: 1, totalAmount: 1, depositPercentSnapshot: 0,
              depositAmount: 0, remainingAmount: 1, paymentDeadlineAt: new Date('2020-02-01'), status: 'CONFIRMED',
            } });
            await request('POST', `/bookings/${ownPast.id}/feedback`, guest.token, { rating: 5, content: 'Historical stay is accessible' }, 201);
          } else {
            assert.deepEqual(await request('GET', '/host/bookings', guest.token), []);
            await request('GET', `/host/properties/${property.id}`, guest.token, undefined, 404);
          }
        }
      });
    } finally {
      await prisma.feedback.deleteMany({ where: { guestId: { in: users } } });
      await prisma.payment.deleteMany({
        where: { booking: { guestId: { in: users } } },
      });
      await prisma.booking.deleteMany({ where: { guestId: { in: users } } });
      await prisma.propertyAmenity.deleteMany({
        where: { propertyId: { in: properties } },
      });
      await prisma.propertyImage.deleteMany({
        where: { propertyId: { in: properties } },
      });
      await prisma.roomType.deleteMany({
        where: { propertyId: { in: properties } },
      });
      await prisma.property.deleteMany({ where: { id: { in: properties } } });
      await prisma.user.deleteMany({ where: { id: { in: users } } });
      await prisma.amenity.deleteMany({ where: { id: { in: amenities } } });
      await app.close();
    }
  },
);
