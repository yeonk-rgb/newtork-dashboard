// 입력 안내(ⓘ) 문구 — 2026-10-26 자료 기반 결정 기준 (docs/05-open-questions.md 1·2·3·13·18번)
import type { EntryField } from "./schemas";

const SALES_BASIS =
  "공급가액(부가세 제외), 세금계산서 발행 기준으로 입력합니다.";
const COST_BASIS =
  "공급가액(부가세 제외)으로 입력합니다. 매입액은 그달의 원가로 계산합니다.";

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
    "임차료·공과금·직원 경비 등 일반 경비. 채권·채무 관리의 미지급비용-직원 총액과 같은 숫자로 보고, '그 외 지출' 항목과 겹치지 않게 입력합니다. 공급가액(부가세 제외).",
};

export const OTHER_EXPENSE_HELP =
  "광고선전비·접대비 등 따로 관리하는 지출. 항목 추가·변경은 '목표·항목 설정'(팀장)에서 합니다.";
