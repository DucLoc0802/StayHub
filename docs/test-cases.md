# Test cases

| Area | Case | Expected result |
|---|---|---|
| Auth | Login with valid credentials | 200, JWT and safe user returned |
| Auth | Invalid password | 401 with Vietnamese message |
| Auth | Register duplicate email | 409 |
| Auth | Register Guest | Status is `ACTIVE` |
| Auth | Register Host | Status is `PENDING` |
| Authorization | Guest calls Host endpoint | 403 |
| Authorization | Pending Host creates property | 403 |
| Authorization | Host edits another Host property | 404 without data disclosure |
| Authorization | Guest accesses another Guest booking | 404 |
| Authorization | Non-Admin approves Host | 403 |
| Property | Valid create with image and amenity | 201 |
| Property | Zero/negative price | 400 |
| Property | Deposit outside 1–100 | 400 |
| Property | `maxGuests` below 1 | 400 |
| Property | Search name/district case-insensitively | Matching active properties |
| Property | Filter by multiple amenities | Property contains every selected amenity |
| Booking | Valid future range and guest count | `PENDING_PAYMENT`, correct snapshots |
| Booking | Checkout before check-in | 400 |
| Booking | Same check-in/checkout | 400 |
| Booking | Guest count over property maximum | 400 |
| Booking | Inactive property | 404 |
| Booking | Overlap with confirmed booking | 409 |
| Booking | New check-in equals existing checkout | Allowed |
| Payment | Pay pending available booking | Deposit `SUCCESS`, booking `CONFIRMED` |
| Payment | Pay booking twice | 400/409, only one successful payment |
| Payment | Another booking takes dates before payment | 409, no payment created |
| Cancellation | Cancel pending booking | `CANCELLED`, no money lost |
| Cancellation | Cancel confirmed booking | `CANCELLED`, successful payment remains |
| Host | View bookings | Only bookings for own properties |

## Manual smoke sequence

1. Seed the database and log in as Admin.
2. Confirm the pending demo host is listed; approve it.
3. Log in as active Host and create a property with an image and amenities.
4. Log in as Guest, search/filter, open the new property, and select dates.
5. Create a booking, verify computed VND amounts, and fake-pay the deposit.
6. Verify the host sees the confirmed booking.
7. Create a second overlapping pending booking and verify payment returns 409.
8. Cancel the confirmed booking and verify its successful payment remains returned by `GET /bookings/my`.
