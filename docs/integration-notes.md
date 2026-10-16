# 통합 대비 노트 (팀원 공유용)

팀별로 따로 개발한 뒤 하나로 합칠 예정입니다. 합칠 때 충돌이 없도록 **아래만 맞춰 주세요.**
경영지원팀 저장소 기준이며, 바뀌면 이 문서를 갱신합니다.

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
- 마이그레이션은 합칠 때 다시 정리하므로, 각자 저장소의 마이그레이션 파일은 참고용입니다.

## 4. 금액 규칙

- 금액은 **원 단위 정수, `BigInt`**로 저장합니다. (`Int`는 최대 약 21억이라 연매출에서 넘칠 수 있음)
- 소수·비율 계산은 화면에 표시할 때만 합니다.
- 서버 → 화면으로 넘길 때는 `serializeBigInt()`로 문자열로 바꿉니다 (`src/shared/format/bigint.ts`).
- 표시는 `formatAmount()` / `formatWon()` 사용 → `1,234,000` / `1,234,000원` (`src/shared/format/money.ts`).

## 5. 기간(Period) 형식

DB에는 **월 단위로만** 저장하고, 분기·연간은 조회할 때 계산합니다. 함수에 기간을 넘길 때는 이 타입을 씁니다.

```ts
type Period =
  | { unit: "month"; year: number; month: number }   // month: 1~12
  | { unit: "quarter"; year: number; quarter: 1 | 2 | 3 | 4 }
  | { unit: "year"; year: number };
```

- 기본 보기는 **분기**, 월·연간으로 전환 가능 (고객 요구)
- 회계연도가 1~12월인지는 고객사 확인 중 (`docs/05-open-questions.md` 2번)

## 6. 팀 간 연동 함수

메인 화면이 생산팀 데이터를 가져가는 형식: **`docs/interface-production.md`** (합의 전 초안)

- `getSalesShareByIndustry(period)`, `getSalesShareBySeries(period)`
- 합의 전까지 경영지원팀은 같은 형식의 **목업**으로 개발합니다. 이름·타입을 바꿀 땐 서로 알려 주세요.

## 7. 공통 UI

- 레이아웃: 상단 헤더 + 좌측 사이드바 (다우오피스 스타일) — `src/shared/ui/app-shell/`
- 사이드바 메뉴: 메인 / 경영지원 / 생산 / 서비스 / 관리자
- 각 팀 화면은 `(dashboard)/<팀>/page.tsx` 안의 내용만 만들면 셸은 공통으로 씌워집니다.
- 색상은 `src/app/globals.css`의 토큰(`--primary`, `--sidebar` 등)을 씁니다. 직접 색상값을 쓰지 말아 주세요.
- 버튼 등 기본 컴포넌트는 shadcn/ui (`src/shared/ui/`). 한국어, 금액은 천 단위 콤마.

## 8. 인증 — 통합 시 결정

로그인·계정·권한 방식은 **합칠 때 함께 정합니다.** 그 전까지는:

- **개발용 임시 사용자**로 개발합니다 (로그인 화면 없음).
- 권한 확인은 반드시 **`can(user, action, team)` 함수 하나**를 거칩니다 (`src/shared/auth/`). 화면·서버 코드에서 역할을 직접 비교하지 않습니다.
- 통합 시 **교체할 부분은 두 곳**뿐입니다:
  1. 임시 사용자를 돌려주는 함수 → 실제 로그인 세션으로
  2. `can()` 내부 규칙 → 확정된 권한 정책으로
- 고객 요구 권한 (참고): 대표·관리자·경영지원팀 = 전체 / 생산·서비스팀 = 자기 팀만 열람 / 팀장만 수정, 팀원은 열람
- 작성자 필드는 지금 `userId` 문자열(`createdById` 등)로만 저장하고, User 테이블 관계는 통합 시 연결합니다.

## 9. 기타

- 비밀키는 `.env`에만 (`.env.example`에 키 이름만). AI 키 등은 클라이언트로 보내지 않습니다.
- `npm run check` (lint + typecheck + test)가 통과하는 상태로 합칩니다.
