CREATE TABLE "module_permissions" (
    "id" TEXT NOT NULL,
    "module_key" TEXT NOT NULL,
    "module_label" TEXT NOT NULL,
    "rol" "Rol" NOT NULL,
    "enabled" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "module_permissions_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "module_permissions_module_key_rol_key" ON "module_permissions"("module_key", "rol");
CREATE INDEX "module_permissions_rol_idx" ON "module_permissions"("rol");
