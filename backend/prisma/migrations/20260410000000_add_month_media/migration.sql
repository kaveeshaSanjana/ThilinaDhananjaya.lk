-- CreateTable
CREATE TABLE `MonthMedia` (
    `id` VARCHAR(191) NOT NULL,
    `monthId` VARCHAR(191) NOT NULL,
    `title` VARCHAR(191) NOT NULL,
    `description` LONGTEXT NULL,
    `fileUrl` LONGTEXT NOT NULL,
    `mediaType` ENUM('PDF', 'IMAGE', 'LINK', 'DOCUMENT', 'OTHER') NOT NULL DEFAULT 'OTHER',
    `thumbnail` LONGTEXT NULL,
    `size` INTEGER NULL,
    `order` INTEGER NOT NULL DEFAULT 0,
    `status` ENUM('ANYONE', 'STUDENTS_ONLY', 'PAID_ONLY', 'PRIVATE', 'INACTIVE') NOT NULL DEFAULT 'STUDENTS_ONLY',
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    INDEX `MonthMedia_monthId_idx`(`monthId`),
    INDEX `MonthMedia_monthId_order_idx`(`monthId`, `order`),
    INDEX `MonthMedia_status_idx`(`status`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- AddForeignKey
ALTER TABLE `MonthMedia` ADD CONSTRAINT `MonthMedia_monthId_fkey` FOREIGN KEY (`monthId`) REFERENCES `Month`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;
