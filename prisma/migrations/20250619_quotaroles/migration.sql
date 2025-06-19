CREATE TABLE "QuotaRole" (
  "quotaId" UUID NOT NULL,
  "roleId" UUID NOT NULL,
  CONSTRAINT "QuotaRole_pkey" PRIMARY KEY ("quotaId", "roleId"),
  CONSTRAINT "QuotaRole_quotaId_fkey" FOREIGN KEY ("quotaId") REFERENCES "Quota"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT "QuotaRole_roleId_fkey" FOREIGN KEY ("roleId") REFERENCES "role"("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

CREATE UNIQUE INDEX "QuotaRole_quotaId_roleId_key" ON "QuotaRole"("quotaId", "roleId");