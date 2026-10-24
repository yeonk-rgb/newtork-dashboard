-- CreateEnum
CREATE TYPE "MgmtLedgerKind" AS ENUM ('AR', 'AP', 'ACCRUED_STAFF', 'ACCRUED_VENDOR');

-- CreateEnum
CREATE TYPE "MgmtArStatus" AS ENUM ('LONG_OVERDUE', 'COLLECTED', 'SCHEDULED');

-- CreateEnum
CREATE TYPE "MgmtPurchaseType" AS ENUM ('GOODS', 'RAW_MATERIAL');

-- CreateEnum
CREATE TYPE "MgmtVendorExpenseType" AS ENUM ('ADVERTISING', 'ENTERTAINMENT', 'OTHER');

-- CreateTable
CREATE TABLE "mgmt_ledger_entry" (
    "id" TEXT NOT NULL,
    "year" INTEGER NOT NULL,
    "month" INTEGER NOT NULL,
    "kind" "MgmtLedgerKind" NOT NULL,
    "arStatus" "MgmtArStatus",
    "purchaseType" "MgmtPurchaseType",
    "expenseType" "MgmtVendorExpenseType",
    "autoTransfer" BOOLEAN NOT NULL DEFAULT false,
    "partnerCode" TEXT,
    "partnerName" TEXT NOT NULL,
    "amount" BIGINT NOT NULL,
    "note" TEXT,
    "dueOn" DATE,
    "settledOn" DATE,
    "deletedAt" TIMESTAMP(3),
    "deletedById" TEXT,
    "createdById" TEXT NOT NULL,
    "updatedById" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "mgmt_ledger_entry_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "mgmt_ledger_entry_year_month_kind_idx" ON "mgmt_ledger_entry"("year", "month", "kind");

-- CreateIndex
CREATE INDEX "mgmt_ledger_entry_deletedAt_idx" ON "mgmt_ledger_entry"("deletedAt");
