-- Persist week groups for physical attendance and link sessions to a week.

CREATE TABLE IF NOT EXISTS `ClassAttendanceWeek` (
  `id` VARCHAR(191) NOT NULL,
  `classId` VARCHAR(191) NOT NULL,
  `name` VARCHAR(120) NOT NULL,
  `orderNo` INT NOT NULL DEFAULT 0,
  `createdBy` VARCHAR(191) NULL,
  `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `updatedAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

  PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- Add optional weekId link on ClassAttendanceSession if missing.
SET @has_week_id_column := (
  SELECT COUNT(*)
  FROM INFORMATION_SCHEMA.COLUMNS
  WHERE TABLE_SCHEMA = DATABASE()
    AND TABLE_NAME = 'ClassAttendanceSession'
    AND COLUMN_NAME = 'weekId'
);
SET @add_week_id_column_sql := IF(
  @has_week_id_column = 0,
  'ALTER TABLE `ClassAttendanceSession` ADD COLUMN `weekId` VARCHAR(191) NULL',
  'SELECT 1'
);
PREPARE stmt_add_week_id_column FROM @add_week_id_column_sql;
EXECUTE stmt_add_week_id_column;
DEALLOCATE PREPARE stmt_add_week_id_column;

-- Ensure FK ClassAttendanceWeek.classId -> Class.id exists.
SET @has_week_class_fk := (
  SELECT COUNT(*)
  FROM INFORMATION_SCHEMA.KEY_COLUMN_USAGE
  WHERE TABLE_SCHEMA = DATABASE()
    AND TABLE_NAME = 'ClassAttendanceWeek'
    AND COLUMN_NAME = 'classId'
    AND REFERENCED_TABLE_NAME = 'Class'
);
SET @add_week_class_fk_sql := IF(
  @has_week_class_fk = 0,
  'ALTER TABLE `ClassAttendanceWeek` ADD CONSTRAINT `ClassAttendanceWeek_classId_fkey` FOREIGN KEY (`classId`) REFERENCES `Class`(`id`) ON DELETE CASCADE ON UPDATE CASCADE',
  'SELECT 1'
);
PREPARE stmt_add_week_class_fk FROM @add_week_class_fk_sql;
EXECUTE stmt_add_week_class_fk;
DEALLOCATE PREPARE stmt_add_week_class_fk;

-- Ensure FK ClassAttendanceSession.weekId -> ClassAttendanceWeek.id exists.
SET @has_session_week_fk := (
  SELECT COUNT(*)
  FROM INFORMATION_SCHEMA.KEY_COLUMN_USAGE
  WHERE TABLE_SCHEMA = DATABASE()
    AND TABLE_NAME = 'ClassAttendanceSession'
    AND COLUMN_NAME = 'weekId'
    AND REFERENCED_TABLE_NAME = 'ClassAttendanceWeek'
);
SET @add_session_week_fk_sql := IF(
  @has_session_week_fk = 0,
  'ALTER TABLE `ClassAttendanceSession` ADD CONSTRAINT `ClassAttendanceSession_weekId_fkey` FOREIGN KEY (`weekId`) REFERENCES `ClassAttendanceWeek`(`id`) ON DELETE SET NULL ON UPDATE CASCADE',
  'SELECT 1'
);
PREPARE stmt_add_session_week_fk FROM @add_session_week_fk_sql;
EXECUTE stmt_add_session_week_fk;
DEALLOCATE PREPARE stmt_add_session_week_fk;

-- Ensure unique index on (classId, name) for ClassAttendanceWeek exists.
SET @has_week_unique_class_name := (
  SELECT COUNT(*)
  FROM (
    SELECT s.INDEX_NAME
    FROM INFORMATION_SCHEMA.STATISTICS s
    WHERE s.TABLE_SCHEMA = DATABASE()
      AND s.TABLE_NAME = 'ClassAttendanceWeek'
      AND s.NON_UNIQUE = 0
    GROUP BY s.INDEX_NAME
    HAVING GROUP_CONCAT(s.COLUMN_NAME ORDER BY s.SEQ_IN_INDEX) = 'classId,name'
  ) q
);
SET @create_week_unique_class_name_sql := IF(
  @has_week_unique_class_name = 0,
  'ALTER TABLE `ClassAttendanceWeek` ADD UNIQUE INDEX `ClassAttendanceWeek_classId_name_key` (`classId`, `name`)',
  'SELECT 1'
);
PREPARE stmt_create_week_unique_class_name FROM @create_week_unique_class_name_sql;
EXECUTE stmt_create_week_unique_class_name;
DEALLOCATE PREPARE stmt_create_week_unique_class_name;

-- Ensure index on (classId, orderNo, createdAt) for ClassAttendanceWeek exists.
SET @has_week_idx_class_order_created := (
  SELECT COUNT(*)
  FROM (
    SELECT s.INDEX_NAME
    FROM INFORMATION_SCHEMA.STATISTICS s
    WHERE s.TABLE_SCHEMA = DATABASE()
      AND s.TABLE_NAME = 'ClassAttendanceWeek'
      AND s.NON_UNIQUE = 1
    GROUP BY s.INDEX_NAME
    HAVING GROUP_CONCAT(s.COLUMN_NAME ORDER BY s.SEQ_IN_INDEX) = 'classId,orderNo,createdAt'
  ) q
);
SET @create_week_idx_class_order_created_sql := IF(
  @has_week_idx_class_order_created = 0,
  'ALTER TABLE `ClassAttendanceWeek` ADD INDEX `ClassAttendanceWeek_classId_orderNo_createdAt_idx` (`classId`, `orderNo`, `createdAt`)',
  'SELECT 1'
);
PREPARE stmt_create_week_idx_class_order_created FROM @create_week_idx_class_order_created_sql;
EXECUTE stmt_create_week_idx_class_order_created;
DEALLOCATE PREPARE stmt_create_week_idx_class_order_created;

-- Ensure index on ClassAttendanceSession.weekId exists.
SET @has_session_week_idx := (
  SELECT COUNT(*)
  FROM (
    SELECT s.INDEX_NAME
    FROM INFORMATION_SCHEMA.STATISTICS s
    WHERE s.TABLE_SCHEMA = DATABASE()
      AND s.TABLE_NAME = 'ClassAttendanceSession'
      AND s.NON_UNIQUE = 1
    GROUP BY s.INDEX_NAME
    HAVING GROUP_CONCAT(s.COLUMN_NAME ORDER BY s.SEQ_IN_INDEX) = 'weekId'
  ) q
);
SET @create_session_week_idx_sql := IF(
  @has_session_week_idx = 0,
  'ALTER TABLE `ClassAttendanceSession` ADD INDEX `ClassAttendanceSession_weekId_idx` (`weekId`)',
  'SELECT 1'
);
PREPARE stmt_create_session_week_idx FROM @create_session_week_idx_sql;
EXECUTE stmt_create_session_week_idx;
DEALLOCATE PREPARE stmt_create_session_week_idx;

-- Ensure index on (classId, weekId, date, sessionTime) exists.
SET @has_session_class_week_date_time_idx := (
  SELECT COUNT(*)
  FROM (
    SELECT s.INDEX_NAME
    FROM INFORMATION_SCHEMA.STATISTICS s
    WHERE s.TABLE_SCHEMA = DATABASE()
      AND s.TABLE_NAME = 'ClassAttendanceSession'
      AND s.NON_UNIQUE = 1
    GROUP BY s.INDEX_NAME
    HAVING GROUP_CONCAT(s.COLUMN_NAME ORDER BY s.SEQ_IN_INDEX) = 'classId,weekId,date,sessionTime'
  ) q
);
SET @create_session_class_week_date_time_idx_sql := IF(
  @has_session_class_week_date_time_idx = 0,
  'ALTER TABLE `ClassAttendanceSession` ADD INDEX `ClassAttendanceSession_classId_weekId_date_sessionTime_idx` (`classId`, `weekId`, `date`, `sessionTime`)',
  'SELECT 1'
);
PREPARE stmt_create_session_class_week_date_time_idx FROM @create_session_class_week_date_time_idx_sql;
EXECUTE stmt_create_session_class_week_date_time_idx;
DEALLOCATE PREPARE stmt_create_session_class_week_date_time_idx;
