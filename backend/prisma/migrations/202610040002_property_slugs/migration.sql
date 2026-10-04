ALTER TABLE `Property` ADD COLUMN `slug` VARCHAR(191) NULL;
CREATE UNIQUE INDEX `Property_slug_key` ON `Property` (`slug`);
-- Existing records receive unique slugs during API startup.
