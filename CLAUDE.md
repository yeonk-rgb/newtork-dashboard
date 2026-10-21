# CLAUDE.md

## 요구사항 문서

요구사항 원문은 `docs/` 참고. (고객사 미팅·기획 자료 원문이므로 내용을 임의로 바꾸지 않는다)

| 파일 | 내용 |
|---|---|
| `docs/01-project-overview.md` | 프로젝트 기획서 요약 — 배경, PoC 목표, 주요 기능, 기대효과, 산출물 |
| `docs/02-team-requirements.md` | 팀별 대시보드 항목 — 메인(경영지원)·경영지원·생산·서비스팀 입력/표시 항목 |
| `docs/03-meeting-notes-20261014.md` | 10/14 고객사 미팅 내용 — 기본 사항, 팀별 요청, 권한, 보안 |
| `docs/04-company-profile.md` | 고객사 소개 — 업종, 사업 영역, 인증, 조직 |
| `docs/05-open-questions.md` | 고객사 확인 필요 사항 표 (질문·관련 팀·상태) |
| `docs/06-management-checklist.md` | 경영지원팀 요구사항 추적표 (구현 단계·관련 파일·상태) |
| `docs/interface-production.md` | 생산팀 → 경영지원팀 데이터 연동 함수 형식 (합의 전 초안) |
| `docs/integration-notes.md` | 팀별 저장소를 합칠 때 맞출 규칙 (팀원 공유용) |

## 프로젝트 개요

- **고객사**: 뉴토크코리아(NEWTORK) — 전동밸브조작기 제조사, 직원 12명
- **목적**: 대표가 현장에 상주하지 않아도 **월말 5분 입력 + 엑셀 업로드**만으로 전사 원가·이익률·자금 수지 등 핵심 지표를 한눈에 보는 경영 대시보드 웹앱 (PoC)
- **팀 구성** (각 팀은 다른 개발자가 담당)
  - 경영지원팀 — 메인 화면, **내 담당**
  - 생산팀
  - 서비스팀
- **기존 환경**: 다우오피스 그룹웨어, ERP(시각화 기능 없음), 엑셀로 수금 관리 중

## 이 저장소의 범위 (팀 결정, 2026-10-16)

팀별로 각자 저장소에서 개발하고 나중에 합친다. **이 저장소는 경영지원팀(메인 화면 포함) 모듈 개발용**이다.

- **개발 범위**: `modules/management`, `app/(dashboard)/`의 메인(`page.tsx`)·`management/`, `prisma/schema/management.prisma`(`mgmt_*` 테이블), 경영지원팀이 쓰는 `shared/`
- **손대지 않는 곳**: `production/`, `service/` 폴더(모듈·화면·스키마)는 placeholder 그대로 두고 수정하지 않는다
- **인증·계정·권한** (2026-10-21 실제 로그인으로 교체): 아이디·비밀번호 로그인(회원가입 없음, 관리자가 발급), 외부 패키지 없이 Node 내장 `scrypt` + DB 세션(`auth_user`·`auth_session`, `prisma/schema/auth.prisma`). 권한 확인은 **반드시 `shared/auth`의 `can()` 함수를 거친다**
  - 현재 사용자: `getCurrentUser()` (cookies를 읽으므로 **`<Suspense>` 안 컴포넌트에서** 호출 — cacheComponents). 로그인 안 함·만료·비활성이면 `null`
  - 동작: `view` / `edit`(입력·임시저장) / `confirm`(확정·설정 변경). 저장 시 `createdById`/`updatedById` = `getCurrentUser().id` (외래키 없는 문자열, 시드 데이터는 `"seed"`) — 화면 표시 이름은 `loadUserNames(ids)`
  - `src/proxy.ts`: 미로그인 → `/login?next=…`, 초기 비밀번호 사용 중 → `/account/password?next=…`, 경로 권한(`route-access.ts`): 팀 경로·`/admin`은 권한 없으면 403 화면, 메인은 자기 팀으로 이동. 쓰기는 각 Server Action에서 `can()`으로 다시 확인
  - 권한 규칙(`can.ts`, 내부 결정·고객사 확인 대기 05-14·15): 관리자·경영지원팀 = 모든 팀 view·edit·confirm, 팀장 = 열람 범위 view + 수정 권한 edit·confirm, 팀원 = 열람 범위 view. 비활성·초기 비밀번호 계정은 전부 false. 관리자 설정은 `canManageUsers()`
  - 세션 12시간, 로그인 5회 실패 시 10분 잠금, 새 비밀번호 8자 이상·영문+숫자·아이디/현재 비밀번호와 다르게 (`login-rules.ts`)
  - 테스트용 가짜 사용자: `shared/auth/testing/fake-users.ts` (`*.test.ts`에서만 import)
  - **관리자 설정** `/admin`(`modules/admin`): 규칙은 `rules.ts`(`normalizeScope`·`scopeError`·`keepsAnAdmin`·`rowAbilities` — 화면·Server Action 공용), Action은 모두 `canManageUsers()` 확인. 역할·범위는 모아서 [변경]으로 일괄 저장(`updatedAt` 동시 수정 확인, Serializable 트랜잭션), 임시 비밀번호는 응답으로 한 번만 돌려주고 DB에는 해시만. 비활성화·초기화는 그 사람 세션 삭제
  - 시드 계정 7명(`npm run db:seed`): 초기 비밀번호는 `.env`의 `SEED_INITIAL_PASSWORD`, 없으면 실행 시 한 번만 출력 (코드·git에 남기지 않음)
  - 교체할 파일 목록: `docs/integration-notes.md` 8번
