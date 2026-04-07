-- Add optional gender field to Profile

ALTER TABLE `Profile` ADD COLUMN `gender` ENUM('MALE', 'FEMALE', 'OTHER') NULL;
