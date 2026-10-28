ALTER TABLE "User"
ADD COLUMN "authVersion" INTEGER NOT NULL DEFAULT 0;

CREATE TABLE "ExtensionSession" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "refreshTokenHash" TEXT NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "revokedAt" TIMESTAMP(3),
    "lastUsedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ExtensionSession_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "ExtensionSession_userId_fkey" FOREIGN KEY ("userId")
      REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE UNIQUE INDEX "ExtensionSession_refreshTokenHash_key"
ON "ExtensionSession"("refreshTokenHash");

CREATE INDEX "ExtensionSession_userId_revokedAt_idx"
ON "ExtensionSession"("userId", "revokedAt");

CREATE INDEX "ExtensionSession_expiresAt_idx"
ON "ExtensionSession"("expiresAt");
