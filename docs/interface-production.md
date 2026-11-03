# 생산팀·서비스팀 → 경영지원팀 데이터 인터페이스

> 상태: **통합 1단계 구현 (2026-11-03)** — 친구 저장소(lyjradiant-max/newtalk-korea-system, Django+Vue)의 생산·서비스 집계 규칙을 이 저장소(Next.js·Prisma)로 옮겨 메인 화면에 연결. 생산·서비스 입력 화면(업로드·제조내역·출장보고서 등)은 다음 단계
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
> 2026-11-03 — 목업(`external/production-mock.ts`·`align-mock.ts`)을 지우고 `src/modules/production/index.ts` 실제 함수로 교체. 결과에 `basis`·`unconfirmedRows`·`unclassifiedQuantity`·`hasSample` 추가.
> 호출 위치: `src/app/(dashboard)/page.tsx` 가 각 팀 `index.ts` 를 불러 `MainDashboard` 의 `teams` 로 넘긴다 (팀 모듈끼리 import 금지).

## 3. 반환 규칙 (생산팀 `backend/production/dashboard.py` 규칙 그대로 — `src/modules/production/metrics/sales-share.ts`)

| 항목 | 규칙 |
|---|---|
| 집계 대상 | 제조내역(`prod_record`) 중 **출고일자가 있고 수량을 입력한 행** — 수량은 엑셀에 없어 사람이 확인해 입력 (생산팀 specs/07 Q1) |
| 기간 기준 | **출고일자**가 `period` 안에 있는 행 |
| 비중 기준 | **확정 출고 수량(대)** — 생산팀 자료에 판매 금액이 없음 (`basis: "quantity"`, `amount` 는 `0n`). 05-10 을 금액 → 수량으로 갱신 |
| 수량 미확정 | 출고일은 있으나 수량이 빈 행 → 합계에 넣지 않고 `unconfirmedRows` (화면 "제외: 수량 미확정 N행") |
| 산업분야 | 수주번호(J열)별 사업구분(`prod_order_category`). 지정하지 않은 수주번호 수량은 조각 대신 `unclassifiedQuantity` (화면 "사업구분 미분류 N대") |
| 제품 | 모델명(C열) 원본 값 그대로(`01`·`02` …, 생산팀 Q7). 6개를 넘으면 상위 5개 + `OTHER_MODELS`("기타 모델 N개") |
| 데이터 없음 | 빈 배열 `[]` (에러 아님) |
| 0인 분류 | 결과에서 제외 |
| 정렬 | 수량 내림차순 (그래프 조각은 분류 고정 순서) |
| 시드 데이터 | 작성자 id 가 `seed-production` 인 행이 있으면 `hasSample: true` → "샘플 데이터" 배지 |
| 권한 | 함수 안에서 `can(user, "view", "production")` |
| 호출 위치 | 서버(서버 컴포넌트·Server Action)에서만 |

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

### 제품

제조내역 엑셀 C열 모델명 원본 값. 색은 모델명 오름차순으로 범주 팔레트 순서대로(`seriesColors()` — `src/shared/ui/chart-colors.ts`), "기타 모델"은 슬레이트.

## 5. 합의 결과 (2026-11-03 — 생산팀 저장소 결정 기준)

- [x] 판매 기준일: **출고일자**
- [x] 판매 금액: 제조내역에 없음 → **수량만** (확정 출고 수량)
- [x] 제품 시리즈: 모델명(C열) 원본 값 — 표시 이름 변환은 생산팀 Q7 확정 후
- [x] 산업분야: 처음 요구사항 7개 분류, **수주번호마다 직접 지정** (생산팀 Q3)
- [ ] 생산팀 입력 화면(엑셀 업로드·제조내역 수정·사업구분 지정·목표) 이식 — 다음 단계. 지금은 `npm run seed:teams` 가짜 데이터만

## 6. 메인 "팀별 현황" 카드 (2026-11-03)

```ts
// src/modules/production/index.ts
export async function getProductionOverview(period: Period): Promise<ProductionOverview>;
// src/modules/service/index.ts
export async function getServiceOverview(period: Period): Promise<ServiceOverview>;
```

타입: `src/shared/contracts/production.ts`(`ProductionOverview`), `src/shared/contracts/service.ts`(`ServiceOverview`)

| 카드 | 항목 | 규칙 |
|---|---|---|
| 생산 | 확정 출고 수량 | 위 3번과 같음 |
| 생산 | 목표 달성률 | 확정 출고 수량 ÷ 기간 목표. 월 = 월 목표, 분기·누적 = 월 목표 합(**모두 입력됐을 때만**, 아니면 "월 목표 2/3개월만 입력"), 연간 = 연간 목표 |
| 생산 | 납기 일정 | **납기일자** 기준, 같은 납기일 + 같은 수주번호 = 1건 (수주번호 없으면 일련번호 단위), 출고 여부 무관. 출고일 없는 제품이 남은 일정 = "출고 대기" |
| 서비스 | 출장 건수 | **출장 시작일** 기준, 출장보고서 1건 = 1건 (시작일 없는 보고서는 어느 기간에도 넣지 않음) |
| 서비스 | 유상 비율 | 유상 ÷ (유상 + 무상), 비용청구 미입력 제외 (둘 다 0이면 "-") |
| 서비스 | 수리 제품 | 제품 목록 중 수량을 입력한 것만 합계 |

- 금액(부품 비용·매출)은 계산하지 않는다 (서비스팀 규칙)
- AI 분석 입력에는 아직 넣지 않는다 (`ai/build-input.ts` TODO 위치 그대로 — 넣으면 `PROMPT_VERSION` 올리기)