- **통합 대비 규칙**
  - 경영지원팀 코드는 `modules/management`와 `mgmt_` 테이블 안에서만 작성한다
  - 다른 팀 데이터는 `docs/interface-production.md`의 함수 형식으로만 가져오고, **지금은 목업**을 쓴다 (목업도 같은 함수 이름·타입)
  - 합칠 때 맞출 규칙은 `docs/integration-notes.md`에 정리하고, 규칙이 바뀌면 함께 갱신한다

## 내 담당: 경영지원팀

### 입력 항목
숫자, 월 단위, 원 단위

| 구분 | 항목 |
|---|---|
| 목표 | 연간 목표매출액 |
| 매입 | 상품 매입액, 원재료 매입액 |
| 지출 | 경비 지출액, 그 외 지출액 (광고선전비·접대비 등 세부 항목 추가 가능) |
| 매출 | 제품 매출액, 상품 매출액, 용역 매출액 |
| 채권 | 미수금 |

### 기간 기준
- 기본: **분기** (4분기)
- 월별 / 분기 / 연간 전환 가능

### 시각화
원형(도넛) 그래프 선호
- 목표매출 달성률
- 판매처 산업분야별 비중: 상하수도, 발전소, 가스, 오일, 석유, 민간 플랜트, 기타
- 제품 시리즈별 비중

### AI 분석 코멘트
- 이번 분기 부족한 점 · 매출 상황 요약
- 다음 분기 개선점

