-- CreateEnum
CREATE TYPE "InvitationStatus" AS ENUM ('PENDING', 'ACCEPTED', 'EXPIRED', 'REVOKED');

-- AlterEnum AuditAction
ALTER TYPE "AuditAction" ADD VALUE 'MEMBER_INVITATION_ACCEPTED';
ALTER TYPE "AuditAction" ADD VALUE 'MEMBER_INVITATION_REVOKED';

-- Migrate Invitation table to secure token storage
CREATE EXTENSION IF NOT EXISTS pgcrypto;

ALTER TABLE "Invitation" ADD COLUMN "tokenHash" TEXT;
ALTER TABLE "Invitation" ADD COLUMN "acceptedAt" TIMESTAMP(3);
ALTER TABLE "Invitation" ADD COLUMN "status_new" "InvitationStatus";

UPDATE "Invitation"
SET "tokenHash" = encode(digest("token", 'sha256'), 'hex'),
    "status_new" = CASE
      WHEN "status"::text = 'ACTIVE' THEN 'ACCEPTED'::"InvitationStatus"
      ELSE 'PENDING'::"InvitationStatus"
    END;

DELETE FROM "Invitation" WHERE "tokenHash" IS NULL;

ALTER TABLE "Invitation" ALTER COLUMN "tokenHash" SET NOT NULL;
ALTER TABLE "Invitation" ALTER COLUMN "status_new" SET NOT NULL;
ALTER TABLE "Invitation" ALTER COLUMN "status_new" SET DEFAULT 'PENDING';

DROP INDEX IF EXISTS "Invitation_token_key";
ALTER TABLE "Invitation" DROP COLUMN "token";
ALTER TABLE "Invitation" DROP COLUMN "status";
ALTER TABLE "Invitation" RENAME COLUMN "status_new" TO "status";

CREATE UNIQUE INDEX "Invitation_tokenHash_key" ON "Invitation"("tokenHash");
CREATE INDEX "Invitation_email_idx" ON "Invitation"("email");
CREATE INDEX "Invitation_status_idx" ON "Invitation"("status");
CREATE INDEX "Invitation_expiresAt_idx" ON "Invitation"("expiresAt");
