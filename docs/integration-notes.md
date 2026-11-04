# 통합 대비 노트 (팀원 공유용)

팀별로 따로 개발한 뒤 하나로 합칠 예정입니다. 합칠 때 충돌이 없도록 **아래만 맞춰 주세요.**
경영지원팀 저장소 기준이며, 바뀌면 이 문서를 갱신합니다.

> 2026-10-21: 개발용 임시 사용자를 **실제 로그인(아이디·비밀번호)**으로 교체했습니다. 각 팀 화면·Server Action을 붙이는 방법은 **8번**.

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

메인 화면이 생산·서비스팀 데이터를 가져가는 형식: **`docs/interface-production.md`** (2026-11-03 통합 1단계 구현)

- 생산 `getSalesShareByIndustry(period)`·`getSalesShareBySeries(period)` → `{ items, source, basis: "quantity", unconfirmedRows, unclassifiedQuantity, hasSample }`, `getProductionOverview(period)` / 서비스 `getServiceOverview(period)`
- 타입: `src/shared/contracts/production.ts`·`service.ts`
- **통합 1단계(2026-11-03)**: 친구 저장소(lyjradiant-max/newtalk-korea-system, Django+Vue)의 생산·서비스 모델을 Prisma 로(`prisma/schema/production.prisma` `prod_*`, `service.prisma` `svc_*`), 집계 규칙을 순수 함수로(`modules/production/metrics/`·`modules/service/metrics/`) 옮겼습니다. 목업(`production-mock.ts`·`align-mock.ts`)은 지웠습니다
- 생산팀 자료에 판매 금액이 없어 산업 분야별·제품별 도넛은 **확정 출고 수량 기준**입니다 (05-10 갱신). 경영지원 매출 합계와 맞추지 않습니다
- **통합 2·3단계(2026-11-03~04)**: 생산 화면 6개·서비스 화면 2개·부품·가격 화면 5개와 출장보고서 엑셀 가져오기(`npm run import:service`)까지 모두 옮겼습니다. 친구 앱과 다르게 한 것은 11번 표
- AI 분석 입력(2026-11-04): 생산 `getProductionOverview`·`getSalesShareBy*`, 서비스 `getServiceOverview` 결과를 그대로 넣습니다. 경영지원 모듈은 다른 팀 모듈을 import 하지 않으므로 app 계층(`src/app/(dashboard)/team-ai-facts.ts`·`ai-actions.ts`)이 모아서 넘깁니다
- 지금 데이터는 `npm run seed:teams` 가짜 데이터뿐 (`-- --remove` 로 삭제)

## 7. 공통 UI

- 레이아웃: 상단 헤더 + 좌측 사이드바 + 밝은 회색 바탕 위 흰 라운드 카드 — `src/shared/ui/app-shell/` (2026-10-21 리스킨, 다우오피스 스타일에서 변경)
- **디자인 규칙은 [`docs/design-guide.md`](design-guide.md)** — 색 토큰, 카드(`rounded-card border bg-card p-6`), 배지·상태 점·세그먼트 토글·표 클래스, 도넛·막대 규칙, 범주 팔레트, 로고 사용 규칙
- 제목·버튼·배지 클래스는 `src/shared/ui/styles.ts` 상수(`pageTitleClass`·`cardTitleClass`·`buttonPrimaryClass`·`pillClass` 등)를 import 해서 씁니다. 로고는 `src/shared/ui/brand/logo.tsx`의 `<Logo />`만 사용
- 사이드바 메뉴: 메인 / 경영지원 / 생산 / 서비스 / 관리자
- 각 팀 화면은 `(dashboard)/<팀>/page.tsx` 안의 내용만 만들면 셸은 공통으로 씌워집니다.
- 색상은 `src/app/globals.css`의 토큰(`bg-primary`, `bg-canvas`, `text-body`, `bg-success-soft` 등)을 씁니다. 직접 색상값(`#...`, `bg-blue-600` 등)을 쓰지 말아 주세요. 차트 색은 `src/shared/ui/chart-colors.ts`에서 import (같은 항목 = 같은 색)
- 폰트는 Pretendard (`pretendard` 1.3.9 고정, 루트 레이아웃에서 로드) — 팀 화면에서 따로 불러오지 않습니다.
- 버튼 등 기본 컴포넌트는 shadcn/ui (`src/shared/ui/`). 한국어, 금액은 천 단위 콤마.

## 8. 인증·권한 (2026-10-21 실제 로그인으로 교체 — 이 방식으로 붙여 주세요)

