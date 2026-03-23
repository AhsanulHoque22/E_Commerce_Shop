CREATE TABLE `shop_brands` (
    `id` VARCHAR(191) NOT NULL,
    `brand_key` VARCHAR(191) NOT NULL,
    `display_name` VARCHAR(128) NOT NULL,
    `logo_url` TEXT NULL,
    `logo_public_id` VARCHAR(512) NULL,
    `is_active` BOOLEAN NOT NULL DEFAULT true,
    `sort_order` INTEGER NOT NULL DEFAULT 0,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updated_at` DATETIME(3) NOT NULL,

    UNIQUE INDEX `shop_brands_brand_key_key`(`brand_key`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
