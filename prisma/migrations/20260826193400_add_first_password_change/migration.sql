CREATE TYPE "ChallengePurpose" AS ENUM ('PASSWORD_RESET', 'FIRST_PASSWORD_CHANGE');

ALTER TABLE "PasswordResetChallenge"
ADD COLUMN "purpose" "ChallengePurpose" NOT NULL DEFAULT 'PASSWORD_RESET';

ALTER TABLE "User"
ADD COLUMN "mustChangePassword" BOOLEAN NOT NULL DEFAULT false;

ALTER TABLE "User"
ADD COLUMN "temporaryPasswordExpiresAt" TIMESTAMP(3);
