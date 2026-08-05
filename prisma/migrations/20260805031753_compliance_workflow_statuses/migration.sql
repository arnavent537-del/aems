/*
  Warnings:

  - You are about to drop the column `esicFilingStatus` on the `Compliance` table. All the data in the column will be lost.
  - You are about to drop the column `napsComplianceStatus` on the `Compliance` table. All the data in the column will be lost.
  - You are about to drop the column `pfFilingStatus` on the `Compliance` table. All the data in the column will be lost.

*/
-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_Compliance" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "month" TEXT NOT NULL,
    "clientId" TEXT NOT NULL,
    "finalAttendanceStatus" TEXT NOT NULL DEFAULT 'Pending',
    "finalBillStatus" TEXT NOT NULL DEFAULT 'Pending',
    "advancesStatus" TEXT NOT NULL DEFAULT 'Pending',
    "salaryExcelSheetStatus" TEXT NOT NULL DEFAULT 'Pending',
    "salaryUploadToPortalStatus" TEXT NOT NULL DEFAULT 'Pending',
    "salaryDisburseStatus" TEXT NOT NULL DEFAULT 'Pending',
    "pfChallanEcrUploadStatus" TEXT NOT NULL DEFAULT 'Pending',
    "esicChallanEcrUploadStatus" TEXT NOT NULL DEFAULT 'Pending',
    "ptChallanUploadStatus" TEXT NOT NULL DEFAULT 'Pending',
    "gstChallanUploadStatus" TEXT NOT NULL DEFAULT 'Pending',
    "pfChallanPaidStatus" TEXT NOT NULL DEFAULT 'Unpaid',
    "esicChallanPaidStatus" TEXT NOT NULL DEFAULT 'Unpaid',
    "ptPaidStatus" TEXT NOT NULL DEFAULT 'Unpaid',
    "gstPaidStatus" TEXT NOT NULL DEFAULT 'Unpaid',
    "pfChallanUrl" TEXT,
    "esicChallanUrl" TEXT,
    "showCauseNoticesCount" INTEGER NOT NULL DEFAULT 0,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "Compliance_clientId_fkey" FOREIGN KEY ("clientId") REFERENCES "Client" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);
INSERT INTO "new_Compliance" ("clientId", "createdAt", "esicChallanUrl", "id", "month", "pfChallanUrl", "showCauseNoticesCount", "updatedAt") SELECT "clientId", "createdAt", "esicChallanUrl", "id", "month", "pfChallanUrl", "showCauseNoticesCount", "updatedAt" FROM "Compliance";
DROP TABLE "Compliance";
ALTER TABLE "new_Compliance" RENAME TO "Compliance";
CREATE UNIQUE INDEX "Compliance_clientId_month_key" ON "Compliance"("clientId", "month");
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;
