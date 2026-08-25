-- CreateTable
CREATE TABLE "RateLimitWindow" (
    "ipHash" TEXT NOT NULL,
    "windowStart" TIMESTAMP(3) NOT NULL,
    "count" INTEGER NOT NULL DEFAULT 1,
    "expiresAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "RateLimitWindow_pkey" PRIMARY KEY ("ipHash","windowStart")
);

-- CreateIndex
CREATE INDEX "RateLimitWindow_expiresAt_idx" ON "RateLimitWindow"("expiresAt");
