-- AlterTable
ALTER TABLE "svc_price_quote" ADD COLUMN     "project" TEXT NOT NULL DEFAULT '',
ADD COLUMN     "quoteNo" TEXT NOT NULL DEFAULT '',
ADD COLUMN     "source" TEXT NOT NULL DEFAULT 'table';