### 구현 메모 (경영지원팀)
- 스키마: `prisma/schema/management.prisma` (테이블 `mgmt_*`)
- 월별 금액은 임시저장 시 빈 칸을 **0으로 저장**한다 → 입력 폼에서 **"확정" 시 0원 항목이 있으면 확인창**을 띄운다
- 분기 목표가 비어 있으면: (연간 − 입력한 분기 합) ÷ 빈 분기 수, 나머지 원 단위는 마지막 빈 분기에 더함. 4개 모두 입력했는데 합계 ≠ 연간이면 저장 시 경고
- 대시보드 집계는 `status = CONFIRMED`인 달만 사용
- **AI 분석 코멘트(8단계)**: `modules/management/ai/` + `shared/ai/`(server-only 클라이언트, `generateJson()`), 테이블 `mgmt_ai_comment`(다시 분석하면 행 추가, 화면은 최신 1건)
  - ⚠️ **고객사 답변(05-19번) 전까지 샘플 시드 데이터로만 사용** — 실제 재무 데이터를 넣은 DB에서 [분석하기]를 누르지 않는다
  - 입력은 `buildAiInput(summary)` 집계값만 (거래처명·건별 내역·비고·생산팀 목업 제외), 해시가 달라지면 "최신이 아님" 안내. 화면을 열 때는 AI를 호출하지 않는다
  - 카드 위치: 메인(`/`) KPI 바로 아래, 경영지원 상세(`/management`) KPI 위 — 같은 `AiCommentSection` 재사용, 기록은 (연도, 분기)로만 찾으므로 두 화면이 같은 기록을 공유
  - 끝난 분기만, confirm 권한만 생성 (`ai/rules.ts`의 `aiAbilities()` — 화면·Server Action 공용). 월 보기 = 그 달의 분기, 연간·누적 = 확정 월이 있는 마지막 분기
  - 응답 형식(프롬프트 v2): `{ summary[2~3], shortfalls[0~3], improvements[1~3] }`. 프롬프트는 문장 60자, 저장 검증은 80자 — 넘는 문장·3개 초과는 `normalizeAiComment()`가 잘라서 살리고(로그 경고) 요약이 없을 때만 실패. 옛 형식(`summary` 문자열 + `weaknesses`)은 `readStoredComment()`로 **화면 읽기만** 지원, 새로 저장하는 건 새 형식만
  - AI가 계산하지 않도록 입력에 미리 넣는다: 금액 `formatWonShort()`("7.09억원"·"6,668만원"), 목표 차이 `achievementText()`("82.4%로 17.6%p 부족/초과"), 연간 진도 `progressText()`, 기대치 대비 부족액, 매입·경비 합계, 추정 손익, 90일 초과 금액·건수. 산업분야·제품 시리즈 비중은 생산팀 연동 전까지 입력에서 제외 (`build-input.ts`의 TODO 위치에 `is_sample`과 함께 추가)
  - **headline(연간 목표 달성 한 줄)과 장기 미수 거래처명은 AI가 아니라 서버가 만든다** (`ai/annotations.ts`, 생성 시 결과와 함께 저장). 거래처명은 AI 입력에 넣지 않는다 (05-19)
  - 카드 모양: 왼쪽 파란 강조선, 오른쪽 위 "AI 분석/모의 응답 · 생성일시" + [다시 분석], headline, 3단(이번 기간 현황 / 부족한 점·주의 / 다음 분기 개선할 점) • 목록
  - 저장된 코멘트의 `promptVersion`이 현재와 다르면 "분석 기준이 바뀌어…", 입력 해시가 다르면 "데이터가 변경되어…" 안내
  - 모델 `claude-opus-5-5`(`shared/ai/client.ts`), SDK `@anthropic-ai/sdk` 버전 정확히 고정, 구조화 출력 + 거절 시 서버 fallback + Zod 재검증. 프롬프트를 바꾸면 `ai/prompt.ts`의 `PROMPT_VERSION`을 올린다
  - 테스트는 가짜 `create`를 주입 (Vitest에서 `getAnthropicClient()`는 항상 에러 → CI 실제 호출 불가). 로컬 화면은 `.env`의 `AI_MOCK=true`(실패 연습 `fail`) — `next dev`에서만 동작
  - 키 입력: `npm run env:set-key` (값 출력 금지, 길이만)
  - 예시 분석: `npm run seed:ai-examples` (`ai/examples.ts` 문장 틀 + 서버 계산 숫자, `model = "example"`, 카드에 "예시" 표시) / `-- --remove`. **실제 데이터 사용 전 삭제**
- **지표 계산**: `modules/management/metrics/`(순수 함수, DB·화면 모름) + `data/`(DB 조회, server-only). 공개 함수는 `getManagementSummary(period)` (권한: 경영지원 view)
  - 금액은 BigInt, 비율만 number(0~1). 0으로 나누기·데이터 없음은 `null` + `reason`
  - 이익 비용 범위는 `metrics/settings.ts`의 `costMode` (05-3번 답변 전 임시: 매입 포함)
  - 미수금은 기준일 = min(기간 마지막 날, 오늘) 시점 잔액, 경과일은 발생일 기준 (05-17번)
  - **증감 비교는 같은 월끼리**: 현재 기간에 확정 안 된 달(미확정·마감 전)이 있으면 비교 기간도 같은 순서의 달만 집계 (예: 2026 1~8월 ↔ 2025 1~8월, 3분기 7~8월 ↔ 2분기 4~5월). 모든 월이 확정이면 기간 전체 비교. 화면에 "같은 기간 비교 · …" 표시
  - 검산: `npm run metrics:report -- 2026 Q3` (로컬 DB로 계산 결과를 마크다운 표로 출력)
