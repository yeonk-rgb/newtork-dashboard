// 입력 안내(ⓘ) 문구 — 고객사 미확정 사항은 "고객사 확인 중"으로 표시 (docs/05-open-questions.md)
import type { EntryField } from "./schemas";

const SALES_BASIS =
  "VAT 포함 여부(05-1번)와 세금계산서 발행 기준/입금 기준(05-18번)은 고객사 확인 중입니다.";
const COST_BASIS = "매입액을 매출원가로 볼지(05-3번)는 고객사 확인 중입니다.";

export const FIELD_LABEL: Record<EntryField, string> = {
  productSales: "제품 매출",
  goodsSales: "상품 매출",
  serviceSales: "용역 매출",
  goodsPurchase: "상품 매입",
  materialPurchase: "원재료 매입",
  operatingExpense: "경비 지출",
};

export const FIELD_HELP: Record<EntryField, string> = {
  productSales: `자사가 생산한 제품(전동밸브조작기 등)을 판매한 금액. ${SALES_BASIS}`,
  goodsSales: `외부에서 사들여 그대로 판매한 상품의 금액. ${SALES_BASIS}`,
  serviceSales: `설치·수리·현장 서비스 등 용역으로 받은 금액. ${SALES_BASIS}`,
  goodsPurchase: `되팔기 위해 사들인 상품의 매입 금액. ${COST_BASIS}`,
  materialPurchase: `제품 생산에 쓰는 원재료 매입 금액. ${COST_BASIS}`,
  operatingExpense:
    "임차료·공과금 등 일반 경비. 인건비 포함 여부와 '그 외 지출' 항목과 겹치지 않는지(05-13번)는 고객사 확인 중입니다.",
};

export const OTHER_EXPENSE_HELP =
  "광고선전비·접대비 등 따로 관리하는 지출. 항목 추가·변경은 '목표·항목 설정'(팀장)에서 합니다.";
