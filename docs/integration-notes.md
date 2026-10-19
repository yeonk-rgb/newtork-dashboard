# 통합 대비 노트 (팀원 공유용)

팀별로 따로 개발한 뒤 하나로 합칠 예정입니다. 합칠 때 충돌이 없도록 **아래만 맞춰 주세요.**
경영지원팀 저장소 기준이며, 바뀌면 이 문서를 갱신합니다.

> ⚠️ **실제 로그인 전에는 외부 공개 배포 금지** — 자세한 내용은 8번.

## 1. 기술 스택 (버전 맞추기)

| 항목 | 버전 / 선택 |
|---|---|
| Node.js | 24 (LTS) |
| Next.js | 16.4.2 (App Router, Turbopack) — `middleware.ts` 대신 `proxy.ts` |
| React | 19.3.0 |
| TypeScript | 5.x |
| Prisma | **7.10.1 고정** (`prisma`, `@prisma/client`, `@prisma/adapter-pg`) |
| DB | PostgreSQL 16 |
| UI | Tailwind 4 + shadcn/ui |
| 차트 | Recharts |
| 검증 | Zod |
| 테스트 | Vitest |

`package.json`·`package-lock.json`이 기준입니다. 새 패키지는 합칠 때 목록을 공유해 주세요.

## 2. 폴더 구조

각 팀 코드는 **자기 팀 폴더 안에만** 둡니다. 이 구조면 폴더째 옮겨 합칠 수 있습니다.

```
src/app/(dashboard)/<팀>/     화면
src/modules/<팀>/             로직 (index.ts = 외부 공개 함수)
prisma/schema/<팀>.prisma     DB 모델
src/shared/                   공통 (금액 포맷, UI, 인증 등)
```

- `<팀>` 이름: `management` / `production` / `service`
- 다른 팀 모듈을 직접 import하지 않습니다. 필요한 건 그 팀 `index.ts`가 export한 함수로만 씁니다.

## 3. 테이블 이름 규칙

| 팀 | 접두사 | 예시 |
|---|---|---|
| 경영지원 | `mgmt_` | `mgmt_monthly_finance` |
| 생산 | `prod_` (제안) | `prod_sales` |
| 서비스 | `svc_` (제안) | `svc_trip_report` |

- Prisma 모델에 `@@map("<접두사>_테이블명")`을 붙입니다.
- **enum 이름도 접두사**를 붙입니다 (예: `MgmtEntryStatus`). Prisma는 enum 이름이 전체에서 하나여야 해서 겹치면 합칠 때 에러가 납니다.
- 모델 이름도 겹치지 않게 해 주세요 (예: 둘 다 `Sales`를 만들면 충돌).
- 삭제 대신 숨김(소프트 삭제)을 쓸 때는 열 이름을 `deletedAt`(DateTime?)·`deletedById`(String?)로 맞추면 합칠 때 편합니다 (제안). 경영지원 `mgmt_receivable`이 이 방식이며, 숨긴 행은 조회 시 `deletedAt: null`로 제외합니다.
- 마이그레이션은 합칠 때 다시 정리하므로, 각자 저장소의 마이그레이션 파일은 참고용입니다.

## 4. 금액 규칙

- 금액은 **원 단위 정수, `BigInt`**로 저장합니다. (`Int`는 최대 약 21억이라 연매출에서 넘칠 수 있음)
- 소수·비율 계산은 화면에 표시할 때만 합니다.
- 서버 → 화면으로 넘길 때는 `serializeBigInt()`로 문자열로 바꿉니다 (`src/shared/format/bigint.ts`).
- 표시는 `formatAmount()` / `formatWon()` 사용 → `1,234,000` / `1,234,000원` (`src/shared/format/money.ts`).

## 5. 기간(Period) 형식

DB에는 **월 단위로만** 저장하고, 분기·연간은 조회할 때 계산합니다. 함수에 기간을 넘길 때는 이 타입을 씁니다 (`src/shared/period/period.ts`).

```ts
type Period =
  | { unit: "month"; year: number; month: number }   // month: 1~12
  | { unit: "quarter"; year: number; quarter: 1 | 2 | 3 | 4 }
  | { unit: "year"; year: number }
  | { unit: "ytd"; year: number; month: number };    // 연초 누적 (1월 ~ month)
```

