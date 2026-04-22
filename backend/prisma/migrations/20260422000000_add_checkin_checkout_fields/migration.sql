-- Add explicit check-in/check-out support for physical attendance rows
ALTER TABLE `ClassAttendance`
  ADD COLUMN `sessionEndTime` VARCHAR(5) NULL,
  ADD COLUMN `checkInAt` DATETIME(3) NULL,
  ADD COLUMN `checkOutAt` DATETIME(3) NULL;

-- Add optional end-time metadata for class attendance sessions
ALTER TABLE `ClassAttendanceSession`
  ADD COLUMN `sessionEndTime` VARCHAR(5) NULL;
