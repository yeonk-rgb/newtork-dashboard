-- CreateTable
CREATE TABLE "svc_price_item" (
    "id" TEXT NOT NULL,
    "partNo" TEXT NOT NULL,
    "partKey" TEXT NOT NULL,
    "itemKey" TEXT NOT NULL,
    "category" TEXT NOT NULL DEFAULT '',
    "name" TEXT NOT NULL,
    "appliesTo" TEXT NOT NULL DEFAULT '',
    "basePrice" BIGINT,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "deletedAt" TIMESTAMP(3),
    "deletedById" TEXT,
    "createdById" TEXT NOT NULL,
    "updatedById" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "svc_price_item_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "svc_price_quote" (
    "id" TEXT NOT NULL,
    "itemId" TEXT NOT NULL,
    "company" TEXT NOT NULL,
    "unitPrice" BIGINT NOT NULL,
    "effectiveDate" DATE NOT NULL,
    "note" TEXT NOT NULL DEFAULT '',
    "deletedAt" TIMESTAMP(3),
    "deletedById" TEXT,
    "createdById" TEXT NOT NULL,
    "updatedById" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "svc_price_quote_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "svc_price_item_itemKey_key" ON "svc_price_item"("itemKey");

-- CreateIndex
CREATE INDEX "svc_price_item_partKey_idx" ON "svc_price_item"("partKey");

-- CreateIndex
CREATE INDEX "svc_price_item_category_idx" ON "svc_price_item"("category");

-- CreateIndex
CREATE UNIQUE INDEX "svc_price_quote_itemId_company_effectiveDate_key" ON "svc_price_quote"("itemId", "company", "effectiveDate");

-- AddForeignKey
ALTER TABLE "svc_price_quote" ADD CONSTRAINT "svc_price_quote_itemId_fkey" FOREIGN KEY ("itemId") REFERENCES "svc_price_item"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

