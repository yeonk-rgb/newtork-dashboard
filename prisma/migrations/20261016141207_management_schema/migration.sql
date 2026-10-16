-- CreateSchema
CREATE SCHEMA IF NOT EXISTS "public";

-- CreateEnum
CREATE TYPE "MgmtEntryStatus" AS ENUM ('DRAFT', 'CONFIRMED');

-- CreateEnum
CREATE TYPE "MgmtCostType" AS ENUM ('FIXED', 'VARIABLE');

-- CreateTable
CREATE TABLE "mgmt_annual_target" (
    "id" TEXT NOT NULL,
    "year" INTEGER NOT NULL,
    "revenueTarget" BIGINT NOT NULL,
    "q1Target" BIGINT,
    "q2Target" BIGINT,
    "q3Target" BIGINT,
    "q4Target" BIGINT,
    "createdById" TEXT NOT NULL,
    "updatedById" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "mgmt_annual_target_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "mgmt_monthly_finance" (
    "id" TEXT NOT NULL,
    "year" INTEGER NOT NULL,
    "month" INTEGER NOT NULL,
    "productSales" BIGINT NOT NULL DEFAULT 0,
    "goodsSales" BIGINT NOT NULL DEFAULT 0,
    "serviceSales" BIGINT NOT NULL DEFAULT 0,
    "goodsPurchase" BIGINT NOT NULL DEFAULT 0,
    "materialPurchase" BIGINT NOT NULL DEFAULT 0,
    "operatingExpense" BIGINT NOT NULL DEFAULT 0,
    "status" "MgmtEntryStatus" NOT NULL DEFAULT 'DRAFT',
    "confirmedAt" TIMESTAMP(3),
    "createdById" TEXT NOT NULL,
    "updatedById" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "mgmt_monthly_finance_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "mgmt_expense_category" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "costType" "MgmtCostType",
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "mgmt_expense_category_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "mgmt_other_expense" (
    "id" TEXT NOT NULL,
    "monthlyFinanceId" TEXT NOT NULL,
    "categoryId" TEXT NOT NULL,
    "amount" BIGINT NOT NULL,

    CONSTRAINT "mgmt_other_expense_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "mgmt_receivable" (
    "id" TEXT NOT NULL,
    "customerName" TEXT NOT NULL,
    "occurredOn" DATE NOT NULL,
    "amount" BIGINT NOT NULL,
    "isCollected" BOOLEAN NOT NULL DEFAULT false,
    "collectedOn" DATE,
    "dueOn" DATE,
    "note" TEXT,
    "createdById" TEXT NOT NULL,
    "updatedById" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "mgmt_receivable_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "mgmt_annual_target_year_key" ON "mgmt_annual_target"("year");

-- CreateIndex
CREATE UNIQUE INDEX "mgmt_monthly_finance_year_month_key" ON "mgmt_monthly_finance"("year", "month");

-- CreateIndex
CREATE UNIQUE INDEX "mgmt_expense_category_name_key" ON "mgmt_expense_category"("name");

-- CreateIndex
CREATE INDEX "mgmt_other_expense_categoryId_idx" ON "mgmt_other_expense"("categoryId");

-- CreateIndex
CREATE UNIQUE INDEX "mgmt_other_expense_monthlyFinanceId_categoryId_key" ON "mgmt_other_expense"("monthlyFinanceId", "categoryId");

-- CreateIndex
CREATE INDEX "mgmt_receivable_isCollected_occurredOn_idx" ON "mgmt_receivable"("isCollected", "occurredOn");

-- AddForeignKey
ALTER TABLE "mgmt_other_expense" ADD CONSTRAINT "mgmt_other_expense_monthlyFinanceId_fkey" FOREIGN KEY ("monthlyFinanceId") REFERENCES "mgmt_monthly_finance"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "mgmt_other_expense" ADD CONSTRAINT "mgmt_other_expense_categoryId_fkey" FOREIGN KEY ("categoryId") REFERENCES "mgmt_expense_category"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

