-- Create standalone class attendance sessions table.
-- Sessions can be created before any attendance rows are marked/imported.

CREATE TABLE IF NOT EXISTS `ClassAttendanceSession` (
  `id` VARCHAR(191) NOT NULL,
  `classId` VARCHAR(191) NOT NULL,
  `date` DATE NOT NULL,
  `sessionTime` VARCHAR(5) NOT NULL DEFAULT '00:00',
  `sessionCode` VARCHAR(120) NULL,
  `sessionAt` DATETIME(3) NULL,
  `createdBy` VARCHAR(191) NULL,
  `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `updatedAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

  PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- Ensure FK to Class exists.
SET @has_class_fk := (
  SELECT COUNT(*)
  FROM INFORMATION_SCHEMA.KEY_COLUMN_USAGE
  WHERE TABLE_SCHEMA = DATABASE()
    AND TABLE_NAME = 'ClassAttendanceSession'
    AND COLUMN_NAME = 'classId'
    AND REFERENCED_TABLE_NAME = 'Class'
);
SET @add_class_fk_sql := IF(
  @has_class_fk = 0,
  'ALTER TABLE `ClassAttendanceSession` ADD CONSTRAINT `ClassAttendanceSession_classId_fkey` FOREIGN KEY (`classId`) REFERENCES `Class`(`id`) ON DELETE CASCADE ON UPDATE CASCADE',
  'SELECT 1'
);
PREPARE stmt_add_class_fk FROM @add_class_fk_sql;
EXECUTE stmt_add_class_fk;
DEALLOCATE PREPARE stmt_add_class_fk;

-- Ensure uniqueness for session slots by class/date/time.
SET @has_unique_slot := (
  SELECT COUNT(*)
  FROM (
    SELECT s.INDEX_NAME
    FROM INFORMATION_SCHEMA.STATISTICS s
    WHERE s.TABLE_SCHEMA = DATABASE()
      AND s.TABLE_NAME = 'ClassAttendanceSession'
      AND s.NON_UNIQUE = 0
    GROUP BY s.INDEX_NAME
    HAVING GROUP_CONCAT(s.COLUMN_NAME ORDER BY s.SEQ_IN_INDEX) = 'classId,date,sessionTime'
  ) q
);
SET @create_unique_slot_sql := IF(
  @has_unique_slot = 0,
  'ALTER TABLE `ClassAttendanceSession` ADD UNIQUE INDEX `ClassAttendanceSession_classId_date_sessionTime_key` (`classId`, `date`, `sessionTime`)',
  'SELECT 1'
);
PREPARE stmt_create_unique_slot FROM @create_unique_slot_sql;
EXECUTE stmt_create_unique_slot;
DEALLOCATE PREPARE stmt_create_unique_slot;
