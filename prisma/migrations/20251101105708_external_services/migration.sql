-- AlterTable
ALTER TABLE "userBook" ADD COLUMN     "rankAfter" INTEGER,
ADD COLUMN     "rankBefore" INTEGER,
ADD COLUMN     "rankNameAfter" TEXT,
ADD COLUMN     "rankNameBefore" TEXT;

-- CreateTable
CREATE TABLE "workspaceExternalServices" (
    "id" SERIAL NOT NULL,
    "workspaceGroupId" INTEGER NOT NULL,
    "rankingProvider" TEXT,
    "rankingToken" TEXT,
    "rankingWorkspaceId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "workspaceExternalServices_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "workspaceExternalServices_workspaceGroupId_key" ON "workspaceExternalServices"("workspaceGroupId");

-- CreateIndex
CREATE INDEX "workspaceExternalServices_workspaceGroupId_idx" ON "workspaceExternalServices"("workspaceGroupId");

-- AddForeignKey
ALTER TABLE "workspaceExternalServices" ADD CONSTRAINT "workspaceExternalServices_workspaceGroupId_fkey" FOREIGN KEY ("workspaceGroupId") REFERENCES "workspace"("groupId") ON DELETE RESTRICT ON UPDATE CASCADE;