- 같은 파일에 `periodMonths()`(기간의 월 목록), `previousPeriod()`(직전 기간), `samePeriodLastYear()`(전년 동기), `periodLabel()`이 있습니다. 각 팀이 따로 만들지 말고 이걸 써 주세요.
- 집계는 **확정된 달만** 하고, 미확정 월은 따로 안내합니다 (경영지원팀 기준 — 팀별로 맞추면 좋습니다).

- 기본 보기는 **분기**, 월·연간으로 전환 가능 (고객 요구)
- 회계연도가 1~12월인지는 고객사 확인 중 (`docs/05-open-questions.md` 2번)

## 6. 팀 간 연동 함수

메인 화면이 생산팀 데이터를 가져가는 형식: **`docs/interface-production.md`** (합의 전 초안)

- `getSalesShareByIndustry(period)`, `getSalesShareBySeries(period)` → `{ items, source: "mock" | "production" }`
- 타입: `src/shared/contracts/production.ts`
- 합의 전까지 경영지원팀은 같은 형식의 **목업**(`src/modules/management/external/production-mock.ts`)으로 개발합니다. 이름·타입을 바꿀 땐 서로 알려 주세요.
- 메인 화면은 목업일 때(`source: "mock"`)만 **합계를 그 기간 확정 총매출에 맞추고 비중만 가상으로** 보여줍니다 (`src/modules/management/external/align-mock.ts`, 시연 시 매출 카드와 합계가 다르지 않게). 실제 생산팀 데이터(`source: "production"`)는 그대로 쓰므로, **통합 후에는 이 맞춤이 필요 없습니다** — 목업 파일과 함께 정리해 주세요. 단, 실제 데이터의 판매 합계와 경영지원 매출 합계가 다를 수 있으니(집계 기준일·VAT·용역 포함 여부) 그 차이를 화면에서 어떻게 안내할지는 통합 때 정합니다.

## 7. 공통 UI

- 레이아웃: 상단 헤더 + 좌측 사이드바 (다우오피스 스타일) — `src/shared/ui/app-shell/`
- 사이드바 메뉴: 메인 / 경영지원 / 생산 / 서비스 / 관리자
- 각 팀 화면은 `(dashboard)/<팀>/page.tsx` 안의 내용만 만들면 셸은 공통으로 씌워집니다.
- 색상은 `src/app/globals.css`의 토큰(`--primary`, `--sidebar` 등)을 씁니다. 직접 색상값을 쓰지 말아 주세요.
- 버튼 등 기본 컴포넌트는 shadcn/ui (`src/shared/ui/`). 한국어, 금액은 천 단위 콤마.

## 8. 인증 — 통합 시 결정

> ⚠️ **실제 로그인 전에는 외부 공개 배포 금지.** 배포 빌드(`next start`)는 기본적으로 모든 요청을 403으로 막고, `.env`에 `DEMO_MODE=true`가 있을 때만 "경영지원 팀장"으로 고정되어 열립니다 (사내 시연용, 누구나 그 권한으로 접속됨).

로그인·계정·권한 방식은 **합칠 때 함께 정합니다.** 그 전까지는:

- **개발용 임시 사용자**로 개발합니다 (로그인 화면 없음). `npm run dev`에서 헤더의 **DEV 드롭다운**으로 5명(관리자·대표·경영지원 팀장·경영지원 팀원·생산 팀원)을 전환합니다.
- 현재 사용자는 **`getCurrentUser()`**, 권한 확인은 반드시 **`can(user, action, team)`** 하나를 거칩니다 (`src/shared/auth`). 화면·서버 코드에서 역할을 직접 비교하지 않습니다.
- `action`은 3가지: `view`(열람) / `edit`(입력·임시저장) / `confirm`(확정, 확정 데이터 수정, 설정 변경)
- 현재 규칙 (고객사 확인 중 — `docs/05-open-questions.md` 14·15번):

  | 사용자 | view | edit | confirm |
  |---|---|---|---|
  | 관리자 · 대표 | 모든 팀 | 모든 팀 | 모든 팀 |
  | 경영지원 팀장 | 모든 팀 | 경영지원 | 경영지원 |
  | 경영지원 팀원 | 모든 팀 | 경영지원 | ✕ |
  | 다른 팀 팀장 | 자기 팀 | 자기 팀 | 자기 팀 |
  | 다른 팀 팀원 | 자기 팀 | ✕ | ✕ |