아이디·비밀번호 로그인입니다 (회원가입 없음, 계정은 관리자가 `/admin`에서 발급). **외부 패키지 없이** Node 내장 `crypto.scrypt` 해시 + DB 세션으로 구현했습니다. 각 팀은 아래 함수만 쓰면 되고, 로그인·세션 코드는 건드리지 않습니다.

### 8-1. 각 팀이 쓰는 것 (`src/shared/auth` — 서버 전용)

| 함수 | 용도 |
|---|---|
| `getCurrentUser()` | 현재 사용자 `AppUser \| null` (로그인 안 함·세션 만료·비활성이면 `null`). cookies를 읽으므로 **`<Suspense>` 안 서버 컴포넌트·Server Action**에서 호출 (cacheComponents) |
| `can(user, action, team)` | **모든 권한 확인은 이 함수 하나로.** 역할을 직접 비교하지 않습니다 |
| `canManageUsers(user)` | 관리자 설정(권한 변경·비밀번호 초기화·계정 추가·비활성화) — 관리자만 |
| `loadUserNames(ids)` | 작성자 id 목록 → `(id) => 이름` 함수 (화면 표시용, 한 번에 조회) |
| `accessiblePages(user)`, `homePathFor(user)` | 사이드바 메뉴, 로그인 후·메인 접근 불가 시 이동할 페이지 |

- `team`: `"management"`(메인·경영지원) / `"production"` / `"service"`
- `action`: `view`(열람) / `edit`(입력·임시저장) / `confirm`(확정, 확정 데이터 수정, 설정 변경). 각 팀이 자기 화면에서 `edit`·`confirm`을 어떻게 나눌지는 자유 — 지금 규칙에서는 수정 권한이 있으면 둘 다 허용
- 저장할 때 `createdById`·`updatedById` = `getCurrentUser().id`. **외래키 없이 문자열**로 저장합니다 (샘플 데이터는 `"seed"`). 이름은 `loadUserNames()`로 표시

```ts
// Server Action 예시 (생산팀)
"use server";
import { can, getCurrentUser } from "@/shared/auth";

export async function saveProduction(input: Input) {
  const user = await getCurrentUser();
  if (!user || !can(user, "edit", "production")) {
    return { ok: false, message: "수정 권한이 없습니다." };
  }
  // ... createdById: user.id
}
```

### 8-2. 권한 규칙 (내부 결정, 고객사 확인 대기 — `docs/05-open-questions.md` 14·15번)

| 역할 | 메인·경영지원 | 생산 / 서비스 | 관리자 설정 `/admin` |
|---|---|---|---|
| **관리자** (= 대표) | 열람·수정·확정 | 열람·수정·확정 | ✅ |
| **경영지원팀** | 열람·수정·확정 | 열람·수정·확정 | ✕ |
| **팀장** | ✕ | **열람 범위**에 체크한 팀 열람, **수정 권한**에 체크한 팀 수정·확정 | ✕ |
| **팀원** | ✕ | **열람 범위**에 체크한 팀 열람만 | ✕ |

- 생산팀 저장소는 "생산팀 데이터 접근 권한이 있는 모든 사용자"가 업로드·수정·삭제하지만, 이 저장소는 **처음 요구사항대로 팀장만 수정, 팀원은 열람만** (2026-11-03 사용자 결정 — 같은 날 넣었던 생산 예외를 되돌림). 팀원 화면은 버튼 비활성 + "열람 전용"
- 생산팀과 서비스팀은 서로의 페이지를 볼 수 없습니다. 겸직자는 열람 범위에 둘 다 체크합니다
- 수정 권한은 열람 범위 안에서만, 팀장·팀원은 열람 범위 최소 1개
- **비활성(퇴사) 계정, 초기 비밀번호를 아직 안 바꾼 계정은 `can()`이 모두 `false`**
- 메인(`/`)을 볼 수 없는 사용자는 자기 팀 페이지로 이동 (겸직이면 생산)
- 권한을 바꾸면 다음 요청부터 바로 적용됩니다 (매 요청 DB에서 읽음). 비활성화·비밀번호 초기화는 그 사람의 로그인을 즉시 끊습니다

### 8-3. 라우트 보호 (`src/proxy.ts` — 각 팀 페이지 파일은 고치지 않아도 됨)

| 상황 | 처리 |
|---|---|
| 로그인 안 함 | `/login?next=<원래 주소>` (API는 401) |
| 초기 비밀번호 사용 중 | `/account/password?next=…` — 바꾸기 전에는 다른 화면 불가 |
| `/production/**`, `/service/**`, `/management/**`, `/api/management/**` | `can(user, "view", 팀)` 아니면 **권한 없음 화면** (주소는 그대로, HTTP 상태는 200 — API는 403) |
| `/admin/**` | `canManageUsers(user)` 아니면 403 |
| `/` | 경영지원 열람 불가면 `homePathFor(user)`로 이동 |