- 생산팀 데이터(산업분야·제품 시리즈 비중) 연동 형식: `docs/interface-production.md` (합의 전 초안)
- **그 외 지출 "사용 여부" = 0원이 아닌 금액이 있는지** (월간 저장 시 0원 행도 생기므로 행 존재로 판단하지 않음): 삭제 가능 여부, 비활성 항목의 월간 입력 표시에 사용
- **입력 화면(6단계)**: `modules/management/entry/` — 규칙은 `rules.ts`의 `entryAbilities()` 하나를 화면과 Server Action이 같이 쓴다. 저장은 Zod 검증 + `updatedAt` 동시 수정 확인(`updateMany where updatedAt`) + `refresh()`
- **엑셀 업로드(7단계)**: `modules/management/upload/`, `/management/upload`, 파일 읽기는 `shared/upload/read-table.ts`(xlsx·csv, .xls 미지원 안내)
  - 열 이름 자동 인식(`columns.ts`), 검증·미리보기·저장 계획(`parse-upload.ts`, 순수 함수) — 미리보기와 저장 모두 서버에서 파일을 다시 읽어 검증, 오류 1건이라도 있으면 저장 불가, 합계 행 제외
  - 저장은 한 트랜잭션(`save-upload.ts`): 월별실적은 **확정으로 덮어씀**, 그외지출액은 '기타(엑셀 이관)' 항목, 그 달 나머지 그 외 지출 항목은 0원. 이력은 `mgmt_data_upload`
  - 업로드로 저장된 달·목표는 `uploadId`가 남고, 그 데이터가 AI 입력에 들어가는 분기는 **[분석하기] 차단**(05-19 동의 전, `hasUploadedInput()`)
  - 권한: 화면·미리보기 = 경영지원 view, 저장 = confirm (`upload/rules.ts`)
- **미수금 관리(6단계 ③)**: `modules/management/receivables/`, `/management/receivables` — 규칙은 `rules.ts`의 `receivableAbilities()`(화면·Server Action 공용). 등록·미수 건 수정·수금 처리 = edit, 수금 완료 건 수정·수금 취소·숨김·복구 = confirm
  - **삭제 대신 숨김**(`deletedAt`·`deletedById`): 미수금을 새로 조회할 때는 **반드시 `deletedAt: null` 조건**을 넣는다 (지표용 `loadReceivables()`는 이미 제외). 숨긴 건은 복구 외 모든 동작 불가
  - 날짜: 발생일·수금일은 오늘 이후 불가, 예정일·수금일은 발생일 이후 (`receivableDateErrors()`), 오늘 = `getTodayKst()`

## 공통 정책

> 권한·계정은 고객사 요구사항 기록용이다. 실제 규칙은 `src/shared/auth/can.ts`와 `docs/integration-notes.md` 8번 (내부 결정, 고객사 확인 대기 — `docs/05-open-questions.md` 14·15번).

### 권한
| 역할 | 권한 |
|---|---|
| 대표 · 관리자 · 경영지원팀 | 전체 권한 |
| 생산팀 · 서비스팀 | 자기 팀만 열람 |
| 각 팀장 | 자기 팀 데이터 수정 가능 |
| 팀원 | 열람만 가능 |

### 계정
- 관리자가 일괄 발급 → 개인이 비밀번호 변경
- 분실 시 관리자가 초기화

### UI
- 다우오피스 스타일 참고
- 한국어
- 금액은 천 단위 콤마 표시 (예: 1,234,000)

## 기술 스택

