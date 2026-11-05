// 단가 변경 이력에 남길 칸 (허용 목록 — 화면 표기 그대로). 화면 = service-unit-prices / 업로드 = service-unit-price-upload
import { won, type AuditField } from "@/shared/audit/diff";

export type ItemAudit = {
  partNo: string;
  category: string;
  name: string;
  appliesTo: string;
  basePrice: bigint | number | null;
};

export const ITEM_AUDIT_FIELDS: AuditField<ItemAudit>[] = [
  { key: "category", label: "분류" },
  { key: "partNo", label: "파트넘버" },
  { key: "name", label: "품목" },
  { key: "appliesTo", label: "적용 모델" },
  { key: "basePrice", label: "뉴토크 기준값", format: won },
];

export const BASE_PRICE_FIELD = ITEM_AUDIT_FIELDS[4];
