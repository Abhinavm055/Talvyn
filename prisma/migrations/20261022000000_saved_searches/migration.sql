-- Additive only: existing users, jobs, notes and credentials are unchanged.
CREATE TABLE "SavedSearch" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "name" VARCHAR(80) NOT NULL,
    "nameKey" VARCHAR(160) NOT NULL,
    "filters" JSONB NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "SavedSearch_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "SavedSearch_name_bounds" CHECK (char_length("name") BETWEEN 1 AND 80 AND char_length("nameKey") BETWEEN 1 AND 160),
    CONSTRAINT "SavedSearch_filters_version" CHECK ((jsonb_typeof("filters") = 'object' AND "filters" -> 'version' = '1'::jsonb) IS TRUE)
);

CREATE UNIQUE INDEX "SavedSearch_userId_nameKey_key" ON "SavedSearch"("userId", "nameKey");
CREATE INDEX "SavedSearch_userId_updatedAt_idx" ON "SavedSearch"("userId", "updatedAt");
ALTER TABLE "SavedSearch" ADD CONSTRAINT "SavedSearch_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
