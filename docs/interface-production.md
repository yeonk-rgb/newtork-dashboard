# 생산팀 → 경영지원팀 데이터 인터페이스 (초안)

> 상태: **초안 — 생산팀 담당자와 합의 전**
> 작성: 경영지원팀 / 관련 요구사항: `docs/02-team-requirements.md` 메인 화면 원형 그래프

## 1. 목적

메인 화면(경영지원팀) 원형 그래프 중 아래 두 개는 생산팀 데이터로 그린다.

| 그래프 | 필요한 데이터 |
|---|---|
| 판매처 산업분야별 비중 | 기간 내 산업분야별 판매 합계 |
| 제품 시리즈별 비중 | 기간 내 제품 시리즈별 판매 합계 |

경영지원팀은 생산팀 테이블을 직접 조회하지 않고, `src/modules/production/index.ts`가 export한 함수만 호출한다. (CLAUDE.md 운영 규칙)

## 2. 요청하는 함수

```ts
// src/modules/production/index.ts 에서 export (서버 전용)
export async function getSalesShareByIndustry(period: Period): Promise<SalesShareResult>;
export async function getSalesShareBySeries(period: Period): Promise<SalesShareResult>;
```

### 공통 타입 (경영지원팀이 작성)

- `Period`: `src/shared/period/period.ts` (기간 계산 유틸 포함 — `periodMonths`, `previousPeriod` 등)
- `SalesShareItem`, `SalesShareResult`, 산업분야 코드 `INDUSTRIES`: `src/shared/contracts/production.ts`

```ts
/** 조회 기간. 월 / 분기 / 연간 / 연초 누적(YTD) */
export type Period =
  | { unit: "month"; year: number; month: number }      // month: 1~12
  | { unit: "quarter"; year: number; quarter: 1 | 2 | 3 | 4 }
  | { unit: "year"; year: number }
  | { unit: "ytd"; year: number; month: number };       // 1월 ~ month 누적

/** 원형 그래프 한 조각 */
export type SalesShareItem = {
  key: string;        // 분류 코드 (예: "WATER", 시리즈 코드)
  label: string;      // 화면 표시명 (예: "상하수도")
  amount: bigint;     // 판매 금액 합계 (원, 정수)
  quantity: number;   // 판매 수량 합계 (대)
};

export type SalesShareResult = {
  items: SalesShareItem[];
  source: "mock" | "production";  // 생산팀 실제 구현은 "production"
};
```

> 변경 이력: 2026-10-16 — 반환 타입을 `SalesShareItem[]` → `SalesShareResult`(목업 여부 표시)로, `Period`에 `ytd` 추가.
> 경영지원팀 목업: `src/modules/management/external/production-mock.ts` (같은 이름·타입, 통합 시 생산팀 함수로 교체)

## 3. 반환 규칙

| 항목 | 규칙 |
|---|---|
| 집계 대상 | 생산팀이 **확정**한 데이터만 (임시저장 제외) |
| 기간 기준 | 판매 기준일(출고일 또는 수주일 — 생산팀 확인 필요)이 `period` 안에 있는 건 |
| 데이터 없음 | 빈 배열 `[]` 반환 (에러 아님) |
| 0인 분류 | 결과에서 제외해도 됨 (그래프에서 0 조각은 표시하지 않음) |
| 정렬 | 금액 내림차순 |
| 금액 | `bigint`, 원 단위 정수. 소수·비율 계산은 경영지원팀이 표시 단계에서 함 |
| 금액·수량 둘 다 | 비중을 금액으로 볼지 수량으로 볼지 고객사 미확정 (`docs/05-open-questions.md` 10번) → 둘 다 반환 |
| 호출 위치 | 서버(서버 컴포넌트·Server Action)에서만 호출. 클라이언트로 넘길 때 직렬화는 경영지원팀이 처리 |

## 4. 분류 코드

### 산업분야 (요구사항 기준 — 고객사 확인 전, `05-open-questions.md` 6번)

| key | label |
|---|---|
| `WATER` | 상하수도 |
| `POWER` | 발전소 |
| `GAS` | 가스 |
| `OIL` | 오일 |
| `PETROLEUM` | 석유 |
| `PRIVATE_PLANT` | 민간 플랜트 |
| `ETC` | 기타 |

### 제품 시리즈

시리즈 목록은 생산팀 데이터(제조내역 엑셀)에서 정한다. → 생산팀이 코드·표시명 목록 작성 필요

## 5. 합의가 필요한 항목

- [ ] 판매 기준일: 출고일 / 수주일 / 납기일 중 무엇으로 기간을 나눌지
- [ ] 판매 금액 데이터가 생산팀 업로드 자료에 있는지 (없으면 수량만 반환 가능한지)
- [ ] 제품 시리즈 코드·표시명 목록
- [ ] 산업분야 분류 확정 후 코드 목록 갱신 (고객사 답변 대기)
- [ ] 판매처 산업분야 데이터를 누가 입력하는지 (`05-open-questions.md` 5번)
- [ ] 생산팀 구현 전까지 경영지원팀은 같은 형식의 **가짜 데이터**로 화면을 먼저 만든다 — 함수 이름·타입 변경 시 서로 알리기