- 경로 규칙은 `src/shared/auth/route-access.ts` 한 곳에 있습니다. **새 팀 경로(예: `/api/production/...`)를 만들면 `TEAM_PREFIXES`에 한 줄 추가**해 주세요
- proxy는 열람(`view`)만 막습니다. **입력·확정 같은 쓰기는 각 Server Action에서 `can(user, "edit" | "confirm", 팀)`으로 꼭 다시 확인**해 주세요 (proxy만 믿지 않기)
- 레이아웃(`layout.tsx`)은 페이지 이동 때 다시 실행되지 않으므로 권한 확인을 레이아웃에 두지 않습니다 (Next 16 문서 "Layouts and auth checks")

### 8-4. 로그인·계정 동작

| 항목 | 값 |
|---|---|
| 비밀번호 저장 | `scrypt$N$r$p$salt$hash` (N=2^17, r=8, p=1), 원문 저장 없음 |
| 세션 | 무작위 토큰 → httpOnly·SameSite=Lax·(배포 시) Secure 쿠키 `newtork_session`, DB(`auth_session`)에는 SHA-256만. **12시간** |
| 잠금 | 연속 5회 실패 → 10분 (관리자가 비밀번호를 초기화하면 풀림) |
| 새 비밀번호 | 8자 이상, 영문+숫자, 아이디·현재 비밀번호와 다르게 |
| 초기 비밀번호 | 계정 추가·초기화 때 서버가 만들어 **관리자 화면에 한 번만** 표시 → 그 직원은 첫 로그인 때 변경 강제 |
| 퇴사자 | 삭제 대신 비활성화(`deactivatedAt`), 복구 가능. 관리자는 최소 1명 유지 |

### 8-5. 파일

| 파일 | 내용 |
|---|---|
| `prisma/schema/auth.prisma` | `auth_user`, `auth_session`, enum `AuthRole`·`AuthTeam` |
| `src/shared/auth/can.ts` | 권한 규칙 (정책이 바뀌면 이 파일과 `can.test.ts`만) |
| `src/shared/auth/route-access.ts` | 경로 → 필요한 권한 |
| `src/shared/auth/session.ts`, `password.ts`, `login-rules.ts`, `actions.ts` | 세션, 해시, 잠금·비밀번호 규칙, 로그인·로그아웃·비밀번호 변경 |
| `src/shared/auth/testing/fake-users.ts` | **테스트 전용** 가짜 사용자 7명 (시드 계정과 같은 구성) — `*.test.ts`에서만 import |
| `src/proxy.ts` | 로그인·라우트 보호 |
| `src/app/(auth)/login`, `src/app/account/password` | 로그인, 비밀번호 변경 |
| `src/app/(dashboard)/admin`, `src/modules/admin` | 관리자 설정 (인증 ③) |
| `prisma/seed.ts` | 직원 계정 7명. 초기 비밀번호는 `.env`의 `SEED_INITIAL_PASSWORD`, 없으면 실행 시 한 번만 출력 |

- 테스트에서 사용자가 필요하면 `FAKE_USERS.prodLeader`, `fakeUser("prodMember", { viewTeams: [] })`처럼 씁니다. Server Action 테스트는 `vi.mock("@/shared/auth", …)`로 `getCurrentUser`를 바꿔 끼웁니다 (`src/modules/admin/actions.test.ts` 참고)
- `.env`에서 `DEMO_MODE`는 더 이상 쓰지 않습니다 (지워도 됨). 배포 시에는 HTTPS 뒤에서 실행해야 Secure 쿠키가 동작합니다

## 9. 변경 이력 (2026-10-25 — 다른 팀도 이 방식으로 기록해 주세요)

- 표 `audit_log`(`prisma/schema/audit.prisma`)는 팀 공통. 직접 쓰지 말고 `src/shared/audit/record.ts`의 `recordAudit(tx, entry)`만 쓴다
- **원래 저장과 같은 `prisma.$transaction` 안에서** 부른다 → 기록이 실패하면 저장도 취소
- `entry`: `occurredAt`(getNow), `actor`({ id, loginId }), `area`(팀 화면이면 새 값 추가 협의 — 지금 "management" | "admin"), `screen`(팀 화면 이름, 예: "production-output"), `action`(`src/shared/audit/types.ts` 목록), `target`({ type, id, label }), `changes`(`diffFields()` 결과), `meta`
- 바뀐 칸은 `src/shared/audit/diff.ts`의 `diffFields(before, after, fields)`로 — 팀마다 "기록할 칸" 목록(허용 목록)을 만들고, 칸 이름·값은 화면 표기 그대로
- 비밀번호·해시·토큰·세션 같은 칸 이름은 거부된다. 기록은 수정·삭제 불가(DB 트리거) — 마이그레이션으로 적용해야 트리거가 생김(`db push` 로는 안 생김)

