-- Idempotent fix: ensure paymentMethod and paymentPortion columns exist on PaymentSlip.
-- This is a safety migration in case the previous migration failed due to a SQL syntax error.

SET @dbname = DATABASE();

-- Add paymentMethod if missing
SET @paymentMethod_exists = (
  SELECT COUNT(*) FROM information_schema.COLUMNS
  WHERE TABLE_SCHEMA = @dbname AND TABLE_NAME = 'PaymentSlip' AND COLUMN_NAME = 'paymentMethod'
);
SET @sql = IF(@paymentMethod_exists = 0,
  'ALTER TABLE `PaymentSlip` ADD COLUMN `paymentMethod` ENUM(''ONLINE'', ''PHYSICAL'') NULL',
  'SELECT 1'
);
PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

-- Add paymentPortion if missing
SET @paymentPortion_exists = (
  SELECT COUNT(*) FROM information_schema.COLUMNS
  WHERE TABLE_SCHEMA = @dbname AND TABLE_NAME = 'PaymentSlip' AND COLUMN_NAME = 'paymentPortion'
);
SET @sql2 = IF(@paymentPortion_exists = 0,
  'ALTER TABLE `PaymentSlip` ADD COLUMN `paymentPortion` ENUM(''FULL'', ''HALF'') NULL',
  'SELECT 1'
);
PREPARE stmt2 FROM @sql2;
EXECUTE stmt2;
DEALLOCATE PREPARE stmt2;
