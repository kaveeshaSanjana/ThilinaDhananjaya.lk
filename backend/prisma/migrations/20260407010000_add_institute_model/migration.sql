-- CreateTable
CREATE TABLE IF NOT EXISTS `Institute` (
    `id` VARCHAR(191) NOT NULL,
    `name` VARCHAR(191) NOT NULL,
    `slug` VARCHAR(191) NOT NULL,
    `logoUrl` LONGTEXT NULL,
    `address` VARCHAR(191) NULL,
    `phone` VARCHAR(191) NULL,
    `description` LONGTEXT NULL,
    `themeColor` VARCHAR(191) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,
    CONSTRAINT `Institute_pkey` PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE IF NOT EXISTS `AdminInstitute` (
    `id` VARCHAR(191) NOT NULL,
    `adminId` VARCHAR(191) NOT NULL,
    `instituteId` VARCHAR(191) NOT NULL,
    `isOwner` BOOLEAN NOT NULL DEFAULT false,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    CONSTRAINT `AdminInstitute_pkey` PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- AlterTable
ALTER TABLE `User` ADD COLUMN IF NOT EXISTS `orgId` VARCHAR(191) NULL;

-- AlterTable
ALTER TABLE `Class` ADD COLUMN IF NOT EXISTS `orgId` VARCHAR(191) NULL;

-- CreateIndex
CREATE UNIQUE INDEX IF NOT EXISTS `Institute_slug_key` ON `Institute`(`slug`);

-- CreateIndex
CREATE UNIQUE INDEX IF NOT EXISTS `AdminInstitute_adminId_instituteId_key` ON `AdminInstitute`(`adminId`, `instituteId`);

-- CreateIndex
CREATE INDEX IF NOT EXISTS `AdminInstitute_adminId_idx` ON `AdminInstitute`(`adminId`);

-- CreateIndex
CREATE INDEX IF NOT EXISTS `AdminInstitute_instituteId_idx` ON `AdminInstitute`(`instituteId`);

-- CreateIndex
CREATE INDEX IF NOT EXISTS `User_orgId_idx` ON `User`(`orgId`);

-- CreateIndex
CREATE INDEX IF NOT EXISTS `Class_orgId_idx` ON `Class`(`orgId`);

-- AddForeignKey
ALTER TABLE `AdminInstitute` ADD CONSTRAINT `AdminInstitute_adminId_fkey` FOREIGN KEY (`adminId`) REFERENCES `User`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `AdminInstitute` ADD CONSTRAINT `AdminInstitute_instituteId_fkey` FOREIGN KEY (`instituteId`) REFERENCES `Institute`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `User` ADD CONSTRAINT `User_orgId_fkey` FOREIGN KEY (`orgId`) REFERENCES `Institute`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `Class` ADD CONSTRAINT `Class_orgId_fkey` FOREIGN KEY (`orgId`) REFERENCES `Institute`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;
