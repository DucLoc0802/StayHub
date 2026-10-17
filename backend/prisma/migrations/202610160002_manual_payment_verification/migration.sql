ALTER TABLE `Payment` MODIFY `status` ENUM('SUCCESS','FAILED','SUBMITTED','RESOLUTION_REQUIRED') NOT NULL,
  MODIFY `method` ENUM('FAKE','MOMO_MANUAL') NOT NULL DEFAULT 'FAKE';
ALTER TABLE `PaymentAttempt` MODIFY `status` ENUM('SUCCESS','FAILED','SUBMITTED','RESOLUTION_REQUIRED') NOT NULL,
  MODIFY `method` ENUM('FAKE','MOMO_MANUAL') NOT NULL DEFAULT 'FAKE',
  ADD COLUMN `transactionRef` VARCHAR(100) NULL,
  ADD COLUMN `evidenceNote` VARCHAR(1000) NULL,
  ADD COLUMN `verificationDeadlineAt` DATETIME(3) NULL,
  ADD COLUMN `reviewedAt` DATETIME(3) NULL,
  ADD COLUMN `reviewedById` CHAR(36) NULL,
  ADD COLUMN `receiverNameSnapshot` VARCHAR(100) NULL,
  ADD COLUMN `receiverPhoneSnapshot` VARCHAR(20) NULL,
  ADD COLUMN `hostIdSnapshot` CHAR(36) NULL,
  ADD UNIQUE INDEX `PaymentAttempt_transactionRef_key` (`transactionRef`),
  ADD INDEX `PaymentAttempt_status_createdAt_idx` (`status`, `createdAt`),
  ADD CONSTRAINT `PaymentAttempt_reviewedById_fkey` FOREIGN KEY (`reviewedById`) REFERENCES `User` (`id`) ON DELETE RESTRICT ON UPDATE CASCADE;
-- Existing records, statuses, and audit timestamps are deliberately unchanged.
