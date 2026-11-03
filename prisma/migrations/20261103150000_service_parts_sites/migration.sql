-- 통합 3단계(2026-11-03): 서비스 부품·출장지·출장지별 가격·부품 사용·첨부 + 출장보고서 숨김 (docs/service-migration.md)
-- CreateEnum
CREATE TYPE "SvcAttachmentKind" AS ENUM ('ORIGINAL', 'NAMEPLATE', 'BEFORE_WORK', 'AFTER_WORK', 'BEFORE_PART', 'AFTER_PART', 'RELATED');

-- AlterTable
ALTER TABLE "svc_report" ADD COLUMN     "deletedAt" TIMESTAMP(3),
ADD COLUMN     "deletedById" TEXT;

-- CreateTable
CREATE TABLE "svc_part" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "note" TEXT NOT NULL DEFAULT '',
    "deletedAt" TIMESTAMP(3),
    "deletedById" TEXT,
    "createdById" TEXT NOT NULL,
    "updatedById" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "svc_part_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "svc_site" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "region" TEXT,
    "sigungu" TEXT,
    "note" TEXT NOT NULL DEFAULT '',
    "deletedAt" TIMESTAMP(3),
    "deletedById" TEXT,
    "createdById" TEXT NOT NULL,
    "updatedById" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "svc_site_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "svc_site_part_price" (
    "id" TEXT NOT NULL,
    "siteId" TEXT NOT NULL,
    "partId" TEXT NOT NULL,
    "unitPrice" BIGINT NOT NULL,
    "note" TEXT NOT NULL DEFAULT '',
    "deletedAt" TIMESTAMP(3),
    "deletedById" TEXT,
    "updatedById" TEXT NOT NULL,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "svc_site_part_price_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "svc_report_part" (
    "id" TEXT NOT NULL,
    "reportId" TEXT NOT NULL,
    "partId" TEXT NOT NULL,
    "quantity" INTEGER,
    "position" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "svc_report_part_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "svc_report_attachment" (
    "id" TEXT NOT NULL,
    "reportId" TEXT NOT NULL,
    "kind" "SvcAttachmentKind" NOT NULL,
    "originalName" TEXT NOT NULL,
    "contentType" TEXT NOT NULL,
    "size" INTEGER NOT NULL,
    "sha256" TEXT NOT NULL,
    "content" BYTEA NOT NULL,
    "deletedAt" TIMESTAMP(3),
    "deletedById" TEXT,
    "uploadedById" TEXT NOT NULL,
    "uploadedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "svc_report_attachment_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "svc_part_name_key" ON "svc_part"("name");

-- CreateIndex
CREATE UNIQUE INDEX "svc_site_name_key" ON "svc_site"("name");

-- CreateIndex
CREATE INDEX "svc_site_part_price_partId_idx" ON "svc_site_part_price"("partId");

-- CreateIndex
CREATE UNIQUE INDEX "svc_site_part_price_siteId_partId_key" ON "svc_site_part_price"("siteId", "partId");

-- CreateIndex
CREATE INDEX "svc_report_part_partId_idx" ON "svc_report_part"("partId");

-- CreateIndex
CREATE UNIQUE INDEX "svc_report_part_reportId_partId_key" ON "svc_report_part"("reportId", "partId");

-- CreateIndex
CREATE INDEX "svc_report_attachment_reportId_idx" ON "svc_report_attachment"("reportId");

-- CreateIndex
CREATE INDEX "svc_report_attachment_sha256_idx" ON "svc_report_attachment"("sha256");

-- CreateIndex
CREATE INDEX "svc_report_deletedAt_idx" ON "svc_report"("deletedAt");

-- AddForeignKey
ALTER TABLE "svc_site_part_price" ADD CONSTRAINT "svc_site_part_price_siteId_fkey" FOREIGN KEY ("siteId") REFERENCES "svc_site"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "svc_site_part_price" ADD CONSTRAINT "svc_site_part_price_partId_fkey" FOREIGN KEY ("partId") REFERENCES "svc_part"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "svc_report_part" ADD CONSTRAINT "svc_report_part_reportId_fkey" FOREIGN KEY ("reportId") REFERENCES "svc_report"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "svc_report_part" ADD CONSTRAINT "svc_report_part_partId_fkey" FOREIGN KEY ("partId") REFERENCES "svc_part"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "svc_report_attachment" ADD CONSTRAINT "svc_report_attachment_reportId_fkey" FOREIGN KEY ("reportId") REFERENCES "svc_report"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