- 메인(`/`)은 경영지원팀 view 권한과 같습니다. 권한이 없으면 자기 팀 페이지로 이동합니다.
- 작성자 필드는 지금 `userId` 문자열(`createdById` 등)로만 저장하고 (임시 사용자 id, 샘플 데이터는 `"seed"`), User 테이블 관계는 통합 시 연결합니다.
- 각 팀 페이지도 `can()`으로 서버에서 막아 주세요 (경영지원 저장소의 `production`·`service` placeholder에는 넣지 않았습니다).

### 실제 로그인으로 교체할 때 바꿀 파일

| 파일 | 할 일 |
|---|---|
| `src/shared/auth/current-user.ts` | **교체** — `getCurrentUser()` 본문을 실제 세션 조회로 (반환 타입 `AppUser \| null` 유지) |
| `src/shared/auth/can.ts` | **규칙 교체** — 확정된 권한 정책으로 (`can.test.ts` 기대값도 함께) |
| `src/proxy.ts` | **교체** — 배포 차단 대신 미로그인 → `/login` 이동 |
| `src/shared/auth/dev-users.ts` | **삭제** — 임시 사용자 5명. 함께 있는 `userDisplayName(id)`(작성자 id → 표시 이름)은 사용자 테이블 조회로 **교체** |
| `src/shared/auth/resolve-user.ts` (+ 테스트) | **삭제** — 개발/DEMO_MODE 판정 |
| `src/shared/auth/dev-switch.ts` | **삭제** — 사용자 전환 Server Action |
| `src/shared/ui/app-shell/dev-user-switcher.tsx` | **삭제** — DEV 드롭다운 |
| `src/shared/ui/app-shell/header.tsx` | **수정** — 드롭다운 제거, 로그아웃 버튼 연결 |
| `src/shared/auth/index.ts` | **수정** — 삭제한 export 정리 |
| `src/shared/auth/types.ts` | 유지 (필요하면 `AppUser`에 필드 추가) |
| `src/shared/auth/access.ts`, 각 페이지의 `can()` 호출 | 유지 |
| `.env` | `DEMO_MODE` 삭제, 인증 비밀키 추가 |

## 9. 기타

- 비밀키는 `.env`에만 (`.env.example`에 키 이름만). AI 키 등은 클라이언트로 보내지 않습니다.
- **AI 호출 공통**: `src/shared/ai/` — `getAnthropicClient()`(server-only, 키 없으면 `AiError("not-configured")`), `generateJson({ create, model, system, user, schema })`(JSON 출력 + Zod 검증 + 오류 종류 분류), `AiError`·`aiErrorMessage()`(화면 안내 문구). 다른 팀도 AI를 쓰면 이 함수를 재사용해 주세요. SDK 버전은 `package.json`에 정확히 고정(`@anthropic-ai/sdk` 0.131.0).
  - 테스트에서는 `create`에 가짜 함수를 넣습니다. Vitest 실행 중에는 `getAnthropicClient()`가 항상 에러를 내므로 CI가 실제 API를 부를 수 없습니다.
  - 개발 화면 확인용 `AI_MOCK=true`(실패 연습 `AI_MOCK=fail`)는 `next dev`에서만 동작합니다.
  - 키는 `npm run env:set-key`로 넣습니다 (입력 숨김, 길이만 표시).
  - ⚠️ 외부 AI로 재무 집계값을 보내는 것은 고객사 확인 전입니다 (05-19번). 답변 전까지 **샘플 시드 데이터로만** 사용하고, 실제 데이터를 넣은 DB에서는 AI 분석을 실행하지 않습니다.
- `npm run check` (lint + typecheck + test)가 통과하는 상태로 합칩니다.
