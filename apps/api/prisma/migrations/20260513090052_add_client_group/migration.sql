-- AlterTable
ALTER TABLE "Client" ADD COLUMN     "groupId" TEXT;

-- CreateTable
CREATE TABLE "ClientGroup" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ClientGroup_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "ClientGroup_name_idx" ON "ClientGroup"("name");

-- CreateIndex
CREATE INDEX "Client_groupId_idx" ON "Client"("groupId");

-- AddForeignKey
ALTER TABLE "Client" ADD CONSTRAINT "Client_groupId_fkey" FOREIGN KEY ("groupId") REFERENCES "ClientGroup"("id") ON DELETE SET NULL ON UPDATE CASCADE;
