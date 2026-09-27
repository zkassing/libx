-- CreateTable
CREATE TABLE "AssetFolder" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "workflowId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "parentId" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "AssetFolder_workflowId_fkey" FOREIGN KEY ("workflowId") REFERENCES "Workflow" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "AssetFolder_parentId_fkey" FOREIGN KEY ("parentId") REFERENCES "AssetFolder" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

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
    CONSTRAINT "Asset_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "Asset_folderId_fkey" FOREIGN KEY ("folderId") REFERENCES "AssetFolder" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);
INSERT INTO "new_Asset" ("createdAt", "folderId", "id", "kind", "mimeType", "nodeId", "rating", "runId", "size", "source", "text", "title", "url", "userId", "workflowId") SELECT "createdAt", "folderId", "id", "kind", "mimeType", "nodeId", "rating", "runId", "size", "source", "text", "title", "url", "userId", "workflowId" FROM "Asset";
DROP TABLE "Asset";
ALTER TABLE "new_Asset" RENAME TO "Asset";
CREATE INDEX "Asset_userId_source_idx" ON "Asset"("userId", "source");
CREATE INDEX "Asset_workflowId_idx" ON "Asset"("workflowId");
CREATE INDEX "Asset_kind_idx" ON "Asset"("kind");
CREATE INDEX "Asset_nodeId_idx" ON "Asset"("nodeId");
CREATE INDEX "Asset_folderId_idx" ON "Asset"("folderId");
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;

-- CreateIndex
CREATE INDEX "AssetFolder_workflowId_idx" ON "AssetFolder"("workflowId");

-- CreateIndex
CREATE INDEX "AssetFolder_parentId_idx" ON "AssetFolder"("parentId");
