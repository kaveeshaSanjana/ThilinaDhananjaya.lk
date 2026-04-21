-- Make email optional in User table
ALTER TABLE `User` MODIFY `email` VARCHAR(191) NULL;

-- Add contact enhancement fields to Profile table (non-destructive)
ALTER TABLE `Profile` ADD COLUMN `telephone` VARCHAR(191) NULL;
ALTER TABLE `Profile` ADD COLUMN `guardianTelephone` VARCHAR(191) NULL;
ALTER TABLE `Profile` ADD COLUMN `emergencyContactPhone` VARCHAR(191) NULL;
ALTER TABLE `Profile` ADD COLUMN `emergencyContactName` VARCHAR(191) NULL;

-- Add indexes for contact phone fields
CREATE INDEX `Profile_telephone_idx` ON `Profile`(`telephone`);
CREATE INDEX `Profile_whatsappPhone_idx` ON `Profile`(`whatsappPhone`);
CREATE INDEX `Profile_guardianPhone_idx` ON `Profile`(`guardianPhone`);
CREATE INDEX `Profile_guardianTelephone_idx` ON `Profile`(`guardianTelephone`);
CREATE INDEX `Profile_emergencyContactPhone_idx` ON `Profile`(`emergencyContactPhone`);
