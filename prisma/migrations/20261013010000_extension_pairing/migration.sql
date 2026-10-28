ALTER TABLE "ExtensionSession" ADD COLUMN "authVersion" INTEGER NOT NULL DEFAULT 0;

CREATE TABLE "ExtensionPairing" (
  "id" TEXT NOT NULL,
  "extensionId" TEXT NOT NULL,
  "challenge" TEXT NOT NULL,
  "userId" TEXT,
  "approvedAuthVersion" INTEGER,
  "approvedAt" TIMESTAMP(3),
  "expiresAt" TIMESTAMP(3) NOT NULL,
  "consumedAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "ExtensionPairing_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "ExtensionPairing_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE
);
CREATE INDEX "ExtensionPairing_expiresAt_idx" ON "ExtensionPairing"("expiresAt");
CREATE INDEX "ExtensionPairing_userId_consumedAt_idx" ON "ExtensionPairing"("userId", "consumedAt");
