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
- **인증·계정·권한**: 로그인 방식은 **통합 시 팀과 함께 결정**한다. 지금은 **개발용 임시 사용자**로 진행하되, 권한 확인은 **반드시 `shared/auth`의 `can()` 함수를 거친다** → 나중에 `can()`과 임시 사용자 부분만 실제 로그인으로 교체
  - 현재 사용자: `getCurrentUser()` (cookies를 읽으므로 **`<Suspense>` 안 컴포넌트에서** 호출 — cacheComponents)
  - 동작: `view` / `edit`(입력·임시저장) / `confirm`(확정·설정 변경). 저장 시 `createdById`/`updatedById` = `getCurrentUser().id`
  - 배포 빌드는 `src/proxy.ts`가 기본 차단, `DEMO_MODE=true`일 때만 경영지원 팀장 고정. **실제 로그인 전 외부 공개 배포 금지**
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
- AI 코멘트 저장 테이블은 AI 기능 구현 시 추가
- 생산팀 데이터(산업분야·제품 시리즈 비중) 연동 형식: `docs/interface-production.md` (합의 전 초안)

## 공통 정책

> 권한·계정은 고객사 요구사항 기록용이다. 실제 구현은 통합 시 결정 (위 "이 저장소의 범위" 참고). 지금은 `can()`에 이 표의 규칙을 임시 사용자 기준으로 반영한다.

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
| 인증 | **통합 시 결정** (후보: Better Auth). 지금은 개발용 임시 사용자 + `shared/auth`의 `can()` |
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
│  │  ├─ base.prisma          # datasource, generator (User 등 인증 모델은 통합 시)
│  │  ├─ management.prisma    # mgmt_* 테이블
│  │  ├─ production.prisma    # (이 저장소에서는 만들지 않음)
│  │  └─ service.prisma       # (이 저장소에서는 만들지 않음)
│  ├─ migrations/
│  └─ seed.ts                 # 경영지원팀 샘플 데이터 (가짜)
├─ src/
│  ├─ app/
│  │  ├─ (auth)/login/        # placeholder — 통합 시
│  │  ├─ (dashboard)/
│  │  │  ├─ layout.tsx        # 공통 셸: 다우오피스풍 사이드바·헤더
│  │  │  ├─ page.tsx          # 메인 = 전사 요약 (경영지원팀)
│  │  │  ├─ admin/            # placeholder — 통합 시
│  │  │  ├─ management/
│  │  │  ├─ production/       # placeholder — 수정 금지
│  │  │  └─ service/          # placeholder — 수정 금지
│  │  ├─ account/password/    # placeholder — 통합 시
│  │  └─ api/                 # 꼭 필요한 Route Handler만
│  ├─ modules/
│  │  ├─ admin/               # placeholder — 통합 시
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
│  │  ├─ auth/                # can(user, action, team) + 개발용 임시 사용자 (통합 시 교체)
│  │  ├─ db/                  # Prisma client (generated/ 는 git 제외)
│  │  ├─ ai/                  # Anthropic 호출 (server-only)
│  │  ├─ upload/              # 엑셀/PDF 파서 공통
│  │  ├─ format/              # 금액 콤마, BigInt 직렬화, 기간(월/분기/연) 유틸
│  │  ├─ lib/                 # cn() 등 공통 헬퍼
│  │  └─ ui/                  # shadcn 컴포넌트, app-shell, DonutChart, KpiCard, PeriodToggle
│  └─ proxy.ts                # 배포 빌드 차단 (DEMO_MODE=true 일 때만 통과) → 통합 시 미로그인 차단으로 교체
├─ docker-compose.yml         # 로컬 PostgreSQL (Docker 사용 시, 포트 5433)
├─ .env.example               # 키 이름만 (값 없음)
├─ CODEOWNERS
└─ CLAUDE.md
```

## 담당

| 영역 | 담당 |
|---|---|
| `management/`, 메인 화면, `shared/`, `prisma/schema/base.prisma`·`management.prisma` | 나 (경영지원팀) — **이 저장소의 개발 범위** |
| `admin/`, 로그인·계정 | 통합 시 팀과 함께 결정 |
| `production/` (+ `production.prisma`) | 생산팀 담당자 — 각자 저장소에서 개발, 여기서는 placeholder |
| `service/` (+ `service.prisma`) | 서비스팀 담당자 — 각자 저장소에서 개발, 여기서는 placeholder |

## 운영 규칙

- **다른 팀 모듈 폴더 수정 금지**: 내 담당이 아닌 `modules/<팀>`, `app/(dashboard)/<팀>`, `<팀>.prisma`는 수정하지 않는다. 필요한 변경은 해당 담당자에게 요청한다.
- **모듈 간 import 금지**: `modules/<팀>`끼리 직접 import하지 않는다. 공통 코드는 `shared/`에만 둔다. (`eslint-plugin-boundaries`로 검사)
- **연동은 `index.ts` 공개 함수로만**: 메인 대시보드 등에서 다른 팀 데이터가 필요하면 해당 모듈 `index.ts`가 export한 함수(예: `getSalesShareByIndustry(period)`)만 사용한다. 통합 전까지는 `docs/interface-production.md` 형식 그대로의 **목업**을 쓴다.
- **기간 처리**: DB에는 **월 단위로만 저장**하고, 분기·연간은 조회할 때 계산한다.
- **마이그레이션**: 작업 중에는 `npm run db:push`로 로컬 DB에만 반영하고, 마이그레이션 파일은 **PR 올리기 직전에** `npx prisma migrate dev --name <설명>`으로 1개 생성한다. (`prisma/migrations/`는 git에 포함)
- **권한 확인은 반드시 서버에서, `can()`으로**: 페이지·Server Action·조회 함수 모두 서버에서 `shared/auth`의 `can()`을 호출해 확인한다. 역할 비교를 직접 쓰지 않는다. UI에서 메뉴·버튼을 숨기는 건 보조 수단일 뿐이다.

## 기능 작업 공통 절차

1. `main` 최신화(`git pull`) 후 `feat/<기능명>` 브랜치 생성
2. 코드 작성 전에 **설계안(화면 구성, 파일 목록, 데이터 흐름)과 질문 목록**을 먼저 보여주고 승인받기
3. 구현은 작은 단위로 나누고, 단위마다 `npm run check` 통과 확인
4. 스키마를 바꿨으면 PR 직전에 마이그레이션 생성 (아래 체크리스트)
5. 화면 작업이 끝나면 `npm run dev`로 확인할 **주소와 확인 포인트**를 알려주기
6. 끝나면 PR 생성 후 **CI 결과 보고**. 머지는 사람이 직접
7. 고객사 확인이 필요한 건 `docs/05-open-questions.md`에 추가
8. 각 단계가 끝나면 `docs/06-management-checklist.md` 상태 업데이트

## PR 올리기 전 체크리스트

- [ ] 스키마(`prisma/schema/*.prisma`)를 바꿨으면 마이그레이션 파일 생성 (`npx prisma migrate dev --name <설명>`) → `npx prisma migrate status`가 "up to date"인지 확인
- [ ] `npm run check` 통과
- [ ] **PR의 CI가 통과(✓)한 것을 확인한 뒤 머지** (`.github/workflows/ci.yml` — 비공개 Free 플랜이라 실패해도 머지 버튼이 막히지 않으므로 직접 확인)
- [ ] **main 머지는 사람이 직접 한다. Claude는 PR 생성까지만** (머지·브랜치 삭제는 사람이 머지했다고 알려준 뒤, `gh pr view`로 MERGED 상태를 확인하고 진행)

## 코딩 규칙

- 금액은 **정수(원)**로 저장(`BigInt`), 소수 계산은 표시 단계에서만
- `BigInt`는 서버→클라이언트 전달 시 `shared/format/bigint.ts`의 `serializeBigInt`로 정수 문자열로 변환, 표시는 `shared/format/money.ts`
- 비밀키는 `.env`에만 보관, 클라이언트로 **절대 노출 금지**
- **작업 전 계획을 먼저 보여주고 승인 후 코드 작성**
- **작업 단계가 끝날 때마다 `npm run check` 통과 확인** (lint + typecheck + test)
- **고객사 확인이 필요한 질문이 생기면 `docs/05-open-questions.md` 표에 추가**

## 미정 사항 (확정 전까지 가정하지 말고 확인할 것)

`docs/05-open-questions.md` 표 참고 — 상태가 "미확인"인 항목은 임의로 가정하지 않는다.
