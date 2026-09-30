-- CreateTable
CREATE TABLE `User` (
    `id` CHAR(36) NOT NULL,
    `fullName` VARCHAR(100) NOT NULL,
    `email` VARCHAR(191) NOT NULL,
    `passwordHash` VARCHAR(100) NOT NULL,
    `role` ENUM('GUEST', 'HOST', 'ADMIN') NOT NULL,
    `status` ENUM('PENDING', 'ACTIVE', 'REJECTED') NOT NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    UNIQUE INDEX `User_email_key`(`email`),
    INDEX `User_role_status_idx`(`role`, `status`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `Property` (
    `id` CHAR(36) NOT NULL,
    `hostId` CHAR(36) NOT NULL,
    `type` ENUM('HOMESTAY', 'HOTEL') NOT NULL,
    `name` VARCHAR(150) NOT NULL,
    `description` TEXT NOT NULL,
    `district` VARCHAR(80) NOT NULL,
    `address` VARCHAR(250) NOT NULL,
    `pricePerNight` INTEGER NOT NULL,
    `depositPercent` INTEGER NOT NULL,
    `maxGuests` INTEGER NOT NULL,
    `bedrooms` INTEGER NOT NULL,
    `beds` INTEGER NOT NULL,
    `bathrooms` INTEGER NOT NULL,
    `status` ENUM('ACTIVE', 'INACTIVE') NOT NULL DEFAULT 'ACTIVE',
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    INDEX `Property_hostId_idx`(`hostId`),
    INDEX `Property_status_district_idx`(`status`, `district`),
    INDEX `Property_status_pricePerNight_idx`(`status`, `pricePerNight`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `PropertyImage` (
    `id` CHAR(36) NOT NULL,
    `propertyId` CHAR(36) NOT NULL,
    `url` VARCHAR(2048) NOT NULL,
    `sortOrder` INTEGER NOT NULL,

    UNIQUE INDEX `PropertyImage_propertyId_sortOrder_key`(`propertyId`, `sortOrder`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `Amenity` (
    `id` CHAR(36) NOT NULL,
    `code` VARCHAR(50) NOT NULL,
    `nameVi` VARCHAR(100) NOT NULL,

    UNIQUE INDEX `Amenity_code_key`(`code`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `PropertyAmenity` (
    `propertyId` CHAR(36) NOT NULL,
    `amenityId` CHAR(36) NOT NULL,

    INDEX `PropertyAmenity_amenityId_idx`(`amenityId`),
    PRIMARY KEY (`propertyId`, `amenityId`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `Booking` (
    `id` CHAR(36) NOT NULL,
    `guestId` CHAR(36) NOT NULL,
    `propertyId` CHAR(36) NOT NULL,
    `checkIn` DATE NOT NULL,
    `checkOut` DATE NOT NULL,
    `guestCount` INTEGER NOT NULL,
    `nightlyPriceSnapshot` INTEGER NOT NULL,
    `totalNights` INTEGER NOT NULL,
    `totalAmount` INTEGER NOT NULL,
    `depositPercentSnapshot` INTEGER NOT NULL,
    `depositAmount` INTEGER NOT NULL,
    `remainingAmount` INTEGER NOT NULL,
    `status` ENUM('PENDING_PAYMENT', 'CONFIRMED', 'CANCELLED') NOT NULL DEFAULT 'PENDING_PAYMENT',
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    INDEX `Booking_guestId_createdAt_idx`(`guestId`, `createdAt`),
    INDEX `Booking_propertyId_status_checkIn_checkOut_idx`(`propertyId`, `status`, `checkIn`, `checkOut`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `Payment` (
    `id` CHAR(36) NOT NULL,
    `bookingId` CHAR(36) NOT NULL,
    `amount` INTEGER NOT NULL,
    `status` ENUM('SUCCESS', 'FAILED') NOT NULL,
    `method` ENUM('FAKE') NOT NULL DEFAULT 'FAKE',
    `paidAt` DATETIME(3) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    UNIQUE INDEX `Payment_bookingId_key`(`bookingId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- AddForeignKey
ALTER TABLE `Property` ADD CONSTRAINT `Property_hostId_fkey` FOREIGN KEY (`hostId`) REFERENCES `User`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `PropertyImage` ADD CONSTRAINT `PropertyImage_propertyId_fkey` FOREIGN KEY (`propertyId`) REFERENCES `Property`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `PropertyAmenity` ADD CONSTRAINT `PropertyAmenity_propertyId_fkey` FOREIGN KEY (`propertyId`) REFERENCES `Property`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `PropertyAmenity` ADD CONSTRAINT `PropertyAmenity_amenityId_fkey` FOREIGN KEY (`amenityId`) REFERENCES `Amenity`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `Booking` ADD CONSTRAINT `Booking_guestId_fkey` FOREIGN KEY (`guestId`) REFERENCES `User`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `Booking` ADD CONSTRAINT `Booking_propertyId_fkey` FOREIGN KEY (`propertyId`) REFERENCES `Property`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `Payment` ADD CONSTRAINT `Payment_bookingId_fkey` FOREIGN KEY (`bookingId`) REFERENCES `Booking`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;
