CREATE TABLE `BookingEvent` (
  `id` CHAR(36) NOT NULL,
  `bookingId` CHAR(36) NOT NULL,
  `type` VARCHAR(40) NOT NULL,
  `status` ENUM('PENDING_PAYMENT', 'CONFIRMED', 'CANCELLED', 'EXPIRED') NOT NULL,
  `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  PRIMARY KEY (`id`),
  INDEX `BookingEvent_bookingId_createdAt_idx` (`bookingId`, `createdAt`),
  CONSTRAINT `BookingEvent_bookingId_fkey` FOREIGN KEY (`bookingId`) REFERENCES `Booking` (`id`) ON DELETE CASCADE ON UPDATE CASCADE
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

CREATE TABLE `PaymentAttempt` (
  `id` CHAR(36) NOT NULL,
  `bookingId` CHAR(36) NOT NULL,
  `amount` INTEGER NOT NULL,
  `status` ENUM('SUCCESS', 'FAILED') NOT NULL,
  `method` ENUM('FAKE') NOT NULL DEFAULT 'FAKE',
  `failureReason` VARCHAR(250) NULL,
  `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  PRIMARY KEY (`id`),
  INDEX `PaymentAttempt_bookingId_createdAt_idx` (`bookingId`, `createdAt`),
  CONSTRAINT `PaymentAttempt_bookingId_fkey` FOREIGN KEY (`bookingId`) REFERENCES `Booking` (`id`) ON DELETE CASCADE ON UPDATE CASCADE
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
-- Existing Payment/createdAt/cancelledAt/expiredAt remain authoritative historical
-- evidence. Do not invent confirmation timestamps from current booking status.
INSERT INTO `PaymentAttempt` (`id`, `bookingId`, `amount`, `status`, `method`, `createdAt`)
SELECT UUID(), `bookingId`, `amount`, `status`, `method`, COALESCE(`paidAt`, `createdAt`) FROM `Payment`;