- 보는 화면 `/management/history`: 팀 화면을 기록하면 `src/modules/management/history/labels.ts`의 `HISTORY_SCREENS`에 화면 이름(한글)·area를 추가하고, meta 를 문장으로 보여 주려면 `metaSummary()`에 형식을 추가한다 (없으면 바뀐 내용만 보이고 meta 는 표시하지 않음)

## 10. 기타

- 비밀키는 `.env`에만 (`.env.example`에 키 이름만). AI 키 등은 클라이언트로 보내지 않습니다.
- **시간대**: 시각(`DateTime`)은 UTC로 저장하고 화면에서만 Asia/Seoul로 표시합니다. 날짜 계산(오늘·분기·경과일)은 한국 날짜 기준입니다(`getTodayKst()`). DB 세션 시간대가 Asia/Seoul인 환경에서 SQL `now()`나 DB 기본값(`CURRENT_TIMESTAMP`)으로 시각을 넣으면 KST 값이 UTC로 저장되어 9시간 어긋나므로, 시각은 Prisma로 넣거나 `now() AT TIME ZONE 'UTC'`를 쓰세요.
- **AI 호출 공통**: `src/shared/ai/` — `getAnthropicClient()`(server-only, 키 없으면 `AiError("not-configured")`), `generateJson({ create, model, system, user, schema })`(JSON 출력 + Zod 검증 + 오류 종류 분류), `AiError`·`aiErrorMessage()`(화면 안내 문구). 다른 팀도 AI를 쓰면 이 함수를 재사용해 주세요. SDK 버전은 `package.json`에 정확히 고정(`@anthropic-ai/sdk` 0.131.0).
  - 테스트에서는 `create`에 가짜 함수를 넣습니다. Vitest 실행 중에는 `getAnthropicClient()`가 항상 에러를 내므로 CI가 실제 API를 부를 수 없습니다.
  - 개발 화면 확인용 `AI_MOCK=true`(실패 연습 `AI_MOCK=fail`)는 `next dev`에서만 동작합니다.
  - 키는 `npm run env:set-key`로 넣습니다 (입력 숨김, 길이만 표시).
  - **예시 분석(`npm run seed:ai-examples`)은 시드(가짜) 데이터용입니다.** 고객사 실제 데이터를 넣기 전(05-19번 답변 후)에는 반드시 `npm run seed:ai-examples -- --remove`로 지워 주세요. 예시는 `model = "example"`, id `ai-example-*`로 저장되어 다른 기록과 구분됩니다.
  - ⚠️ 외부 AI로 재무 집계값을 보내는 것은 고객사 확인 전입니다 (05-19번). 답변 전까지 **샘플 시드 데이터로만** 사용하고, 실제 데이터를 넣은 DB에서는 AI 분석을 실행하지 않습니다.
- **파일 업로드 공통**: `src/shared/upload/read-table.ts`의 `readTableFile(fileName, ArrayBuffer)` → 시트별 셀 표(문자열·숫자·null). .xlsx(exceljs 4.4.0 고정)·.csv(UTF-8/EUC-KR 자동 판별) 지원, .xls는 안내 메시지. 팀별 열 인식·검증은 각 모듈에서 합니다(경영지원: `modules/management/upload/`). 병합 셀·글자색·배경색·수식으로 의미를 나타내는 양식은 `src/shared/upload/read-styled-sheet.ts`의 `readStyledXlsx(fileName, ArrayBuffer)`로 읽습니다(셀 값·수식·계산값 유무·표시 형식·글자색·배경색(직접 색 ARGB / 테마 색 번호·tint)·병합 범위·숨김 열). 경영지원 사용처: `modules/management/ledger/import/`.
- `npm run check` (lint + typecheck + test)가 통과하는 상태로 합칩니다.
- **배포(Render)**: 루트 `render.yaml` 한 개로 웹 서비스 + PostgreSQL을 만듭니다 (README 8번). 빌드는 `prisma migrate deploy` → `db:seed:if-empty`(빈 DB일 때만) → `next build`. 팀 테이블을 추가하면 마이그레이션 파일만 있으면 자동 반영되고, 팀 시드를 넣는다면 **재배포 때 사용자 데이터를 덮어쓰지 않게** 빈 DB일 때만 실행해 주세요. 헬스체크 `/api/health`는 로그인 없이 열려 있습니다(`proxy.ts`의 `PUBLIC_PATHS`).

