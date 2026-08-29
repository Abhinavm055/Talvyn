-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_UserProfile" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "userId" TEXT NOT NULL,
    "legalFullName" TEXT,
    "givenName" TEXT,
    "middleName" TEXT,
    "familyName" TEXT,
    "prefix" TEXT,
    "preferredName" TEXT,
    "email" TEXT,
    "phone" TEXT,
    "country" TEXT,
    "state" TEXT,
    "city" TEXT,
    "address" TEXT,
    "postalCode" TEXT,
    "preferredRoles" TEXT NOT NULL DEFAULT '[]',
    "skills" TEXT NOT NULL DEFAULT '[]',
    "experienceYears" INTEGER,
    "linkedinUrl" TEXT,
    "portfolioUrl" TEXT,
    "otherLinks" TEXT NOT NULL DEFAULT '[]',
    "institution" TEXT,
    "degree" TEXT,
    "specialization" TEXT,
    "cgpa" TEXT,
    "graduationYear" INTEGER,
    "workAuthorization" TEXT,
    "expectedSalary" TEXT,
    "noticePeriod" TEXT,
    "preferredLocations" TEXT NOT NULL DEFAULT '[]',
    "preferredJobTypes" TEXT NOT NULL DEFAULT '[]',
    "workStyle" TEXT NOT NULL DEFAULT 'ANY',
    "onboardingCompleted" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "UserProfile_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);
INSERT INTO "new_UserProfile" ("address", "cgpa", "city", "country", "createdAt", "degree", "email", "expectedSalary", "experienceYears", "familyName", "givenName", "graduationYear", "id", "institution", "legalFullName", "linkedinUrl", "middleName", "noticePeriod", "onboardingCompleted", "otherLinks", "phone", "portfolioUrl", "postalCode", "preferredLocations", "preferredName", "preferredRoles", "prefix", "skills", "specialization", "state", "updatedAt", "userId", "workAuthorization", "workStyle") SELECT "address", "cgpa", "city", "country", "createdAt", "degree", "email", "expectedSalary", "experienceYears", "familyName", "givenName", "graduationYear", "id", "institution", "legalFullName", "linkedinUrl", "middleName", "noticePeriod", "onboardingCompleted", "otherLinks", "phone", "portfolioUrl", "postalCode", "preferredLocations", "preferredName", "preferredRoles", "prefix", "skills", "specialization", "state", "updatedAt", "userId", "workAuthorization", "workStyle" FROM "UserProfile";
DROP TABLE "UserProfile";
ALTER TABLE "new_UserProfile" RENAME TO "UserProfile";
CREATE UNIQUE INDEX "UserProfile_userId_key" ON "UserProfile"("userId");
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;
