/*
  Warnings:

  - You are about to drop the column `visibility` on the `recording` table. All the data in the column will be lost.

*/
-- AlterTable
ALTER TABLE `class` ADD COLUMN `introVideoUrl` VARCHAR(191) NULL,
    ADD COLUMN `mission` TEXT NULL,
    ADD COLUMN `status` ENUM('ANYONE', 'STUDENTS_ONLY', 'PAID_ONLY', 'PRIVATE', 'INACTIVE') NOT NULL DEFAULT 'ANYONE',
    ADD COLUMN `thumbnail` VARCHAR(191) NULL,
    ADD COLUMN `vision` TEXT NULL,
    MODIFY `description` TEXT NULL;

-- AlterTable
ALTER TABLE `month` ADD COLUMN `status` ENUM('ANYONE', 'STUDENTS_ONLY', 'PAID_ONLY', 'PRIVATE', 'INACTIVE') NOT NULL DEFAULT 'ANYONE';

-- AlterTable
ALTER TABLE `profile` ADD COLUMN `occupation` VARCHAR(191) NULL,
    MODIFY `status` ENUM('ACTIVE', 'INACTIVE', 'PENDING', 'OLD') NOT NULL DEFAULT 'PENDING';

-- AlterTable
ALTER TABLE `recording` DROP COLUMN `visibility`,
    ADD COLUMN `icon` VARCHAR(191) NULL,
    ADD COLUMN `materials` TEXT NULL,
    ADD COLUMN `status` ENUM('ANYONE', 'STUDENTS_ONLY', 'PAID_ONLY', 'PRIVATE', 'INACTIVE') NOT NULL DEFAULT 'PAID_ONLY',
    ADD COLUMN `thumbnail` VARCHAR(191) NULL,
    ADD COLUMN `topic` VARCHAR(191) NULL,
    MODIFY `description` TEXT NULL;

-- CreateTable
CREATE TABLE `WatchSession` (
    `id` VARCHAR(191) NOT NULL,
    `userId` VARCHAR(191) NOT NULL,
    `recordingId` VARCHAR(191) NOT NULL,
    `startedAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `endedAt` DATETIME(3) NULL,
    `videoStartPos` DOUBLE NOT NULL DEFAULT 0,
    `videoEndPos` DOUBLE NOT NULL DEFAULT 0,
    `totalWatchedSec` INTEGER NOT NULL DEFAULT 0,
    `status` ENUM('WATCHING', 'PAUSED', 'ENDED') NOT NULL DEFAULT 'WATCHING',
    `events` JSON NULL,

    INDEX `WatchSession_userId_recordingId_idx`(`userId`, `recordingId`),
    INDEX `WatchSession_userId_startedAt_idx`(`userId`, `startedAt`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- AddForeignKey
ALTER TABLE `WatchSession` ADD CONSTRAINT `WatchSession_userId_fkey` FOREIGN KEY (`userId`) REFERENCES `User`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `WatchSession` ADD CONSTRAINT `WatchSession_recordingId_fkey` FOREIGN KEY (`recordingId`) REFERENCES `Recording`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;
