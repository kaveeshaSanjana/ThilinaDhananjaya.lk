-- Add performance indexes for optimal query performance

-- Profile indexes
CREATE INDEX `Profile_phone_idx` ON `Profile`(`phone`);
CREATE INDEX `Profile_status_idx` ON `Profile`(`status`);
CREATE INDEX `Profile_fullName_idx` ON `Profile`(`fullName`(191));

-- Month indexes
CREATE INDEX `Month_classId_idx` ON `Month`(`classId`);

-- Recording indexes
CREATE INDEX `Recording_monthId_idx` ON `Recording`(`monthId`);
CREATE INDEX `Recording_monthId_order_idx` ON `Recording`(`monthId`, `order`);
CREATE INDEX `Recording_status_idx` ON `Recording`(`status`);
CREATE INDEX `Recording_isLive_idx` ON `Recording`(`isLive`);

-- Enrollment indexes
CREATE INDEX `Enrollment_userId_idx` ON `Enrollment`(`userId`);
CREATE INDEX `Enrollment_classId_idx` ON `Enrollment`(`classId`);

-- PaymentSlip indexes
CREATE INDEX `PaymentSlip_userId_idx` ON `PaymentSlip`(`userId`);
CREATE INDEX `PaymentSlip_monthId_idx` ON `PaymentSlip`(`monthId`);
CREATE INDEX `PaymentSlip_status_idx` ON `PaymentSlip`(`status`);
CREATE INDEX `PaymentSlip_userId_monthId_idx` ON `PaymentSlip`(`userId`, `monthId`);
CREATE INDEX `PaymentSlip_createdAt_idx` ON `PaymentSlip`(`createdAt`);

-- Attendance indexes (replace the old composite with separate ones)
DROP INDEX `Attendance_userId_recordingId_idx` ON `Attendance`;
CREATE INDEX `Attendance_userId_idx` ON `Attendance`(`userId`);
CREATE INDEX `Attendance_recordingId_idx` ON `Attendance`(`recordingId`);
CREATE INDEX `Attendance_createdAt_idx` ON `Attendance`(`createdAt`);
