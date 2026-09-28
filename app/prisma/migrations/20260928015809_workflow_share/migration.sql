-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_Workflow" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "title" TEXT NOT NULL DEFAULT '未命名工作流',
    "userId" TEXT NOT NULL,
    "coverUrl" TEXT,
    "description" TEXT,
    "shareToken" TEXT,
    "visibility" TEXT NOT NULL DEFAULT 'private',
    "sharedAt" DATETIME,
    "forkedFrom" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "Workflow_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);
INSERT INTO "new_Workflow" ("coverUrl", "createdAt", "id", "title", "updatedAt", "userId") SELECT "coverUrl", "createdAt", "id", "title", "updatedAt", "userId" FROM "Workflow";
DROP TABLE "Workflow";
ALTER TABLE "new_Workflow" RENAME TO "Workflow";
CREATE UNIQUE INDEX "Workflow_shareToken_key" ON "Workflow"("shareToken");
CREATE INDEX "Workflow_userId_idx" ON "Workflow"("userId");
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;
