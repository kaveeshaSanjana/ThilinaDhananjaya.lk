-- Remove subgroup from class attendance and keep session-only uniqueness/indexing.

UPDATE `ClassAttendance`
SET `sessionTime` = '00:00'
WHERE `sessionTime` IS NULL OR TRIM(`sessionTime`) = '';

-- Drop any non-primary index that references subgroup.
SET @drop_subgroup_indexes_sql := (
  SELECT IFNULL(
    CONCAT(
      'ALTER TABLE `ClassAttendance` ',
      GROUP_CONCAT(DISTINCT CONCAT('DROP INDEX `', INDEX_NAME, '`') SEPARATOR ', ')
    ),
    'SELECT 1'
  )
  FROM INFORMATION_SCHEMA.STATISTICS
  WHERE TABLE_SCHEMA = DATABASE()
    AND TABLE_NAME = 'ClassAttendance'
    AND COLUMN_NAME = 'subgroup'
    AND INDEX_NAME <> 'PRIMARY'
);
PREPARE stmt_drop_subgroup_indexes FROM @drop_subgroup_indexes_sql;
EXECUTE stmt_drop_subgroup_indexes;
DEALLOCATE PREPARE stmt_drop_subgroup_indexes;

-- Drop legacy unique key userId+classId+date if it still exists.
SET @legacy_unique_no_time := (
  SELECT s.INDEX_NAME
  FROM INFORMATION_SCHEMA.STATISTICS s
  WHERE s.TABLE_SCHEMA = DATABASE()
    AND s.TABLE_NAME = 'ClassAttendance'
    AND s.NON_UNIQUE = 0
  GROUP BY s.INDEX_NAME
  HAVING GROUP_CONCAT(s.COLUMN_NAME ORDER BY s.SEQ_IN_INDEX) = 'userId,classId,date'
  LIMIT 1
);
SET @drop_legacy_unique_no_time_sql := IF(
  @legacy_unique_no_time IS NOT NULL,
  CONCAT('ALTER TABLE `ClassAttendance` DROP INDEX `', @legacy_unique_no_time, '`'),
  'SELECT 1'
);
PREPARE stmt_drop_legacy_unique_no_time FROM @drop_legacy_unique_no_time_sql;
EXECUTE stmt_drop_legacy_unique_no_time;
DEALLOCATE PREPARE stmt_drop_legacy_unique_no_time;

-- Drop subgroup column if present.
SET @has_col_subgroup := (
  SELECT COUNT(*)
  FROM INFORMATION_SCHEMA.COLUMNS
  WHERE TABLE_SCHEMA = DATABASE()
    AND TABLE_NAME = 'ClassAttendance'
    AND COLUMN_NAME = 'subgroup'
);
SET @drop_col_subgroup_sql := IF(
  @has_col_subgroup > 0,
  'ALTER TABLE `ClassAttendance` DROP COLUMN `subgroup`',
  'SELECT 1'
);
PREPARE stmt_drop_col_subgroup FROM @drop_col_subgroup_sql;
EXECUTE stmt_drop_col_subgroup;
DEALLOCATE PREPARE stmt_drop_col_subgroup;

-- Deduplicate records that now collide on userId+classId+date+sessionTime.
-- Keep the newest row by updatedAt, then createdAt, then id.
DELETE ca_old
FROM `ClassAttendance` ca_old
JOIN `ClassAttendance` ca_new
  ON ca_old.`userId` = ca_new.`userId`
  AND ca_old.`classId` = ca_new.`classId`
  AND ca_old.`date` = ca_new.`date`
  AND ca_old.`sessionTime` = ca_new.`sessionTime`
  AND (
    ca_old.`updatedAt` < ca_new.`updatedAt`
    OR (ca_old.`updatedAt` = ca_new.`updatedAt` AND ca_old.`createdAt` < ca_new.`createdAt`)
    OR (ca_old.`updatedAt` = ca_new.`updatedAt` AND ca_old.`createdAt` = ca_new.`createdAt` AND ca_old.`id` < ca_new.`id`)
  );

-- Ensure unique key is userId+classId+date+sessionTime.
SET @has_unique_session := (
  SELECT COUNT(*)
  FROM (
    SELECT s.INDEX_NAME
    FROM INFORMATION_SCHEMA.STATISTICS s
    WHERE s.TABLE_SCHEMA = DATABASE()
      AND s.TABLE_NAME = 'ClassAttendance'
      AND s.NON_UNIQUE = 0
    GROUP BY s.INDEX_NAME
    HAVING GROUP_CONCAT(s.COLUMN_NAME ORDER BY s.SEQ_IN_INDEX) = 'userId,classId,date,sessionTime'
  ) q
);
SET @create_unique_session_sql := IF(
  @has_unique_session = 0,
  'ALTER TABLE `ClassAttendance` ADD UNIQUE INDEX `ClassAttendance_userId_classId_date_sessionTime_key` (`userId`, `classId`, `date`, `sessionTime`)',
  'SELECT 1'
);
PREPARE stmt_create_unique_session FROM @create_unique_session_sql;
EXECUTE stmt_create_unique_session;
DEALLOCATE PREPARE stmt_create_unique_session;

-- Ensure query index is classId+date+sessionTime.
SET @has_idx_session := (
  SELECT COUNT(*)
  FROM (
    SELECT s.INDEX_NAME
    FROM INFORMATION_SCHEMA.STATISTICS s
    WHERE s.TABLE_SCHEMA = DATABASE()
      AND s.TABLE_NAME = 'ClassAttendance'
      AND s.NON_UNIQUE = 1
    GROUP BY s.INDEX_NAME
    HAVING GROUP_CONCAT(s.COLUMN_NAME ORDER BY s.SEQ_IN_INDEX) = 'classId,date,sessionTime'
  ) q
);
SET @create_idx_session_sql := IF(
  @has_idx_session = 0,
  'CREATE INDEX `ClassAttendance_classId_date_sessionTime_idx` ON `ClassAttendance`(`classId`, `date`, `sessionTime`)',
  'SELECT 1'
);
PREPARE stmt_create_idx_session FROM @create_idx_session_sql;
EXECUTE stmt_create_idx_session;
DEALLOCATE PREPARE stmt_create_idx_session;
