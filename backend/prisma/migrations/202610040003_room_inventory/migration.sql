-- Preserve accommodation IDs, ownership, images, payments and historical amounts.
ALTER TABLE `User`
  ADD COLUMN `bookingBlockedUntil` DATETIME(3) NULL,
  ADD COLUMN `expirationStrikeResetAt` DATETIME(3) NULL;
ALTER TABLE `Property` ADD COLUMN `paymentWindowHours` INTEGER NOT NULL DEFAULT 6;

CREATE TABLE `RoomType` (
  `id` CHAR(36) NOT NULL,
  `propertyId` CHAR(36) NOT NULL,
  `name` VARCHAR(100) NOT NULL,
  `description` TEXT NOT NULL,
  `pricePerNight` INTEGER NOT NULL,
  `totalUnits` INTEGER NOT NULL,
  `maxGuests` INTEGER NOT NULL,
  `bedrooms` INTEGER NOT NULL,
  `beds` INTEGER NOT NULL,
  `bathrooms` INTEGER NOT NULL,
  `status` ENUM('ACTIVE', 'INACTIVE') NOT NULL DEFAULT 'ACTIVE',
  `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `updatedAt` DATETIME(3) NOT NULL,
  PRIMARY KEY (`id`),
  INDEX `RoomType_propertyId_status_pricePerNight_idx` (`propertyId`, `status`, `pricePerNight`),
  CONSTRAINT `RoomType_propertyId_fkey` FOREIGN KEY (`propertyId`) REFERENCES `Property` (`id`) ON DELETE RESTRICT ON UPDATE CASCADE
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- Reusing the accommodation UUID for its initial room type makes backfill deterministic.
-- Existing accommodation inventory remains one unit until the host/recognized demo seed changes it.
INSERT INTO `RoomType` (`id`, `propertyId`, `name`, `description`, `pricePerNight`, `totalUnits`, `maxGuests`, `bedrooms`, `beds`, `bathrooms`, `status`, `createdAt`, `updatedAt`)
SELECT `id`, `id`, IF(`type` = 'HOMESTAY', 'Nguyên căn homestay', 'Phòng tiêu chuẩn'),
  `description`, `pricePerNight`, 1, `maxGuests`, `bedrooms`, `beds`, `bathrooms`, 'ACTIVE', `createdAt`, `updatedAt`
FROM `Property`;

ALTER TABLE `Booking`
  MODIFY `status` ENUM('PENDING_PAYMENT', 'CONFIRMED', 'CANCELLED', 'EXPIRED') NOT NULL DEFAULT 'PENDING_PAYMENT',
  ADD COLUMN `roomTypeId` CHAR(36) NULL,
  ADD COLUMN `roomTypeNameSnapshot` VARCHAR(100) NULL,
  ADD COLUMN `quantity` INTEGER NOT NULL DEFAULT 1,
  ADD COLUMN `paymentDeadlineAt` DATETIME(3) NULL,
  ADD COLUMN `expiredAt` DATETIME(3) NULL,
  ADD COLUMN `cancelledAt` DATETIME(3) NULL;

UPDATE `Booking` b JOIN `RoomType` r ON r.`propertyId` = b.`propertyId`
SET b.`roomTypeId` = r.`id`, b.`roomTypeNameSnapshot` = r.`name`,
  b.`paymentDeadlineAt` = LEAST(
    TIMESTAMPADD(HOUR, IF(TIMESTAMPDIFF(SECOND, b.`createdAt`, TIMESTAMP(b.`checkIn`, b.`checkInTimeSnapshot`) - INTERVAL 7 HOUR) <= 86400, 1, 6), b.`createdAt`),
    TIMESTAMP(b.`checkIn`, b.`checkInTimeSnapshot`) - INTERVAL 9 HOUR
  ),
  b.`cancelledAt` = IF(b.`status` = 'CANCELLED', b.`updatedAt`, NULL);

-- Legacy pending requests did not reserve inventory and may overlap each other.
-- Expire them at cutover instead of turning them into conflicting holds.
-- Start abuse strike accounting after this migration; legacy requests are not penalized.
SET @inventory_cutover = UTC_TIMESTAMP(3);
UPDATE `Booking` SET `status` = 'EXPIRED', `expiredAt` = @inventory_cutover,
  `paymentDeadlineAt` = LEAST(`paymentDeadlineAt`, @inventory_cutover), `updatedAt` = @inventory_cutover
WHERE `status` = 'PENDING_PAYMENT';
UPDATE `User` SET `expirationStrikeResetAt` = @inventory_cutover;

ALTER TABLE `Booking`
  MODIFY `roomTypeId` CHAR(36) NOT NULL,
  MODIFY `roomTypeNameSnapshot` VARCHAR(100) NOT NULL,
  MODIFY `quantity` INTEGER NOT NULL,
  MODIFY `paymentDeadlineAt` DATETIME(3) NOT NULL,
  DROP FOREIGN KEY `Booking_propertyId_fkey`,
  DROP INDEX `Booking_propertyId_status_checkIn_checkOut_idx`,
  DROP COLUMN `propertyId`,
  ADD INDEX `Booking_roomTypeId_status_checkIn_checkOut_idx` (`roomTypeId`, `status`, `checkIn`, `checkOut`),
  ADD INDEX `Booking_status_paymentDeadlineAt_idx` (`status`, `paymentDeadlineAt`),
  ADD INDEX `Booking_guestId_status_expiredAt_idx` (`guestId`, `status`, `expiredAt`),
  ADD CONSTRAINT `Booking_roomTypeId_fkey` FOREIGN KEY (`roomTypeId`) REFERENCES `RoomType` (`id`) ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE `Property`
  DROP INDEX `Property_status_pricePerNight_idx`,
  DROP COLUMN `pricePerNight`, DROP COLUMN `maxGuests`,
  DROP COLUMN `bedrooms`, DROP COLUMN `beds`, DROP COLUMN `bathrooms`;
