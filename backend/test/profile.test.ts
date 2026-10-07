import { test } from 'node:test';
import assert from 'node:assert/strict';
import { normalizeVietnamPhone, profileComplete, vietnamPhonePattern } from '../src/common/profile';
import { profilePhone } from '../../frontend/src/lib/profile-phone';
test('booking profile requires a name, existing email and Vietnamese mobile phone', () => {
  const user = { fullName: 'Khách thử', email: 'synthetic@example.test' };
  assert.equal(profileComplete(user), false);
  for (const phoneNumber of ['0901234567', '+84901234567', '0381234567'])
    assert.equal(profileComplete({ ...user, phoneNumber }), true);
  for (const phoneNumber of ['', '123', '09012345678'])
    assert.equal(profileComplete({ ...user, phoneNumber }), false);
});
test('frontend and backend agree on formatted Vietnamese numbers and canonical digits', () => {
  for (const input of ['0901234567', '090 123 4567', '090-123-4567', '+84 90 123 4567']) {
    assert.equal(normalizeVietnamPhone(input), '0901234567');
    assert.equal(profilePhone.parse(input), '0901234567');
  }
  for (const input of ['hello0901234567', '123', '09012345678', '0201234567']) {
    assert.equal(vietnamPhonePattern.test(normalizeVietnamPhone(input)), false);
    assert.equal(profilePhone.safeParse(input).success, false);
  }
});
