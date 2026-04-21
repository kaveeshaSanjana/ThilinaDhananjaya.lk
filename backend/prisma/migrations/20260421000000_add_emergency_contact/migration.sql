-- Add emergency contact fields to Profile table
ALTER TABLE `Profile` ADD COLUMN `emergencyContactPhone` VARCHAR(20);
ALTER TABLE `Profile` ADD COLUMN `emergencyContactName` VARCHAR(255);

-- Remove whatsappPhone if it was added (for cleanup)
ALTER TABLE `Profile` DROP COLUMN IF EXISTS `whatsappPhone`;

-- Add indexes for contact phone fields
CREATE INDEX `Profile_guardianPhone_idx` ON `Profile`(`guardianPhone`);
CREATE INDEX `Profile_emergencyContactPhone_idx` ON `Profile`(`emergencyContactPhone`);
