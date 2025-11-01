-- AlterTable
ALTER TABLE "ActivitySession" ADD COLUMN     "sessionMessage" TEXT;

-- AlterTable
ALTER TABLE "inactivityNotice" ADD COLUMN     "reviewComment" TEXT;

-- CreateTable
CREATE TABLE "ActivityHistory" (
    "id" UUID NOT NULL,
    "userId" BIGINT NOT NULL,
    "workspaceGroupId" INTEGER NOT NULL,
    "periodStart" TIMESTAMP(3) NOT NULL,
    "periodEnd" TIMESTAMP(3) NOT NULL,
    "minutes" INTEGER NOT NULL,
    "messages" INTEGER NOT NULL,
    "sessionsHosted" INTEGER NOT NULL,
    "sessionsAttended" INTEGER NOT NULL,
    "idleTime" INTEGER NOT NULL,
    "wallPosts" INTEGER NOT NULL DEFAULT 0,
    "quotaProgress" JSONB NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ActivityHistory_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ActivityReset" (
    "id" UUID NOT NULL,
    "workspaceGroupId" INTEGER NOT NULL,
    "resetById" BIGINT NOT NULL,
    "resetAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "previousPeriodStart" TIMESTAMP(3),
    "previousPeriodEnd" TIMESTAMP(3),

    CONSTRAINT "ActivityReset_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "ActivityHistory_userId_idx" ON "ActivityHistory"("userId");

-- CreateIndex
CREATE INDEX "ActivityHistory_workspaceGroupId_idx" ON "ActivityHistory"("workspaceGroupId");

-- CreateIndex
CREATE INDEX "ActivityHistory_periodStart_idx" ON "ActivityHistory"("periodStart");

-- CreateIndex
CREATE INDEX "ActivityHistory_periodEnd_idx" ON "ActivityHistory"("periodEnd");

-- CreateIndex
CREATE INDEX "ActivityReset_workspaceGroupId_idx" ON "ActivityReset"("workspaceGroupId");

-- CreateIndex
CREATE INDEX "ActivityReset_resetAt_idx" ON "ActivityReset"("resetAt");

-- AddForeignKey
ALTER TABLE "ActivityHistory" ADD CONSTRAINT "ActivityHistory_userId_fkey" FOREIGN KEY ("userId") REFERENCES "user"("userid") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ActivityHistory" ADD CONSTRAINT "ActivityHistory_workspaceGroupId_fkey" FOREIGN KEY ("workspaceGroupId") REFERENCES "workspace"("groupId") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ActivityReset" ADD CONSTRAINT "ActivityReset_resetById_fkey" FOREIGN KEY ("resetById") REFERENCES "user"("userid") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ActivityReset" ADD CONSTRAINT "ActivityReset_workspaceGroupId_fkey" FOREIGN KEY ("workspaceGroupId") REFERENCES "workspace"("groupId") ON DELETE RESTRICT ON UPDATE CASCADE;