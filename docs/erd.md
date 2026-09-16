# Entity relationship diagram

```mermaid
erDiagram
    User ||--o{ Property : hosts
    User ||--o{ Booking : makes
    Property ||--|{ PropertyImage : has
    Property ||--o{ PropertyAmenity : provides
    Amenity ||--o{ PropertyAmenity : categorizes
    Property ||--o{ Booking : receives
    Booking ||--o{ Payment : records

    User {
      uuid id PK
      string email UK
      string passwordHash
      string fullName
      Role role
      AccountStatus status
    }
    Property {
      uuid id PK
      uuid hostId FK
      PropertyType type
      int pricePerNight
      int depositPercent
      PropertyStatus status
    }
    Booking {
      uuid id PK
      uuid guestId FK
      uuid propertyId FK
      date checkIn
      date checkOut
      int nightlyPriceSnapshot
      int depositPercentSnapshot
      int totalAmount
      BookingStatus status
    }
    Payment {
      uuid id PK
      uuid bookingId FK
      int amount
      PaymentStatus status
      PaymentMethod method
    }
```

Money is stored as integer VND. UUIDs are used for primary and foreign keys. `PropertyAmenity` is an explicit many-to-many join. Historical booking amounts never depend on later property edits.
