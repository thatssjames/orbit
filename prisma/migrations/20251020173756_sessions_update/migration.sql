-- AlterTable
ALTER TABLE "Session" ADD COLUMN     "name" TEXT,
ADD COLUMN     "type" TEXT;

-- AlterTable
ALTER TABLE "SessionType" ADD COLUMN     "description" TEXT;

-- CreateTable
CREATE TABLE "SessionNote" (
    "id" UUID NOT NULL,
    "sessionId" UUID NOT NULL,
    "authorId" BIGINT NOT NULL,
    "content" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "SessionNote_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SessionLog" (
    "id" UUID NOT NULL,
    "sessionId" UUID NOT NULL,
    "actorId" BIGINT NOT NULL,
    "targetId" BIGINT,
    "action" TEXT NOT NULL,
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "SessionLog_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "SessionNote_id_key" ON "SessionNote"("id");

-- CreateIndex
CREATE UNIQUE INDEX "SessionLog_id_key" ON "SessionLog"("id");

-- AddForeignKey
ALTER TABLE "SessionNote" ADD CONSTRAINT "SessionNote_sessionId_fkey" FOREIGN KEY ("sessionId") REFERENCES "Session"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SessionNote" ADD CONSTRAINT "SessionNote_authorId_fkey" FOREIGN KEY ("authorId") REFERENCES "user"("userid") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SessionLog" ADD CONSTRAINT "SessionLog_sessionId_fkey" FOREIGN KEY ("sessionId") REFERENCES "Session"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SessionLog" ADD CONSTRAINT "SessionLog_actorId_fkey" FOREIGN KEY ("actorId") REFERENCES "user"("userid") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SessionLog" ADD CONSTRAINT "SessionLog_targetId_fkey" FOREIGN KEY ("targetId") REFERENCES "user"("userid") ON DELETE SET NULL ON UPDATE CASCADE;
