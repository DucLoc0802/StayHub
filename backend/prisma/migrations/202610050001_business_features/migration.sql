ALTER TABLE `User` ADD COLUMN `phoneNumber` VARCHAR(20) NULL;
ALTER TABLE `Amenity` ADD COLUMN `active` BOOLEAN NOT NULL DEFAULT true;
ALTER TABLE `Booking`
  ADD COLUMN `bookingCode` VARCHAR(40) NULL,
  ADD COLUMN `customerNameSnapshot` VARCHAR(100) NOT NULL DEFAULT '',
  ADD COLUMN `customerPhoneSnapshot` VARCHAR(20) NOT NULL DEFAULT '',
  ADD COLUMN `customerEmailSnapshot` VARCHAR(191) NOT NULL DEFAULT '',
  ADD COLUMN `propertyNameSnapshot` VARCHAR(150) NOT NULL DEFAULT '',
  ADD COLUMN `propertyAddressSnapshot` VARCHAR(250) NOT NULL DEFAULT '';
-- Full UUID-derived codes are unique for existing records. New bookings use random human-readable codes.
UPDATE `Booking` b JOIN `User` u ON u.id = b.guestId
JOIN `RoomType` r ON r.id = b.roomTypeId JOIN `Property` p ON p.id = r.propertyId
SET b.bookingCode = CONCAT('STB-', UPPER(REPLACE(b.id, '-', ''))),
 b.customerNameSnapshot = u.fullName, b.customerPhoneSnapshot = COALESCE(u.phoneNumber, ''),
 b.customerEmailSnapshot = u.email, b.propertyNameSnapshot = p.name, b.propertyAddressSnapshot = p.address;
ALTER TABLE `Booking` MODIFY `bookingCode` VARCHAR(40) NOT NULL;
CREATE UNIQUE INDEX `Booking_bookingCode_key` ON `Booking` (`bookingCode`);
CREATE TABLE `Feedback` (
 `id` CHAR(36) NOT NULL, `bookingId` CHAR(36) NOT NULL, `guestId` CHAR(36) NOT NULL,
 `propertyId` CHAR(36) NOT NULL, `rating` INTEGER NOT NULL, `content` TEXT NOT NULL,
 `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3), `updatedAt` DATETIME(3) NOT NULL,
 PRIMARY KEY (`id`), UNIQUE INDEX `Feedback_bookingId_key` (`bookingId`),
 INDEX `Feedback_propertyId_createdAt_idx` (`propertyId`, `createdAt`), INDEX `Feedback_guestId_idx` (`guestId`),
 CONSTRAINT `Feedback_bookingId_fkey` FOREIGN KEY (`bookingId`) REFERENCES `Booking` (`id`) ON DELETE RESTRICT ON UPDATE CASCADE,
 CONSTRAINT `Feedback_guestId_fkey` FOREIGN KEY (`guestId`) REFERENCES `User` (`id`) ON DELETE RESTRICT ON UPDATE CASCADE,
 CONSTRAINT `Feedback_propertyId_fkey` FOREIGN KEY (`propertyId`) REFERENCES `Property` (`id`) ON DELETE RESTRICT ON UPDATE CASCADE
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
