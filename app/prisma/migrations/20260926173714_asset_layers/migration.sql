/*
  Warnings:

  - You are about to drop the column `sourceNodeId` on the `Asset` table. All the data in the column will be lost.

*/
-- AlterTable
ALTER TABLE "Workflow" ADD COLUMN "coverUrl" TEXT;

-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_Asset" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "userId" TEXT NOT NULL,
    "source" TEXT NOT NULL DEFAULT 'generated',
    "kind" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "url" TEXT,
    "text" TEXT,
    "mimeType" TEXT,
    "size" INTEGER,
    "workflowId" TEXT,
    "nodeId" TEXT,
    "runId" TEXT,
    "rating" INTEGER,
    "folderId" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "Asset_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);
INSERT INTO "new_Asset" ("createdAt", "id", "kind", "text", "title", "url", "userId") SELECT "createdAt", "id", "kind", "text", "title", "url", "userId" FROM "Asset";
DROP TABLE "Asset";
ALTER TABLE "new_Asset" RENAME TO "Asset";
CREATE INDEX "Asset_userId_source_idx" ON "Asset"("userId", "source");
CREATE INDEX "Asset_workflowId_idx" ON "Asset"("workflowId");
CREATE INDEX "Asset_kind_idx" ON "Asset"("kind");
CREATE INDEX "Asset_nodeId_idx" ON "Asset"("nodeId");
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;
