-- AlterTable
ALTER TABLE "document" ADD COLUMN     "acknowledgmentDeadline" TIMESTAMP(3),
ADD COLUMN     "acknowledgmentMethod" TEXT DEFAULT 'signature',
ADD COLUMN     "acknowledgmentWord" TEXT,
ADD COLUMN     "assignToEveryone" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "isTrainingDocument" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "requiresAcknowledgment" BOOLEAN NOT NULL DEFAULT false;

-- CreateTable
CREATE TABLE "PolicyAcknowledgment" (
    "id" UUID NOT NULL,
    "userId" BIGINT NOT NULL,
    "documentId" UUID NOT NULL,
    "acknowledgedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "ipAddress" TEXT,
    "signature" TEXT,
    "isRequired" BOOLEAN NOT NULL DEFAULT false,

    CONSTRAINT "PolicyAcknowledgment_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PolicyShareableLink" (
    "id" UUID NOT NULL,
    "documentId" UUID NOT NULL,
    "workspaceGroupId" INTEGER NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "createdById" BIGINT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "expiresAt" TIMESTAMP(3),
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "accessCount" INTEGER NOT NULL DEFAULT 0,
    "lastAccessed" TIMESTAMP(3),

    CONSTRAINT "PolicyShareableLink_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "PolicyAcknowledgment_userId_idx" ON "PolicyAcknowledgment"("userId");

-- CreateIndex
CREATE INDEX "PolicyAcknowledgment_documentId_idx" ON "PolicyAcknowledgment"("documentId");

-- CreateIndex
CREATE UNIQUE INDEX "PolicyAcknowledgment_userId_documentId_key" ON "PolicyAcknowledgment"("userId", "documentId");

-- CreateIndex
CREATE INDEX "PolicyShareableLink_documentId_idx" ON "PolicyShareableLink"("documentId");

-- CreateIndex
CREATE INDEX "PolicyShareableLink_workspaceGroupId_idx" ON "PolicyShareableLink"("workspaceGroupId");

-- CreateIndex
CREATE INDEX "PolicyShareableLink_createdById_idx" ON "PolicyShareableLink"("createdById");

-- AddForeignKey
ALTER TABLE "PolicyAcknowledgment" ADD CONSTRAINT "PolicyAcknowledgment_userId_fkey" FOREIGN KEY ("userId") REFERENCES "user"("userid") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PolicyAcknowledgment" ADD CONSTRAINT "PolicyAcknowledgment_documentId_fkey" FOREIGN KEY ("documentId") REFERENCES "document"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PolicyShareableLink" ADD CONSTRAINT "PolicyShareableLink_documentId_fkey" FOREIGN KEY ("documentId") REFERENCES "document"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PolicyShareableLink" ADD CONSTRAINT "PolicyShareableLink_workspaceGroupId_fkey" FOREIGN KEY ("workspaceGroupId") REFERENCES "workspace"("groupId") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PolicyShareableLink" ADD CONSTRAINT "PolicyShareableLink_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "user"("userid") ON DELETE RESTRICT ON UPDATE CASCADE;
