-- CreateTable
CREATE TABLE `sys_admin` (
    `id` BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
    `username` VARCHAR(32) NOT NULL,
    `password` VARCHAR(100) NOT NULL,
    `nickname` VARCHAR(32) NOT NULL,
    `avatar` VARCHAR(255) NULL,
    `email` VARCHAR(64) NULL,
    `phone` VARCHAR(20) NULL,
    `status` TINYINT UNSIGNED NOT NULL DEFAULT 1,
    `is_builtin` TINYINT UNSIGNED NOT NULL DEFAULT 0,
    `last_login_at` DATETIME(0) NULL,
    `last_login_ip` VARCHAR(45) NULL,
    `remark` VARCHAR(255) NULL,
    `pwd_updated_at` DATETIME(0) NULL,
    `created_by` BIGINT UNSIGNED NULL,
    `created_at` DATETIME(0) NOT NULL DEFAULT CURRENT_TIMESTAMP(0),
    `updated_at` DATETIME(0) NOT NULL,
    `deleted_at` DATETIME(0) NULL,

    INDEX `idx_status`(`status`),
    INDEX `idx_deleted_at`(`deleted_at`),
    UNIQUE INDEX `uk_username`(`username`, `deleted_at`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `sys_role` (
    `id` BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
    `name` VARCHAR(32) NOT NULL,
    `code` VARCHAR(64) NOT NULL,
    `description` VARCHAR(255) NULL,
    `data_scope` TINYINT UNSIGNED NOT NULL DEFAULT 1,
    `is_builtin` TINYINT UNSIGNED NOT NULL DEFAULT 0,
    `sort` INTEGER NOT NULL DEFAULT 0,
    `status` TINYINT UNSIGNED NOT NULL DEFAULT 1,
    `created_at` DATETIME(0) NOT NULL DEFAULT CURRENT_TIMESTAMP(0),
    `updated_at` DATETIME(0) NOT NULL,
    `deleted_at` DATETIME(0) NULL,

    INDEX `idx_status`(`status`),
    UNIQUE INDEX `uk_code`(`code`, `deleted_at`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `sys_permission` (
    `id` BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
    `parent_id` BIGINT UNSIGNED NOT NULL DEFAULT 0,
    `name` VARCHAR(32) NOT NULL,
    `type` TINYINT UNSIGNED NOT NULL,
    `code` VARCHAR(128) NULL,
    `route_path` VARCHAR(128) NULL,
    `route_name` VARCHAR(64) NULL,
    `component` VARCHAR(128) NULL,
    `icon` VARCHAR(64) NULL,
    `sort` INTEGER NOT NULL DEFAULT 0,
    `visible` TINYINT UNSIGNED NOT NULL DEFAULT 1,
    `keep_alive` TINYINT UNSIGNED NOT NULL DEFAULT 0,
    `status` TINYINT UNSIGNED NOT NULL DEFAULT 1,
    `http_method` VARCHAR(10) NULL,
    `api_path` VARCHAR(191) NULL,
    `created_at` DATETIME(0) NOT NULL DEFAULT CURRENT_TIMESTAMP(0),
    `updated_at` DATETIME(0) NOT NULL,

    UNIQUE INDEX `uk_code`(`code`),
    INDEX `idx_parent_id`(`parent_id`),
    INDEX `idx_type_status`(`type`, `status`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `sys_admin_role` (
    `id` BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
    `admin_id` BIGINT UNSIGNED NOT NULL,
    `role_id` BIGINT UNSIGNED NOT NULL,
    `created_at` DATETIME(0) NOT NULL DEFAULT CURRENT_TIMESTAMP(0),

    INDEX `idx_role_id`(`role_id`),
    UNIQUE INDEX `uk_admin_role`(`admin_id`, `role_id`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `sys_role_permission` (
    `id` BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
    `role_id` BIGINT UNSIGNED NOT NULL,
    `permission_id` BIGINT UNSIGNED NOT NULL,
    `created_at` DATETIME(0) NOT NULL DEFAULT CURRENT_TIMESTAMP(0),

    INDEX `idx_permission_id`(`permission_id`),
    UNIQUE INDEX `uk_role_permission`(`role_id`, `permission_id`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `sys_operation_log` (
    `id` BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
    `type` TINYINT UNSIGNED NOT NULL DEFAULT 1,
    `admin_id` BIGINT UNSIGNED NULL,
    `username` VARCHAR(32) NULL,
    `module` VARCHAR(32) NULL,
    `action` VARCHAR(64) NULL,
    `permission_code` VARCHAR(128) NULL,
    `http_method` VARCHAR(10) NULL,
    `api_path` VARCHAR(191) NULL,
    `request_params` JSON NULL,
    `status` TINYINT UNSIGNED NOT NULL DEFAULT 1,
    `http_status` INTEGER NULL,
    `error_msg` VARCHAR(500) NULL,
    `duration_ms` INTEGER NULL,
    `ip` VARCHAR(45) NULL,
    `user_agent` VARCHAR(255) NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `idx_admin_id`(`admin_id`),
    INDEX `idx_created_at`(`created_at`),
    INDEX `idx_type_created`(`type`, `created_at`),
    INDEX `idx_module`(`module`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
