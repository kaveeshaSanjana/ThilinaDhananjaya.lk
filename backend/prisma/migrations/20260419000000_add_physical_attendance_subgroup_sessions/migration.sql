-- Add subgroup and session metadata for physical attendance.
-- This enables multiple same-day attendance rows per student across subgroups/time slots.

SET @has_col_subgroup := (
  SELECT COUNT(*)
  FROM INFORMATION_SCHEMA.COLUMNS
  WHERE TABLE_SCHEMA = DATABASE()
    AND TABLE_NAME = 'ClassAttendance'
    AND COLUMN_NAME = 'subgroup'
);
SET @add_col_subgroup_sql := IF(
  @has_col_subgroup = 0,
  'ALTER TABLE `ClassAttendance` ADD COLUMN `subgroup` VARCHAR(64) NOT NULL DEFAULT ''MAIN'' AFTER `date`',
  'SELECT 1'
);
PREPARE stmt_add_col_subgroup FROM @add_col_subgroup_sql;
EXECUTE stmt_add_col_subgroup;
DEALLOCATE PREPARE stmt_add_col_subgroup;

SET @has_col_session_time := (
  SELECT COUNT(*)
  FROM INFORMATION_SCHEMA.COLUMNS
  WHERE TABLE_SCHEMA = DATABASE()
    AND TABLE_NAME = 'ClassAttendance'
    AND COLUMN_NAME = 'sessionTime'
);
SET @add_col_session_time_sql := IF(
  @has_col_session_time = 0,
  'ALTER TABLE `ClassAttendance` ADD COLUMN `sessionTime` VARCHAR(5) NOT NULL DEFAULT ''00:00'' AFTER `subgroup`',
  'SELECT 1'
);
PREPARE stmt_add_col_session_time FROM @add_col_session_time_sql;
EXECUTE stmt_add_col_session_time;
DEALLOCATE PREPARE stmt_add_col_session_time;

SET @has_col_session_code := (
  SELECT COUNT(*)
  FROM INFORMATION_SCHEMA.COLUMNS
  WHERE TABLE_SCHEMA = DATABASE()
    AND TABLE_NAME = 'ClassAttendance'
    AND COLUMN_NAME = 'sessionCode'
);
SET @add_col_session_code_sql := IF(
  @has_col_session_code = 0,
  'ALTER TABLE `ClassAttendance` ADD COLUMN `sessionCode` VARCHAR(120) NULL AFTER `sessionTime`',
  'SELECT 1'
);
PREPARE stmt_add_col_session_code FROM @add_col_session_code_sql;
EXECUTE stmt_add_col_session_code;
DEALLOCATE PREPARE stmt_add_col_session_code;

SET @has_col_session_at := (
  SELECT COUNT(*)
  FROM INFORMATION_SCHEMA.COLUMNS
  WHERE TABLE_SCHEMA = DATABASE()
    AND TABLE_NAME = 'ClassAttendance'
    AND COLUMN_NAME = 'sessionAt'
);
SET @add_col_session_at_sql := IF(
  @has_col_session_at = 0,
  'ALTER TABLE `ClassAttendance` ADD COLUMN `sessionAt` DATETIME(3) NULL AFTER `sessionCode`',
  'SELECT 1'
);
PREPARE stmt_add_col_session_at FROM @add_col_session_at_sql;
EXECUTE stmt_add_col_session_at;
DEALLOCATE PREPARE stmt_add_col_session_at;

UPDATE `ClassAttendance`
SET `subgroup` = 'MAIN'
WHERE `subgroup` IS NULL OR TRIM(`subgroup`) = '';

UPDATE `ClassAttendance`
SET `sessionTime` = '00:00'
WHERE `sessionTime` IS NULL OR TRIM(`sessionTime`) = '';

-- Drop old unique index if it exists.
SET @old_unique := (
  SELECT INDEX_NAME
  FROM INFORMATION_SCHEMA.STATISTICS
  WHERE TABLE_SCHEMA = DATABASE()
    AND TABLE_NAME = 'ClassAttendance'
    AND NON_UNIQUE = 0
    AND INDEX_NAME IN ('ClassAttendance_userId_classId_date_key', 'userId_classId_date')
  LIMIT 1
);
SET @drop_old_unique_sql := IF(
  @old_unique IS NOT NULL,
  CONCAT('ALTER TABLE `ClassAttendance` DROP INDEX `', @old_unique, '`'),
  'SELECT 1'
);
PREPARE stmt_drop_old_unique FROM @drop_old_unique_sql;
EXECUTE stmt_drop_old_unique;
DEALLOCATE PREPARE stmt_drop_old_unique;

-- Add new unique index if missing.
SET @has_new_unique := (
  SELECT COUNT(*)
  FROM INFORMATION_SCHEMA.STATISTICS
  WHERE TABLE_SCHEMA = DATABASE()
    AND TABLE_NAME = 'ClassAttendance'
    AND INDEX_NAME = 'ClassAttendance_userId_classId_date_subgroup_sessionTime_key'
);
SET @create_new_unique_sql := IF(
  @has_new_unique = 0,
  'ALTER TABLE `ClassAttendance` ADD UNIQUE INDEX `ClassAttendance_userId_classId_date_subgroup_sessionTime_key` (`userId`, `classId`, `date`, `subgroup`, `sessionTime`)',
  'SELECT 1'
);
PREPARE stmt_create_new_unique FROM @create_new_unique_sql;
EXECUTE stmt_create_new_unique;
DEALLOCATE PREPARE stmt_create_new_unique;

-- Keep existing date index (may be required by FK) and add a session-aware index.
SET @has_new_idx := (
  SELECT COUNT(*)
  FROM INFORMATION_SCHEMA.STATISTICS
  WHERE TABLE_SCHEMA = DATABASE()
    AND TABLE_NAME = 'ClassAttendance'
    AND INDEX_NAME = 'ClassAttendance_classId_date_sessionTime_subgroup_idx'
);
SET @create_new_idx_sql := IF(
  @has_new_idx = 0,
  'CREATE INDEX `ClassAttendance_classId_date_sessionTime_subgroup_idx` ON `ClassAttendance`(`classId`, `date`, `sessionTime`, `subgroup`)',
  'SELECT 1'
);
PREPARE stmt_create_new_idx FROM @create_new_idx_sql;
EXECUTE stmt_create_new_idx;
DEALLOCATE PREPARE stmt_create_new_idx;
