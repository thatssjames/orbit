-- AlterTable
ALTER TABLE "userBook" ADD COLUMN     "redacted" BOOLEAN DEFAULT false,
ADD COLUMN     "redactedAt" TIMESTAMP(3),
ADD COLUMN     "redactedBy" BIGINT;
