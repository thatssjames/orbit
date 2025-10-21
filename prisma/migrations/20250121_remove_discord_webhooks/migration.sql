-- Migration to remove Discord webhook features
-- Remove webhook fields from SessionType
ALTER TABLE "SessionType" DROP COLUMN "webhookBody";
ALTER TABLE "SessionType" DROP COLUMN "webhookEnabled";
ALTER TABLE "SessionType" DROP COLUMN "webhookTitle";
ALTER TABLE "SessionType" DROP COLUMN "webhookUrl";
ALTER TABLE "SessionType" DROP COLUMN "webhookPing";

-- Remove messageId from Session
ALTER TABLE "Session" DROP COLUMN "messageId";