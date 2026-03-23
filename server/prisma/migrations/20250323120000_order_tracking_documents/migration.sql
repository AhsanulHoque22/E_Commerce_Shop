-- Order lifecycle: OUT_FOR_DELIVERY, document refs, stage timestamps, shipment URL/courier.
-- Apply when your DB user can run DDL. If `status` is not a MySQL ENUM, adjust the MODIFY line.

ALTER TABLE `orders` MODIFY COLUMN `status` ENUM(
  'PENDING_APPROVAL',
  'APPROVED',
  'PAYMENT_PENDING',
  'PAID',
  'SHIPPED',
  'OUT_FOR_DELIVERY',
  'DELIVERED',
  'COMPLETED',
  'CANCELLED'
) NOT NULL;

ALTER TABLE `orders`
  ADD COLUMN `courier_name` VARCHAR(160) NULL,
  ADD COLUMN `shipment_tracking_url` TEXT NULL,
  ADD COLUMN `invoice_public_id` VARCHAR(80) NULL,
  ADD COLUMN `invoice_issued_at` DATETIME(3) NULL,
  ADD COLUMN `receipt_public_id` VARCHAR(80) NULL,
  ADD COLUMN `receipt_issued_at` DATETIME(3) NULL,
  ADD COLUMN `approved_at` DATETIME(3) NULL,
  ADD COLUMN `payment_pending_at` DATETIME(3) NULL,
  ADD COLUMN `paid_at` DATETIME(3) NULL,
  ADD COLUMN `shipped_at` DATETIME(3) NULL,
  ADD COLUMN `out_for_delivery_at` DATETIME(3) NULL,
  ADD COLUMN `delivered_at` DATETIME(3) NULL,
  ADD COLUMN `completed_at` DATETIME(3) NULL;

CREATE UNIQUE INDEX `orders_invoice_public_id_key` ON `orders` (`invoice_public_id`);
CREATE UNIQUE INDEX `orders_receipt_public_id_key` ON `orders` (`receipt_public_id`);