| 영역 | 선택 |
|---|---|
| 프레임워크 | Next.js 16 (App Router, Turbopack) + TypeScript — `middleware.ts`는 `proxy.ts`로 이름 변경됨, 코드 작성 전 `node_modules/next/dist/docs/` 확인 |
| DB / ORM | Prisma 7.10.1 (정확히 고정) + PostgreSQL 16 — 로컬 PostgreSQL 16 (docker compose 또는 Postgres.app), SQLite 사용 안 함 |
| Prisma 7 변경점 | 접속 URL은 `prisma.config.ts`에서 지정(스키마엔 `provider`만), `.env`는 `dotenv/config`로 로드, 클라이언트는 `@prisma/adapter-pg` 어댑터 필수, generator는 `prisma-client` + `output`(`src/shared/db/generated`) |
| 금액 타입 | Prisma `BigInt` (`Int`는 최대 약 21억 원이라 사용 금지) |
| 차트 | Recharts (도넛 = `PieChart` + `innerRadius`) |
| UI | Tailwind + shadcn/ui |
| 인증 | 자체 구현 (외부 패키지 없음): Node 내장 `crypto.scrypt` 해시 + DB 세션(httpOnly 쿠키) + `shared/auth`의 `can()` |
| 검증 | Zod (폼·업로드·Server Action 공통) |
| 엑셀 | exceljs |
| PDF | pdfjs-dist (텍스트 PDF) / 스캔본은 Claude API로 추출 |
| AI | Anthropic SDK — **server-only**, 클라이언트에서 호출 금지 |

## 폴더 구조

```
newtork-dashboard/ (= 이 폴더)
├─ docs/                      # 기획·회의 문서
├─ prisma.config.ts           # Prisma 7 설정 (스키마 폴더, 마이그레이션 경로, DB URL)
├─ prisma/
│  ├─ schema/
│  │  ├─ base.prisma          # datasource, generator
│  │  ├─ auth.prisma          # auth_user, auth_session (로그인·권한, 공통)
│  │  ├─ management.prisma    # mgmt_* 테이블
│  │  ├─ production.prisma    # (이 저장소에서는 만들지 않음)
│  │  └─ service.prisma       # (이 저장소에서는 만들지 않음)
│  ├─ migrations/
│  └─ seed.ts                 # 경영지원팀 샘플 데이터 (가짜)
├─ src/
│  ├─ app/
│  │  ├─ (auth)/login/        # 로그인 (회원가입 없음)
│  │  ├─ (dashboard)/
│  │  │  ├─ layout.tsx        # 공통 셸: 다우오피스풍 사이드바·헤더
│  │  │  ├─ page.tsx          # 메인 = 전사 요약 (경영지원팀)
│  │  │  ├─ admin/            # 관리자 설정 (관리자만)
│  │  │  ├─ management/
│  │  │  ├─ production/       # placeholder — 수정 금지
│  │  │  └─ service/          # placeholder — 수정 금지
│  │  ├─ account/password/    # 비밀번호 변경 (초기 비밀번호면 강제)
│  │  └─ api/                 # 꼭 필요한 Route Handler만
│  ├─ modules/
│  │  ├─ admin/               # 관리자 설정: 직원 역할·범위, 비밀번호 초기화, 계정 추가·비활성화
│  │  ├─ management/
│  │  │  ├─ components/
│  │  │  ├─ actions.ts        # Server Actions
│  │  │  ├─ queries.ts        # 조회 + 월→분기/연 집계
│  │  │  ├─ schemas.ts        # Zod 스키마
│  │  │  ├─ excel-mapping.ts  # 엑셀 열 → 필드 매핑
│  │  │  └─ index.ts          # 외부 공개 API
│  │  ├─ production/          # placeholder — 수정 금지
│  │  └─ service/             # placeholder — 수정 금지
│  ├─ shared/
│  │  ├─ auth/                # can(user, action, team), 로그인 세션, 비밀번호 해시, getCurrentUser()
│  │  ├─ db/                  # Prisma client (generated/ 는 git 제외)
│  │  ├─ ai/                  # Anthropic 호출 (server-only)
│  │  ├─ upload/              # 엑셀/PDF 파서 공통
│  │  ├─ format/              # 금액 콤마, BigInt 직렬화, 기간(월/분기/연) 유틸
│  │  ├─ lib/                 # cn() 등 공통 헬퍼
│  │  └─ ui/                  # shadcn 컴포넌트, app-shell, DonutChart, KpiCard, PeriodToggle
│  └─ proxy.ts                # 미로그인 → /login, 초기 비밀번호 → /account/password
├─ docker-compose.yml         # 로컬 PostgreSQL (Docker 사용 시, 포트 5433)
├─ .env.example               # 키 이름만 (값 없음)
├─ CODEOWNERS
└─ CLAUDE.md
```

