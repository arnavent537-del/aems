-- CreateTable
CREATE TABLE "UserClient" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "userId" TEXT NOT NULL,
    "clientId" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "UserClient_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "UserClient_clientId_fkey" FOREIGN KEY ("clientId") REFERENCES "Client" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_Employee" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "employeeCode" TEXT NOT NULL,
    "clientId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "dob" TEXT NOT NULL,
    "address" TEXT NOT NULL,
    "documentStatus" TEXT NOT NULL,
    "safetyApronIssued" BOOLEAN NOT NULL DEFAULT false,
    "punchingNo" TEXT,
    "dateOfJoining" TEXT NOT NULL,
    "dateOfExit" TEXT,
    "status" TEXT NOT NULL DEFAULT 'Active',
    "bankName" TEXT,
    "bankAccountNo" TEXT,
    "ifscCode" TEXT,
    "pfNo" TEXT,
    "esicNo" TEXT,
    "uanNo" TEXT,
    "phoneNo" TEXT,
    "salaryRate" REAL NOT NULL,
    "otRateMultiplier" REAL NOT NULL DEFAULT 2.0,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "Employee_clientId_fkey" FOREIGN KEY ("clientId") REFERENCES "Client" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);
INSERT INTO "new_Employee" ("address", "bankAccountNo", "bankName", "clientId", "createdAt", "dateOfExit", "dateOfJoining", "dob", "documentStatus", "employeeCode", "esicNo", "id", "ifscCode", "name", "otRateMultiplier", "pfNo", "phoneNo", "punchingNo", "safetyApronIssued", "salaryRate", "uanNo", "updatedAt") SELECT "address", "bankAccountNo", "bankName", "clientId", "createdAt", "dateOfExit", "dateOfJoining", "dob", "documentStatus", "employeeCode", "esicNo", "id", "ifscCode", "name", "otRateMultiplier", "pfNo", "phoneNo", "punchingNo", "safetyApronIssued", "salaryRate", "uanNo", "updatedAt" FROM "Employee";
DROP TABLE "Employee";
ALTER TABLE "new_Employee" RENAME TO "Employee";
CREATE UNIQUE INDEX "Employee_employeeCode_key" ON "Employee"("employeeCode");
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;

-- CreateIndex
CREATE UNIQUE INDEX "UserClient_userId_clientId_key" ON "UserClient"("userId", "clientId");
