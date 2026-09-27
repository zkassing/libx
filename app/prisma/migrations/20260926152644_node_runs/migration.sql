-- CreateTable
CREATE TABLE "NodeRun" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "nodeId" TEXT NOT NULL,
    "workflowId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'queued',
    "progress" INTEGER NOT NULL DEFAULT 0,
    "input" TEXT,
    "output" TEXT,
    "cost" INTEGER NOT NULL DEFAULT 0,
    "error" TEXT,
    "inputHash" TEXT,
    "startedAt" DATETIME,
    "finishedAt" DATETIME,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- CreateIndex
CREATE INDEX "NodeRun_nodeId_idx" ON "NodeRun"("nodeId");

-- CreateIndex
CREATE INDEX "NodeRun_workflowId_idx" ON "NodeRun"("workflowId");

-- CreateIndex
CREATE INDEX "NodeRun_userId_idx" ON "NodeRun"("userId");