## 담당

| 영역 | 담당 |
|---|---|
| `management/`, 메인 화면, `shared/`, `prisma/schema/base.prisma`·`management.prisma` | 나 (경영지원팀) — **이 저장소의 개발 범위** |
| `admin/`, 로그인·계정 | 나 (경영지원팀) — 2026-10-21 인증 시리즈로 구현, 다른 팀은 `docs/integration-notes.md` 8번 방식으로 붙인다 |
| `production/` (+ `production.prisma`) | 생산팀 담당자 — 각자 저장소에서 개발, 여기서는 placeholder |
| `service/` (+ `service.prisma`) | 서비스팀 담당자 — 각자 저장소에서 개발, 여기서는 placeholder |

## 운영 규칙

- **다른 팀 모듈 폴더 수정 금지**: 내 담당이 아닌 `modules/<팀>`, `app/(dashboard)/<팀>`, `<팀>.prisma`는 수정하지 않는다. 필요한 변경은 해당 담당자에게 요청한다.
- **모듈 간 import 금지**: `modules/<팀>`끼리 직접 import하지 않는다. 공통 코드는 `shared/`에만 둔다. (`eslint-plugin-boundaries`로 검사)
- **연동은 `index.ts` 공개 함수로만**: 메인 대시보드 등에서 다른 팀 데이터가 필요하면 해당 모듈 `index.ts`가 export한 함수(예: `getSalesShareByIndustry(period)`)만 사용한다. 통합 전까지는 `docs/interface-production.md` 형식 그대로의 **목업**을 쓴다.
- **기간 처리**: DB에는 **월 단위로만 저장**하고, 분기·연간은 조회할 때 계산한다.
- **스키마를 바꾼 뒤**: `npm run db:push` → `npm run db:generate` → **dev 서버 재시작**(옛 Prisma 클라이언트가 남아 "Unknown argument" 에러가 날 수 있음 — 2026-10-20) → `npm run db:smoke`(실제 DB로 모든 칸·주요 조회 점검). 보고할 때 "dev 서버 재시작 필요"를 꼭 적는다
- **마이그레이션**: 작업 중에는 `npm run db:push`로 로컬 DB에만 반영하고, 마이그레이션 파일은 **PR 올리기 직전에** `npx prisma migrate dev --name <설명>`으로 1개 생성한다. (`prisma/migrations/`는 git에 포함)
- **권한 확인은 반드시 서버에서, `can()`으로**: 페이지·Server Action·조회 함수 모두 서버에서 `shared/auth`의 `can()`을 호출해 확인한다. 역할 비교를 직접 쓰지 않는다. UI에서 메뉴·버튼을 숨기는 건 보조 수단일 뿐이다.

## 기능 작업 공통 절차

