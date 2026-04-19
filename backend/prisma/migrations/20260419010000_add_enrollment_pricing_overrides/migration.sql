-- Add per-student enrollment pricing controls for admin use.
-- Default payment type is FULL (class monthly fee), with optional custom monthly fee override.

SET @has_col_payment_type := (
  SELECT COUNT(*)
  FROM INFORMATION_SCHEMA.COLUMNS
  WHERE TABLE_SCHEMA = DATABASE()
    AND TABLE_NAME = 'Enrollment'
    AND COLUMN_NAME = 'paymentType'
);
SET @add_col_payment_type_sql := IF(
  @has_col_payment_type = 0,
  'ALTER TABLE `Enrollment` ADD COLUMN `paymentType` ENUM(''FULL'', ''HALF'', ''FREE'') NOT NULL DEFAULT ''FULL'' AFTER `classId`',
  'SELECT 1'
);
PREPARE stmt_add_col_payment_type FROM @add_col_payment_type_sql;
EXECUTE stmt_add_col_payment_type;
DEALLOCATE PREPARE stmt_add_col_payment_type;

SET @has_col_custom_fee := (
  SELECT COUNT(*)
  FROM INFORMATION_SCHEMA.COLUMNS
  WHERE TABLE_SCHEMA = DATABASE()
    AND TABLE_NAME = 'Enrollment'
    AND COLUMN_NAME = 'customMonthlyFee'
);
SET @add_col_custom_fee_sql := IF(
  @has_col_custom_fee = 0,
  'ALTER TABLE `Enrollment` ADD COLUMN `customMonthlyFee` DOUBLE NULL AFTER `paymentType`',
  'SELECT 1'
);
PREPARE stmt_add_col_custom_fee FROM @add_col_custom_fee_sql;
EXECUTE stmt_add_col_custom_fee;
DEALLOCATE PREPARE stmt_add_col_custom_fee;

SET @has_col_updated_at := (
  SELECT COUNT(*)
  FROM INFORMATION_SCHEMA.COLUMNS
  WHERE TABLE_SCHEMA = DATABASE()
    AND TABLE_NAME = 'Enrollment'
    AND COLUMN_NAME = 'updatedAt'
);
SET @add_col_updated_at_sql := IF(
  @has_col_updated_at = 0,
  'ALTER TABLE `Enrollment` ADD COLUMN `updatedAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3) AFTER `createdAt`',
  'SELECT 1'
);
PREPARE stmt_add_col_updated_at FROM @add_col_updated_at_sql;
EXECUTE stmt_add_col_updated_at;
DEALLOCATE PREPARE stmt_add_col_updated_at;

UPDATE `Enrollment`
SET `paymentType` = 'FULL'
WHERE `paymentType` IS NULL;

-- Add index: class + payment type for FREE/HALF/FULL filters.
SET @has_idx_payment_type := (
  SELECT COUNT(*)
  FROM INFORMATION_SCHEMA.STATISTICS
  WHERE TABLE_SCHEMA = DATABASE()
    AND TABLE_NAME = 'Enrollment'
    AND INDEX_NAME = 'Enrollment_classId_paymentType_idx'
);
SET @create_idx_payment_type_sql := IF(
  @has_idx_payment_type = 0,
  'CREATE INDEX `Enrollment_classId_paymentType_idx` ON `Enrollment`(`classId`, `paymentType`)',
  'SELECT 1'
);
PREPARE stmt_create_idx_payment_type FROM @create_idx_payment_type_sql;
EXECUTE stmt_create_idx_payment_type;
DEALLOCATE PREPARE stmt_create_idx_payment_type;

-- Add index: class + custom fee presence/value for custom-fee filters.
SET @has_idx_custom_fee := (
  SELECT COUNT(*)
  FROM INFORMATION_SCHEMA.STATISTICS
  WHERE TABLE_SCHEMA = DATABASE()
    AND TABLE_NAME = 'Enrollment'
    AND INDEX_NAME = 'Enrollment_classId_customMonthlyFee_idx'
);
SET @create_idx_custom_fee_sql := IF(
  @has_idx_custom_fee = 0,
  'CREATE INDEX `Enrollment_classId_customMonthlyFee_idx` ON `Enrollment`(`classId`, `customMonthlyFee`)',
  'SELECT 1'
);
PREPARE stmt_create_idx_custom_fee FROM @create_idx_custom_fee_sql;
EXECUTE stmt_create_idx_custom_fee;
DEALLOCATE PREPARE stmt_create_idx_custom_fee;
