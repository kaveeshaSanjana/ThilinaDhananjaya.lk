-- AddColumn: paymentMethod and paymentPortion to PaymentSlip
ALTER TABLE `PaymentSlip` ADD COLUMN `paymentMethod` ENUM('ONLINE', 'PHYSICAL') NULL;
ALTER TABLE `PaymentSlip` ADD COLUMN `paymentPortion` ENUM('FULL', 'HALF') NULL;

