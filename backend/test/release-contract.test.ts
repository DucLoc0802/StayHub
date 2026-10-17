import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  ArgumentsHost,
  BadRequestException,
  NotFoundException,
  ForbiddenException,
} from '@nestjs/common';
import { ApiExceptionFilter } from '../src/common/errors';
import { bookingIdPipe } from '../src/common/validation';
import { paymentState } from '../../frontend/src/lib/payment-state';
import type { Booking } from '../../frontend/src/lib/types';

test('missing API route, missing booking and invalid booking identifiers have distinct recoverable error codes', async () => {
  const filter = new ApiExceptionFilter();
  const result = (error: unknown) => {
    let body:
      | { code: string; statusCode: number; message: string; requestId: string }
      | undefined;
    const response = {
      status: () => response,
      json: (value: typeof body) => {
        body = value;
      },
    };
    filter.catch(error, {
      switchToHttp: () => ({
        getResponse: () => response,
        getRequest: () => ({ method: 'GET' }),
      }),
    } as unknown as ArgumentsHost);
    return body!;
  };
  assert.equal(
    result(new NotFoundException('Cannot GET /api/unavailable')).code,
    'API_ROUTE_NOT_FOUND',
  );
  assert.equal(
    result(new NotFoundException('Không tìm thấy đơn đặt phòng.')).code,
    'RESOURCE_NOT_FOUND',
  );
  assert.equal(result(new ForbiddenException()).code, 'FORBIDDEN');
  try {
    await bookingIdPipe().transform('pending-payments', { type: 'param' });
    assert.fail('must reject non-UUID');
  } catch (error) {
    assert.ok(error instanceof BadRequestException);
    assert.equal(result(error).code, 'INVALID_BOOKING_ID');
  }
});

test('one payment presentation distinguishes claims, rejection, expiry and cancellation without inviting another payment', () => {
  const b = {
    status: 'PENDING_PAYMENT',
    payment: null,
    paymentDeadlineAt: '2030-01-01T00:00:00Z',
    paymentAttempts: [],
  } as unknown as Booking;
  const now = Date.parse('2029-01-01');
  assert.equal(paymentState(b, now).canPay, true);
  const reported = {
    ...b,
    paymentAttempts: [
      {
        id: 'claim',
        method: 'MOMO_MANUAL',
        status: 'SUBMITTED',
        createdAt: '2029-01-01',
        amount: 100,
        transactionRef: 'REF-123',
      },
    ],
  } as Booking;
  assert.equal(paymentState(reported, now).kind, 'reported');
  assert.equal(paymentState(reported, now).canPay, false);
  assert.equal(
    paymentState({ ...reported, status: 'CANCELLED' }, now).kind,
    'cancelled',
  );
  assert.equal(
    paymentState({ ...reported, paymentDeadlineAt: '2028-01-01' }, now).kind,
    'expired',
  );
  assert.equal(
    paymentState(
      {
        ...reported,
        paymentAttempts: [
          {
            ...reported.paymentAttempts![0],
            status: 'FAILED',
            failureReason: 'Không khớp mã nhận tiền',
          },
        ],
      },
      now,
    ).kind,
    'rejected',
  );
});
