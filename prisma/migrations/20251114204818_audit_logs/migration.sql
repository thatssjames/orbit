-- CreateTable
CREATE TABLE "AuditLog" (
    "id" SERIAL NOT NULL,
    "workspaceGroupId" INTEGER NOT NULL,
    "userId" BIGINT,
    "action" TEXT NOT NULL,
    "entity" TEXT,
    "details" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AuditLog_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "AuditLog_createdAt_idx" ON "AuditLog"("createdAt");
