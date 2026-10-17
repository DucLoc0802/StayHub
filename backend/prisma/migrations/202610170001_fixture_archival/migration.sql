ALTER TABLE `User` ADD COLUMN `archivedAt` DATETIME(3) NULL;
ALTER TABLE `Property` ADD COLUMN `archivedAt` DATETIME(3) NULL;
-- Archival is explicit and reversible. Existing rows and financial records are unchanged.
