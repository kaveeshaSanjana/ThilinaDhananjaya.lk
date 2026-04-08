-- AddColumn: liveToken to Lecture
ALTER TABLE `Lecture` ADD COLUMN `liveToken` VARCHAR(191) NULL;
ALTER TABLE `Lecture` ADD UNIQUE INDEX `Lecture_liveToken_key` (`liveToken`);