## 11. 친구 앱(lyjradiant-max/newtalk-korea-system)과 다르게 한 것 (2026-11-04 정리)

계산 규칙은 친구 저장소 그대로 옮기고(숫자 대조 결과는 `docs/service-migration.md`·각 PR), 아래만 이 저장소 규칙에 맞췄습니다.

| 항목 | 친구 앱 | 본체 | 이유 |
|---|---|---|---|
| 삭제 | 제조내역·출장보고서·첨부·부품·출장지·가격을 지움 | **숨김(`deletedAt`) + 복구** — 조회는 모두 `deletedAt: null`. 가격 삭제 = 숨김(다시 입력하면 같은 행을 되살림), 출장지를 숨기면 그 출장지 가격도 숨김 | 이 저장소 규칙(삭제 대신 숨김) |
| 수정 권한 | 그 팀이면 팀원도 수정 | **팀장(수정 권한)만** 입력·수정·숨김, 팀원은 버튼 비활성 + "열람 전용" | 처음 요구사항(팀원은 열람만) — `can()` |
| 변경 이력 | 없음 | 저장마다 `audit_log` (`area: "production"`·`"service"`, 바뀐 칸만), 경영지원 [변경 이력] 화면에서 봄 | 이 저장소 규칙 |
| 색·모양 | 부트스트랩 파랑 | design-guide 팔레트 — 네이비·코퍼(목표선·무상·일부 출고), 도넛 범례·[표로 보기] | `docs/design-guide.md` |
| 차트 | Chart.js · chartjs-chart-geo | Recharts · 지도는 같은 경계 자료를 미리 SVG 로 투영(`scripts/make-korea-map.ts`) | 이 저장소 차트 도구 |
| 목록 정렬 | 부품·출장지 목록이 Django 집계 쿼리라 기본 정렬이 빠져 순서가 정해지지 않음 | 이름 순 | 친구 쪽 버그로 보고 고치지 않고 정렬 |
| 비율 반올림 | 파이썬 `round()` (딱 절반이면 짝수 쪽: 56.25% → 56.2%) | **같게 맞춤** (`modules/service/labels.ts` `pct1`) | 친구 규칙 그대로 |
| 행 수정 | 행을 누르면 수정 창 | 행마다 [수정]·[숨김] 버튼, 일련번호 → 일련번호 검색 | 숨김 버튼이 필요해서 |
| 출장보고서 PDF 읽기 | pypdfium2 | PDFium WASM(`@embedpdf/pdfium`) + 같은 `parse()`. 띄어쓰기 NBSP → 공백 | Node 서버. 샘플로 24개 항목 같음 확인 |
| 첨부 파일 저장 | 서버 디스크 | DB(`bytea`), 받기는 `/api/service/attachments/{id}`(서비스 열람 권한) | 배포 서버(Render)에 디스크 없음 |
| 엑셀 가져오기 | `manage.py import_service_xlsx` | `npm run import:service` (같은 규칙·같은 결과) | 이 저장소 스크립트 방식 |
| 가상 데이터 | `seed_production_demo`·`seed_price_demo` | `npm run seed:teams`(DB) + `npm run make:production-sample`(엑셀 파일) | 한 명령으로 생산·서비스 함께 |
| 계정·로그인 | JWT, `create_admin` 명령, 계정 관리 화면 | 이 저장소 로그인(DB 세션)·`/admin`·`INITIAL_ADMIN_*` | 이미 있던 인증 (8번) |
| Django 관리자(`/admin`) | 모든 표를 직접 편집 | 없음 — 각 화면에서만 | 변경 이력·숨김 규칙을 거치게 |
| 외부 REST API | `/api/production/*`·`/api/service/*` JSON | 없음 (Server Action·서버 컴포넌트) | 화면에서 쓰지 않는 필터(정렬·납기일 기간·시트)는 옮기지 않음 |
| 부서 홈·ping | 경영지원 "준비 중" 화면 | 경영지원 화면은 이 저장소가 원본 | — |
| 수주번호 찾기(캘린더) | 첫 50건만 셈 (목록 API 쪽 크기) | 전부 셈 | 50건이 넘는 수주번호도 맞게 |