1. `main` 최신화(`git pull`) 후 `feat/<기능명>` 브랜치 생성
2. 코드 작성 전에 **설계안(화면 구성, 파일 목록, 데이터 흐름)과 질문 목록**을 먼저 보여주고 승인받기
3. 구현은 작은 단위로 나누고, 단위마다 `npm run check` 통과 확인
4. 스키마를 바꿨으면 PR 직전에 마이그레이션 생성 (아래 체크리스트)
5. 화면 작업이 끝나면 `npm run dev`로 확인할 **주소와 확인 포인트**를 알려주기
   - 화면을 확인할 때는 HTML 응답뿐 아니라 **dev 서버 로그(`.next/dev/logs/next-development.log`)에 에러·경고가 없는지도 반드시 확인** (cacheComponents 검증 에러는 화면 오버레이·로그에만 나옴)
   - 오늘 날짜가 필요하면 **`getTodayKst()`**, 기록용 현재 시각(확정 일시 등)은 **`getNow()`**만 사용 (`new Date()` 직접 사용 금지 — prerender 에러 원인)
   - 시간대 기준: **시각은 UTC로 저장**(Prisma가 값을 직접 기록), **날짜 계산은 한국 날짜**(`getTodayKst()` = KST 날짜의 UTC 자정), **표시는 Asia/Seoul**. 로컬 DB 세션 시간대가 Asia/Seoul이라 **SQL `now()`·DB 기본값으로 시각을 넣으면 9시간 어긋난다** → 시각은 Prisma로만 넣고, 직접 SQL이 필요하면 `now() AT TIME ZONE 'UTC'`
6. 끝나면 PR 생성 후 **CI 결과 보고**. 머지는 사람이 직접
7. 고객사 확인이 필요한 건 `docs/05-open-questions.md`에 추가
8. 각 단계가 끝나면 `docs/06-management-checklist.md` 상태 업데이트

## PR 올리기 전 체크리스트

- [ ] 스키마(`prisma/schema/*.prisma`)를 바꿨으면 마이그레이션 파일 생성 (`npx prisma migrate dev --name <설명>`) → `npx prisma migrate status`가 "up to date"인지 확인
- [ ] `npm run check` 통과
- [ ] 스키마를 바꿨으면 `npm run db:smoke` 통과 (CI에서도 빈 DB에 마이그레이션 적용 후 실행)
- [ ] **PR의 CI가 통과(✓)한 것을 확인한 뒤 머지** (`.github/workflows/ci.yml` — 비공개 Free 플랜이라 실패해도 머지 버튼이 막히지 않으므로 직접 확인)
- [ ] **main 머지는 사람이 직접 한다. Claude는 PR 생성까지만** (머지·브랜치 삭제는 사람이 머지했다고 알려준 뒤, `gh pr view`로 MERGED 상태를 확인하고 진행)

### 예외: 인증 시리즈 한정 머지 규칙 (2026-10-21 사용자 지시)

**인증 작업 시리즈(PR ① 사용자 모델·로그인·비밀번호 변경 → ② 권한 규칙 교체·라우트 보호 → ③ 관리자 설정 화면)에서만** 아래를 적용한다. 시리즈가 끝나면 위 기본 규칙(사람이 머지)으로 돌아간다.

- `gh`는 `~/.local/bin/gh` (셸 PATH에 `~/.local/bin` 추가, `gh auth status`로 확인). brew로 설치하지 않는다
- **CI ✓ + `npm run check` + `npm run build` + 서버 로그 확인이 모두 통과**하면 Claude가 `gh pr merge --merge`(merge commit)로 머지 → MERGED 확인 → 브랜치 정리 → `main` pull → 다음 PR
- 하나라도 실패하면 머지하지 않고 멈춰서 보고
- dev 서버는 Claude가 띄우지 않는다 — 서버 로그 확인은 임시 DB + `next start`(다른 포트)로 대신하고 끝나면 정리, 화면 확인은 마지막에 사람이 한 번에

## 코딩 규칙

- 금액은 **정수(원)**로 저장(`BigInt`), 소수 계산은 표시 단계에서만
- `BigInt`는 서버→클라이언트 전달 시 `shared/format/bigint.ts`의 `serializeBigInt`로 정수 문자열로 변환, 표시는 `shared/format/money.ts`
- 비밀키는 `.env`에만 보관, 클라이언트로 **절대 노출 금지**
- **작업 전 계획을 먼저 보여주고 승인 후 코드 작성**
- **작업 단계가 끝날 때마다 `npm run check` 통과 확인** (lint + typecheck + test)
- **고객사 확인이 필요한 질문이 생기면 `docs/05-open-questions.md` 표에 추가**

## 미정 사항 (확정 전까지 가정하지 말고 확인할 것)

`docs/05-open-questions.md` 표 참고 — 상태가 "미확인"인 항목은 임의로 가정하지 않는다.
