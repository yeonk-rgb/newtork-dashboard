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
| `docs/design-guide.md` | 공통 UI 디자인 가이드 — 색 토큰·타이포·카드·배지·표·도넛 규칙 (팀원 공유용) |
| `docs/render-db-expiry.md` | Render 시험 서버 무료 DB 만료 대응 선택지 (유료·백업 이전·새로 만들기) |
| `docs/user-guide.md` | 경영지원팀 담당자용 사용 안내서 (화면별 사용법·불러오기 2종·자금 수지 예측·적용 기준 설명·AI 켜는 방법·자주 묻는 것, 스크린샷 `docs/user-guide-images/` — 가짜 데이터, Word 는 저장소 밖) |
| `docs/requirements-traceability.md` | 요구사항 대조표 — 처음 문서 3개·기획서·담당자 추가 요청 100항목 (완료 74 / 보류 2 / 범위 밖 24) + 자료 기반 결정 표 |
| `docs/result-report.md` | 결과 보고서 (기획서 순서 — 기대효과는 "확인한 것 / 운영 후 측정 필요" 구분, Word 는 저장소 밖) |
| `docs/client-questions-2026-11.md` | 2차 고객사 확인 요청 정리본 (05-16·30~39, 이번에 반영한 것, 1차 미답 목록) |
| `docs/client-questions-3rd-draft.md` | 3차 확인 요청 초안 (05-41~46 자금 수지 예측 — 아직 보내지 않음, 2차 답변 회신에 붙일 예정) |
| `docs/design-cashflow-forecast.md` | 3~6개월 자금 수지 예측 설계안 (구현은 고객 답변 뒤) |
| `docs/excel-default-font-review.md` | 엑셀 기본 글꼴 Calibri 후처리 검토 — 보류, 다시 할 때 방법·위험·테스트 |

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
- **통합 1단계(2026-11-03 사용자 지시)**: 생산·서비스팀 친구 저장소(lyjradiant-max/newtalk-korea-system, Django+Vue)를 이 저장소로 옮기는 중 — `modules/production`·`modules/service`·`production.prisma`(`prod_*`)·`service.prisma`(`svc_*`)도 수정한다. 지금은 메인 연동(집계 규칙·스키마·가짜 시드)만, 생산·서비스 화면(`app/(dashboard)/production|service`)은 아직 placeholder. 옮길 때는 친구 저장소의 규칙(specs/·`backend/*/dashboard.py`)을 그대로 따르고 바꾸면 사용자에게 먼저 알린다
- **인증·계정·권한** (2026-10-21 실제 로그인으로 교체): 아이디·비밀번호 로그인(회원가입 없음, 관리자가 발급), 외부 패키지 없이 Node 내장 `scrypt` + DB 세션(`auth_user`·`auth_session`, `prisma/schema/auth.prisma`). 권한 확인은 **반드시 `shared/auth`의 `can()` 함수를 거친다**
  - 현재 사용자: `getCurrentUser()` (cookies를 읽으므로 **`<Suspense>` 안 컴포넌트에서** 호출 — cacheComponents). 로그인 안 함·만료·비활성이면 `null`
  - 동작: `view` / `edit`(입력·임시저장) / `confirm`(확정·설정 변경). 저장 시 `createdById`/`updatedById` = `getCurrentUser().id` (외래키 없는 문자열, 시드 데이터는 `"seed"`) — 화면 표시 이름은 `loadUserNames(ids)`
  - `src/proxy.ts`: 미로그인 → `/login?next=…`, 초기 비밀번호 사용 중 → `/account/password?next=…`, 경로 권한(`route-access.ts`): 팀 경로·`/admin`은 권한 없으면 403 화면, 메인은 자기 팀으로 이동. 쓰기는 각 Server Action에서 `can()`으로 다시 확인
  - 권한 규칙(`can.ts`, 2026-10-26 자료 기반 확정 05-14·15): 관리자·경영지원팀 = 모든 팀 view·edit·confirm, 팀장 = 열람 범위 view + 수정 권한 edit·confirm, 팀원 = 열람 범위 view. **예외: 생산은 열람 범위만 있으면 팀장·팀원 모두 edit·confirm**(`types.ts` `VIEWERS_CAN_EDIT`, 2026-11-03 사용자 결정 — 생산팀 저장소 규칙 따름, 관리자 화면에 안내 문구). 비활성·초기 비밀번호 계정은 전부 false. 관리자 설정은 `canManageUsers()`
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
  - ⚠️ **실제 숫자는 꺼둔 상태 유지(05-19 결정 — 대표님 허락 없이 정할 수 없음), 샘플 시드 데이터로만 사용** — 실제 재무 데이터를 넣은 DB에서 [분석하기]를 누르지 않는다. 허락하시면 `AI_ALLOW_REAL_DATA=true` 하나로 켠다
  - 입력은 `buildAiInput(summary)` 집계값만 (거래처명·건별 내역·비고·생산팀 목업 제외), 해시가 달라지면 "최신이 아님" 안내. 화면을 열 때는 AI를 호출하지 않는다
  - 카드 위치: 메인(`/`) **맨 아래 "AI 분석" 영역**(2026-10-25 재구성), 경영지원 상세(`/management`) KPI 위 — 같은 `AiCommentSection` 재사용, 기록은 (연도, 분기)로만 찾으므로 두 화면이 같은 기록을 공유
  - 끝난 분기만, confirm 권한만 생성 (`ai/rules.ts`의 `aiAbilities()` — 화면·Server Action 공용). 월 보기 = 그 달의 분기, 연간·누적 = 확정 월이 있는 마지막 분기
  - 응답 형식(프롬프트 v2): `{ summary[2~3], shortfalls[0~3], improvements[1~3] }`. 프롬프트는 문장 60자, 저장 검증은 80자 — 넘는 문장·3개 초과는 `normalizeAiComment()`가 잘라서 살리고(로그 경고) 요약이 없을 때만 실패. 옛 형식(`summary` 문자열 + `weaknesses`)은 `readStoredComment()`로 **화면 읽기만** 지원, 새로 저장하는 건 새 형식만
  - AI가 계산하지 않도록 입력에 미리 넣는다: 금액 `formatWonShort()`("7.09억원"·"6,668만원"), 목표 차이 `achievementText()`("82.4%로 17.6%p 부족/초과"), 연간 진도 `progressText()`, 기대치 대비 부족액, 매입·경비 합계, 추정 손익, 미수금(외상매출금 기준월·장기 미수금·당월 수금예정·당월 수금 금액·건수 — 프롬프트 v3 `2026-10-26.1`, 단어 정리 `2026-10-26.2`). 산업분야·제품 시리즈 비중은 생산팀 연동 전까지 입력에서 제외 (`build-input.ts`의 TODO 위치에 `is_sample`과 함께 추가)
  - **headline(연간 목표 달성 한 줄)과 장기 미수금 거래처명은 AI가 아니라 서버가 만든다** (`ai/annotations.ts`, 생성 시 결과와 함께 저장 — 2026-10-26부터 외상매출금 장기 미수금 거래처, 경과일 없음. 옛 기록의 `ageDays`는 읽기만). 거래처명은 AI 입력에 넣지 않는다 (05-19)
  - 카드 모양: 연한 네이비 바탕 + 왼쪽 네이비 강조선, 오른쪽 위 "AI 분석/모의 응답 · 생성일시" + [다시 분석], headline, 3단(이번 기간 현황 / 부족한 점·주의 / 다음 분기 개선할 점) • 목록
  - 저장된 코멘트의 `promptVersion`이 현재와 다르면 "분석 기준이 바뀌어…", 입력 해시가 다르면 "데이터가 변경되어…" 안내
  - 모델 `claude-opus-5-5`(`shared/ai/client.ts`), SDK `@anthropic-ai/sdk` 버전 정확히 고정, 구조화 출력 + 거절 시 서버 fallback + Zod 재검증. 프롬프트를 바꾸면 `ai/prompt.ts`의 `PROMPT_VERSION`을 올린다
  - 테스트는 가짜 `create`를 주입 (Vitest에서 `getAnthropicClient()`는 항상 에러 → CI 실제 호출 불가). 로컬 화면은 `.env`의 `AI_MOCK=true`(실패 연습 `fail`) — `next dev`에서만 동작
  - 키 입력: `npm run env:set-key` (값 출력 금지, 길이만)
  - 배포 서버(`next start`)는 `AI_ALLOW_REAL_DATA=true`일 때만 [분석하기] 가능 (`ai/real-data-policy.ts` → `aiAbilities()`의 `realDataBlocked`, 05-19 결정: 기본 `false` 유지). `next dev`·테스트는 영향 없음
  - **관리자(대표) 예외(2026-10-28 사용자 지시 — 관리자 = 대표)**: `canManageUsers()`인 사용자는 배포 서버 차단·업로드 달 차단을 넘어 실행 — `aiAbilities()`가 `consentNotice`를 돌려주고 화면은 [분석하기] 전에 확인창(`window.confirm`), Server Action은 `consent: true` 없으면 거부 + 서버 로그 `[ai-comment] … 관리자(대표) 확인`. 다른 계정은 그대로 차단(안내 "관리자(대표) 계정만…")
  - 예시 분석: `npm run seed:ai-examples` (`ai/examples.ts` 문장 틀 + 서버 계산 숫자, `model = "example"`, 카드에 "예시" 표시) / `-- --remove`. **실제 데이터 사용 전 삭제**. 2026-10-28부터 시드 8개 분기 전부(기본 화면 2026년 3분기 포함 — 누르지 않아도 보이게), 배포 빌드는 `seed:ai-examples:if-enabled`(`render.yaml` `SEED_AI_EXAMPLES=true`일 때만, 확정 데이터 없는 분기는 건너뜀) — 실제 데이터 전에는 `false`로 바꾸고 `--remove`. 결과가 있으면 카드 아래 차단 안내는 숨김
- **지표 계산**: `modules/management/metrics/`(순수 함수, DB·화면 모름) + `data/`(DB 조회, server-only). 공개 함수는 `getManagementSummary(period)` (권한: 경영지원 view)
  - 금액은 BigInt, 비율만 number(0~1). 0으로 나누기·데이터 없음은 `null` + `reason`
  - 이익 비용 범위는 `metrics/settings.ts`의 `costMode` (05-3 결정: 매입 포함 = 매입액은 원가)
  - **미수금 = 경영지원 관리 외상매출금 (2026-10-26 결정 05-22, 결정 반영 PR ②)**: `metrics/ar-receivables.ts`(순수 함수) — 기준월 = 기간 안에서 오늘이 속한 달까지 외상매출금 행이 있는 마지막 달(없으면 "입력 없음", 다른 기간 값을 끌어오지 않음), 미수 = 장기 미수금 + 당월 수금예정, 당월 수금은 따로(미수금 아님), 기준일 = min(기준월 말일, 오늘). 경과일 구간(90일 초과 등) 대신 담당자가 정한 "장기 미수금". 수금 예정은 당월 수금예정 행의 예정일. 조회 `loadArEntries(year)`(`deletedAt: null`). 요약 입력 `SummaryInput.receivables` = 외상매출금 행
  - 미수금 건별 기록은 **참고용**(사이드바 "미수금 건별 기록"): 건별 계산은 `computeItemReceivables`(경과일 발생일 기준, 05-17) — 화면·건별 엑셀(`?kind=receivables`)만 쓴다. 화면 맨 위에 "대시보드는 외상매출금 기준" + 같은 기준일의 외상매출금 미수 ↔ 건별 합계 차이 안내(막지는 않음)
  - **증감 비교는 같은 월끼리**: 현재 기간에 확정 안 된 달(미확정·마감 전)이 있으면 비교 기간도 같은 순서의 달만 집계 (예: 2026 1~8월 ↔ 2025 1~8월, 3분기 7~8월 ↔ 2분기 4~5월). 모든 월이 확정이면 기간 전체 비교. 화면에 "같은 기간 비교 · …" 표시
  - 검산: `npm run metrics:report -- 2026 Q3` (로컬 DB로 계산 결과를 마크다운 표로 출력)
- **손익분기점(BEP) 달성률(2026-10-25)**: 계산 `metrics/break-even.ts`(순수 함수, `PeriodCore.breakEven`), 카드 `bepDonut()`(`components/donuts/donut-cards.ts`) — 메인 2줄(연간 목표 옆, 2×2), 상세 `/management#break-even` 계산 내역 표(`components/detail/break-even-table.tsx`)
  - 확정된 달 합계로 한 번 계산(월별 평균 아님): 공헌이익 = 매출 − 변동비, **달성률 = 공헌이익 ÷ 고정비**, BEP 매출 = 고정비 × 매출 ÷ 공헌이익(BigInt, 원 단위 올림). 비용 범위는 `costMode`와 같음 → 변동비 + 고정비 = 이익 계산 비용이라 **달성률 ≥ 100% ⇔ 흑자** (테스트로 고정)
  - 분류는 **`metrics/settings.ts`의 `breakEven` 한 곳** (2026-10-26 결정, 회계 관행): 매입 = 변동비(05-3), 경비 지출 = 고정비(05-36), 그 외 지출 항목 = 고정비(05-35 — 시드 광고선전비·접대비·차량유지비도 고정비, 미분류도 고정비). 그 외 지출 항목은 목표·항목 설정의 고정비/변동비로 바꿀 수 있음. 화면 "적용 기준" 배지 + [계산 기준] = `appliedBasis`(= `APPLIED_BASIS`)
  - 예외(`reason`): no-data / no-revenue / no-fixed-cost / not-reachable(공헌이익 ≤ 0 → 가운데 "도달 불가", 변동비 한 조각 매출 대비)
  - 이전 기간 대비 변화(%p)·AI 연결은 후속 (06)
- **경영 대시보드 재구성(2026-10-25 담당자 요청, PR 1 = 계산·표시 모델, PR 2 = 화면)**: 메인 순서 KPI 4개(매출·지출·추정 이익·미수금) → 분기별 목표 달성 현황(목표매출 달성률·매출 구성·지출 구성 도넛) → 추이 및 분석(매출·지출 추이 막대+선, 산업 분야별·제품별 매출 도넛) → AI 분석(맨 아래). 빠진 카드는 상세 `/management` 관련 표 옆으로 옮김(삭제 없음, `components/detail/detail-cards.tsx`): 이익 구조 → 이익 계산 옆, 연간 목표 달성률 → 분기별 목표 옆, BEP → `#break-even` 계산 내역 표 위(`#break-even`은 카드+표를 감싼 곳), 미수금 원형 → 미수금 영역 첫 줄. 메인 화면 조립은 `components/dashboard/main-dashboard.tsx`·`main-kpis.tsx`(숫자는 표시 모델에서만), 강조 카드는 목표매출 달성률(안에서는 빨간 글씨 대신 "▼ 미달" 배지). `DonutCard`에 `legend="amount-first"`·`layout="stacked"`·조각 `hint` 추가(기본값은 예전과 같음). 미수금 상위 거래처 5는 메인에서 빠짐(상세에 전체 표)
  - 표시 모델 `components/dashboard/model.ts`(순수 함수, summary 값 그대로 — `model.test.ts`가 같은 값인지 고정), **이름은 `labels.ts` 한 곳**·화면 표시 층에서만(metrics 이름표 그대로 → AI 입력 해시 유지)
  - 월 목표 = 분기 목표 ÷ 3 자동(`allocateMonthTargets`, 나머지 원은 분기 마지막 달 — 분기 배분과 같은 `splitEvenly`), `TargetResult.monthTargets`·`month`(월 보기만). 직접 입력 칸은 만들지 않음 (05-16 결정)
  - 추정 이익 = `profit.profit`(지금 비용 기준에서 매출 − 지출과 정확히 같음, 테스트 고정), 비교는 금액 차이 `Comparison.profitDiff`. 목표 분기 목록은 끝났고 3개월 모두 확정인데 미달일 때만 빨강(미확정 달이 있으면 안내만)
- **자료 기반 결정(2026-10-26)**: 고객사 추가 답변은 받지 않고 05의 열린 질문을 결정으로 닫음. 결정 반영 PR ①~⑥ (06 "결정 반영 PR 순서")
  - **적용 기준**: 화면에 "임시 기준·고객사 확인 중"은 쓰지 않고, 정한 기준을 "적용 기준"으로 남긴다 — 문구는 `metrics/settings.ts`의 `APPLIED_BASIS` 한 곳(BEP 카드·계산 내역 표·리포트 각주). 담당자가 다르게 원하면 설정값과 이 문구를 함께 바꾼다. 금액 기준: 월간 입력(매출·매입·경비) = 공급가액(부가세 제외), 미수금·외상매입금·미지급비용·자금 수지 예측 = 실제 주고받는 금액(부가세 포함)
  - 입력·수정 화면 제목 아래 "작업 내용은 변경 이력에 기록됩니다" = `shared/ui/audit-notice.tsx`의 `<AuditNotice />` (월간 입력·목표·경영지원 관리·이관·업로드·미수금·관리자 설정)
  - **인당 생산성**: 목표·항목 설정 "직원 수"(`AnnualTarget.headcount Int?`, 연도별 선택, 목표와 함께 저장·변경 이력 "직원 수") → `metrics/productivity.ts`(확정된 달 합계 ÷ 직원 수, 원 단위 반올림, `reason` no-headcount/no-data) → `ManagementSummary.productivity` → 상세 BEP 카드 옆 `ProductivityCard`. 시드 12명
  - 프로젝트별 원가·이익률, 수주 잔고 & 영업 파이프라인 = 자료 부족으로 보류, 생산량·가동률 = 생산팀, 그룹웨어 연동 = 통합 단계 (06)
- **화면 단어(2026-10-26 담당자 요청)**: 화면·엑셀·변경 이력·AI 문장의 단어는 담당자님 자료 단어 — 경영지원 관리(옛 채권·채무), 장기 미수금, 당월 수금, 당월 수금예정, 미수금 건별 기록(옛 미수금 관리), 자금 수지 예측. **단어는 `modules/management/terms.ts`의 `TERMS` 한 곳**(사이드바 `shared/auth/access.ts`는 shared라 글자로 두고 `terms.test.ts`가 같은지 고정, 같은 테스트가 src 코드(주석 제외)에 옛 단어가 다시 들어오면 실패). 주소·코드 이름·DB 값·파일명 `경영지원_관리_*.xlsx`·엑셀 메모 판별 글자("장기미수금"·"수금된"·"수금예정")는 그대로. 리포트 시트 "경영지원 관리 2026-10"·"경영지원 관리 상세", 예전 "채권·채무 2026-10"도 `selectLedgerSheet`가 이름 끝 기준년월로 고름. AI 프롬프트 `2026-10-26.2`
- **3~6개월 자금 수지 예측(2026-10-26 결정 05-41~46, PR ⑤)**: 계산 `metrics/cash-forecast.ts`(순수 함수 `computeCashForecast`), 조회 `data/load-cash-forecast.ts`, 공개 `getCashForecast()`(경영지원 view, **오늘 기준 — 고른 기간과 무관**), 화면 `/management#cash-forecast`(`cash-forecast-section.tsx`, 미수금 아래). 규칙 표는 `docs/design-cashflow-forecast.md` 맨 위 — 다음 달부터 최대 6개월(기본 3), 예정 = 경영지원 관리 기준월 B 행(외상매출금 당월 수금예정 / 외상매입금·미지급비용 — 예정일 없으면 B+1), 추정 = B+2 달부터 최근 확정 3개월 평균(매출·매입·그 외 ×1.1, 경비 그대로), 장기 미수금 제외, 부가세 포함 금액. 기준 문구 `settings.ts` `CASH_FORECAST_BASIS`, 설정 `cashForecast`. 엑셀·리포트·AI·메인에는 아직 넣지 않음
  - **월말 통장 잔액**: `MonthlyFinance.cashBalance BigInt?`(마이그레이션 `20261026120000_monthly_cash_balance`), 월간 입력 맨 아래 "자금 (선택)" — 빈칸 = null(0원과 다름), 합계·확정 0원 확인·엑셀 업로드·월간 입력 엑셀에 넣지 않음, 변경 이력 "월말 통장 잔액"(확정·확정 후 수정 때), 브라우저 임시 보관 `cash`. 예상 잔액 = 이번 달까지 가장 최근 값(임시저장 달 포함) + 누적 순수지
- **생산·서비스 메인 연동(2026-11-03 통합 1단계)**: 형식 `docs/interface-production.md`. `page.tsx`가 `modules/production`·`modules/service` `index.ts`를 불러 `MainDashboard`의 `teams`로 넘긴다(모듈끼리 import 금지). 목업(`production-mock.ts`·`align-mock.ts`)은 삭제
  - 산업 분야별·제품별 도넛 = **확정 출고 수량 기준**(생산팀 자료에 금액 없음, 05-10 갱신) — 출고일자 기준, 수량 미확정 행·사업구분 미분류 수량은 조각에 넣지 않고 "제외:" 안내, 제품 = 모델명(C열) 원본 값, 색은 `seriesColors()`(모델명 오름차순)
  - 메인 순서에 **④ 팀별 현황**(추이 및 분석 아래, AI 분석 위): 생산(확정 출고 수량·목표 달성률·납기 일정/출고 대기) / 서비스(출장 건수·유상 비율·수리 제품). 표시 모델 `productionCardModel`·`serviceCardModel`(`components/dashboard/model.ts`), 카드 `team-card.tsx`
  - 가짜 데이터: `npm run seed:teams`(`-- --remove`) — 작성자 id `seed-production`·`seed-service`면 "샘플 데이터" 배지. **실제 데이터 전에 삭제**
  - AI 분석 입력에는 아직 넣지 않음 (`build-input.ts` TODO 그대로)
- **생산 화면 이식 ②-a(2026-11-03)**: 친구 저장소 규칙 그대로 + 이 저장소 규칙(숨김·변경 이력). 권한 `production/rules.ts`의 `productionAbilities()`(화면·Server Action 공용)
  - **제조내역 엑셀 업로드** `/production/upload`(`upload/`): 양식 `columns.ts`(8~9행 머리글 B~Y, 10행부터, J8 "뉴토크 번호"), 파서 `parse-sheet.ts`(순수 함수 — 날짜 못 읽으면 비우고 경고, 부시 가공 숫자 셀 6자리 복원, 일련번호·모델명 숫자 셀 경고, 일련번호 없는 행 건너뜀, 파일 안 중복 오류), 판정 `classify.ts`(키 = 시트 + 일련번호, 새로 / 값이 다름 / 변경 없음 / **숨긴 행과 같음 = 저장 안 함**), 저장 `save-upload.ts`(Serializable 트랜잭션 안에서 다시 판정, 같은 파일 SHA-256 차단, 바뀐 행은 체크한 것만·엑셀 칸만 덮어씀 — 수량 유지, 변경 이력 요약 1건 `area: "production"`·`screen: "production-upload"`). .xlsx만·5MB. 파일 읽기는 `shared/upload/read-table.ts`
  - **제조내역** `/production/records`(`records/`): 필터(검색·모델명·사업구분·출고 여부·출고일 기간)는 주소 GET, 50행씩. [수정] 창(시트·일련번호 제외 전 칸 + 수량 + 사업구분 — 고친 칸의 변환 경고는 지움, `updatedAt` 동시 수정 확인), **삭제 대신 숨김**(`deletedAt` — 조회 시 반드시 `deletedAt: null`, 지표 `loadRecords()`도 제외)·복구. 변경 이력 `production-records`
  - **사업구분 지정** `/production/categories`(`categories/`): 수주번호별 행 수·판매처·최종발주처, 고르면 바로 저장(`setOrderCategory`, 숨기지 않은 제조내역에 있는 수주번호만). 변경 이력 `production-categories`
  - 변경 이력 화면: `AuditArea`에 `"production"` 추가, 관리자(대표)가 아니면 `TEAM_AREAS`(경영지원 + 생산)만 (`history/rules.ts`)
  - 모달은 `shared/ui/modal.tsx`(경영지원 미수금에서 옮김 — 팀 공통)
- **그 외 지출 "사용 여부" = 0원이 아닌 금액이 있는지** (월간 저장 시 0원 행도 생기므로 행 존재로 판단하지 않음): 삭제 가능 여부, 비활성 항목의 월간 입력 표시에 사용
- **입력 화면(6단계)**: `modules/management/entry/` — 규칙은 `rules.ts`의 `entryAbilities()` 하나를 화면과 Server Action이 같이 쓴다. 저장은 Zod 검증 + `updatedAt` 동시 수정 확인(`updateMany where updatedAt`) + `refresh()`
  - **[경영지원 관리에서 불러오기](2026-10-26 결정 05-1·24·25, PR ③)**: 계산 `entry/from-ledger.ts`(순수 함수), 행 읽기 Server Action `loadLedgerForEntry`(읽기만, `entryAbilities`가 readOnly면 거부, 숨긴 행·외상매출금 제외), 미리보기 `from-ledger-dialog.tsx`. 외상매입금 → 상품·원재료 매입(매입유형, 빈 행은 고른 칸), 직원 → 경비, 업체 → 그 외 지출(같은 이름 항목, "기타"는 "기타…" 항목, 없으면 고름). **업체는 자동이체 포함 전체 합계**(F열 총액·자동이체 합계도 표시). 블록별 ÷1.1 체크(외상매입금·업체 기본 체크, 직원 해제), 칸 단위 반올림(`toSupplyAmount`). [입력란에 채우기]는 저장하지 않음 — 저장·변경 이력은 기존 [임시저장]·[확정] 그대로
- **엑셀 업로드(7단계)**: `modules/management/upload/`, `/management/upload`, 파일 읽기는 `shared/upload/read-table.ts`(xlsx·csv, .xls 미지원 안내)
  - 열 이름 자동 인식(`columns.ts`), 검증·미리보기·저장 계획(`parse-upload.ts`, 순수 함수) — 미리보기와 저장 모두 서버에서 파일을 다시 읽어 검증, 오류 1건이라도 있으면 저장 불가, 합계 행 제외
  - 저장은 한 트랜잭션(`save-upload.ts`): 월별실적은 **확정으로 덮어씀**, 그외지출액은 '기타(엑셀 이관)' 항목, 그 달 나머지 그 외 지출 항목은 0원. 이력은 `mgmt_data_upload`
  - 업로드로 저장된 달·목표는 `uploadId`가 남고, 그 데이터가 AI 입력에 들어가는 분기는 **[분석하기] 차단**(`hasUploadedInput()` → `isUploadedDataBlocked()` — 개발 서버에서도 막음). **`AI_ALLOW_REAL_DATA=true` 하나로 이 차단과 배포 서버 차단을 함께 푼다** (2026-10-26 결정, `ai/real-data-policy.ts`, 테스트 고정)
  - 권한: 화면·미리보기 = 경영지원 view, 저장 = confirm (`upload/rules.ts`)
- **미수금 건별 기록(6단계 ③)**: `modules/management/receivables/`, `/management/receivables` — 규칙은 `rules.ts`의 `receivableAbilities()`(화면·Server Action 공용). 등록·미수 건 수정·수금 처리 = edit, 수금 완료 건 수정·수금 취소·숨김·복구 = confirm
  - **삭제 대신 숨김**(`deletedAt`·`deletedById`): 미수금을 새로 조회할 때는 **반드시 `deletedAt: null` 조건**을 넣는다 (지표용 `loadReceivables()`는 이미 제외). 숨긴 건은 복구 외 모든 동작 불가
  - 날짜: 발생일·수금일은 오늘 이후 불가, 예정일·수금일은 발생일 이후 (`receivableDateErrors()`), 오늘 = `getTodayKst()`
- **경영지원 관리(2026-10-24 1단계)**: `modules/management/ledger/`, `/management/ledger`, 테이블 `mgmt_ledger_entry`(모델 `LedgerEntry`) — 고객사 엑셀 `경영지원_관리.xlsx`를 옮긴 화면이라 **항목명·구분·열 순서는 엑셀과 같게** 둔다 (`labels.ts`)
  - 기준년월(`year`·`month`)별 거래처 잔액. 구분 4개(외상매출금 / 외상매입금 / 미지급비용-직원 / 미지급비용-업체)를 한 테이블에 두고, 구분마다 쓰는 칸(`arStatus`·`partnerCode` / `purchaseType` / `expenseType`·`autoTransfer`)은 `schemas.ts`의 discriminated union + `toLedgerData()`로 나머지를 null 처리
  - 거래처코드는 외상매출금만, 선택, 입력하면 숫자 10자리 **문자열**(앞자리 0 유지). 당월 수금은 완료일 필수(오늘 이후 불가), 다른 외상매출금 상태엔 완료일 불가 (`ledgerDateErrors()`)
  - 권한 `ledgerAbilities()`(화면·Server Action 공용): 열람 = 경영지원 view, 추가·수정 = edit, 숨김·복구 = confirm. 고객사 원문 "경영지원팀장만 수정"은 05-14·15에서 경영지원팀 전원 + 관리자(대표)로 확정 (2026-10-26)
  - 삭제 대신 숨김(`deletedAt`) — 조회 시 `deletedAt: null`. 샘플은 `npm run seed:ledger`(작성자 `seed-ledger`, `-- --remove`로 삭제)
  - **외상매출금 = 대시보드·리포트 미수금** (2026-10-26, 05-22 — 위 "지표 계산"). 잔액은 ERP 잔액 그대로(부가세 포함). 총액 ↔ 월간 입력 불러오기(05-24)·전월 이월(05-23)은 결정 반영 PR ③·④
  - 시드: `prisma/seed.ts`의 `seedLedgerHistory()` — 시드 24개월 경영지원 관리(외상매출금 = 건별 시드의 월말 잔액, 외상매입금·업체 = 월간 입력 × 1.1, 직원 = 경비 그대로). 이미 행이 있는 달은 건너뜀
  - 미지급비용-업체 합계는 3줄: 총액(자동이체 제외 = 엑셀 F열 SUM(D67:D79)과 같은 값) / 자동이체 합계 / 전체 합계 (`vendorTotals()`, 05-25)
- **[지난달 내용 불러오기](2026-10-26 결정 05-23, PR ④)**: `ledger/copy-previous.ts`(순수 함수 `planCopy`) + `copy-actions.ts`(미리보기 `previewCopyPrevious` 읽기만 / 저장 `copyPreviousMonth`) + `copy-previous-dialog.tsx`. 버튼은 이번 달에 숨기지 않은 행이 하나도 없을 때만(중복 방지 — 저장 때도 Serializable 트랜잭션 안에서 다시 확인, 지난달 행 수가 미리보기 때와 다르면 CONFLICT). 지난달 숨기지 않은 행을 순서대로 복사(createdAt +1ms), 완료일은 모두 비움, 당월 수금 행 기본 제외(포함하면 당월 수금예정으로). 권한 = 행 추가와 같음(`canCreateLedgerEntry`). 변경 이력 요약 1건 `screen: "ledger-copy"`, `action: "CREATE"`, target `LedgerMonth`
- **경영지원 관리 엑셀 이관(2026-10-25 2단계)**: `ledger/import/`, `/management/ledger/import` — 고객사 원본 양식 기준 (`ledger/export/ledger-template.xlsx` — 3단계 다운로드가 실행 중에 읽는 원본, 가짜 데이터 `ledger-sample.xlsx`·경고 확인용 `ledger-sample-issues.xlsx`는 `scripts/make-ledger-fixture.ts`로 생성). **PDF 변환본은 병합·색·수식이 없어 기준 자료로 쓰지 않는다**
  - 읽기는 `shared/upload/read-styled-sheet.ts`(병합·글자색·배경·수식·숨김 열), 해석은 `parse-ledger-sheet.ts`(순수 함수): C열 제목 글자로 블록 찾기(행 번호 고정 아님), 다음 행 머리글 확인, 거래처명·잔액 둘 다 비면 건너뜀(코드만 있으면 "코드만 있는 행"으로 안내), 0원 제외, 음수·소수·글자 금액은 오류
  - 외상매출금 상태 = 그룹(F열 병합 범위, 또는 병합 없는 F열 SUM 칸 = 1행 그룹 — 다운로드 파일)의 H열 메모(공백 무시) → 빨간 글씨(FF0000)는 장기 미수금(다른 그룹이면 경고). 판별 안 되면 미분류 → 미리보기에서 골라야 가져오기 가능. **빨간 글씨 판별은 외상매출금 블록에서만** (업체 D77:E79는 무시, 05-28)
  - 당월 수금 완료일: 그 그룹 적요가 날짜면 기준년도 날짜로 후보 — **기준월 안·오늘 이전일 때만**(밖이면 "적요 날짜(10/15)가 기준월 밖이라 사용하지 않음" 표시), 아니면 min(기준월 말일, 오늘) — 모두 "확인 필요" 표시. 적요 원문은 날짜면 엑셀 표시대로 글자("10/15")로 보존
  - 자동이체 = 적요에 "자동이체" 또는 연두 배경(원본은 **테마 색 9번**, 직접 색이면 초록 성분이 가장 큰 색)
  - 원본 총액은 F열 병합 첫 칸의 계산값과 그 범위 행 합계 비교(`match`/`mismatch`/`noResult` 파일에 계산값 없음/`noTotal` 장기 미수금 F3:F4처럼 수식 없음). **원본 빈 양식의 F열 수식은 계산값 0이 저장돼 있다** — exceljs는 계산값 0을 `cell.value`에서 빼므로 `read-styled-sheet.ts`는 `cell.result`로 읽는다 (2026-10-25 정정)
  - 미리보기는 DB 쓰기 없음. 가져오기는 파일을 다시 보내 서버가 다시 읽고(파일 sha256·기존 행 수가 미리보기 때와 같아야 함) `buildImportPlan()`으로 다시 검증 → Serializable 트랜잭션: 덮어쓰기면 같은 달 행 숨김 → `mgmt_data_upload`(detail: 기준년월·방식·블록 합계·해시) → 행 저장(`uploadId`, 엑셀 순서대로 createdAt +1ms)
  - 권한 `importAbilities()`: 올리기·미리보기·추가 = edit, 덮어쓰기 = confirm
  - 여러 시트 파일: 양식 시트(C열 "외상매출금" 제목)만 후보, 1장이면 그 시트 → 기준년월과 같은 이름("2026-10") → 없으면 선택 (`selectLedgerSheet()`), 고른 시트 이름이 기준년월과 다르면 안내
- **경영지원 관리 엑셀 다운로드(2026-10-25 3단계)**: `ledger/export/`, `GET /api/management/ledger/export?period=2026-10|2026-Q4|2026` (경영지원 view, `Cache-Control: no-store`, 서버 로그 `[ledger-export]`), 화면 [엑셀 다운로드 ▾]
  - 서식은 **원본 양식 파일 `ledger/export/ledger-template.xlsx`를 실행 중에 읽어** 역할 → 원본 셀 표(`template.ts`의 `ROLE_CELLS`)로 복사한다. 원본 시트를 고치지 않고 새 시트를 그린다(행 삽입은 병합을 못 옮김). 병합은 `mergeCellsWithoutStyle`(그냥 `mergeCells`는 첫 칸 서식을 범위 전체에 복사해 총액 테두리가 깨짐)
  - 배포 결과물 포함: `next.config.ts`의 `outputFileTracingIncludes` + 읽는 경로를 문자열 그대로(`readTemplateFile`) — 변수 경로면 Turbopack이 프로젝트 전체를 trace. 파일이 없으면 503 "양식 파일을 찾을 수 없습니다"
  - 배치(`layout.ts`, 순수 함수): 그룹마다 max(데이터 수, 1)행, F열 그룹 병합 + `=SUM` + 계산값, H열 메모는 그룹 가운데 행, 장기 미수금 F열에도 SUM, 업체는 자동이체 행 위(E:F 병합, 적요 원문을 텍스트 `@`로)·총액은 자동이체 제외·H·I열에 "자동이체 합계 / 전체 합계"(I열 너비는 금액에 맞춰 넓힘). A열 숨김 + 텍스트 서식. 사용 열에 맑은 고딕 열 서식(exceljs 기본 글꼴 Calibri 대신)
  - 인쇄: A4, 너비 1페이지에 맞춤·높이 자동 — 월별 시트 세로, 상세 시트 가로 (`printSetup()`). 통합 문서 기본 글꼴은 exceljs가 Calibri로 고정 — 후처리는 보류(`docs/excel-default-font-review.md`) — 사용 열에 맑은 고딕 열 서식으로 대신
  - 시트: 당월 1장 / 분기·연간은 데이터 있는 달만(없으면 빈 양식 1장, 이름 = 기간) + 맨 뒤 "상세"(원본에 없는 칸). 숨긴 행 제외. 파일명 `경영지원_관리_{기간}.xlsx`
  - 테스트: 원본 서식 대조(역할별), 왕복(다운로드 → `parseLedgerSheet` → 같은 행·상태·금액·코드, 총액 전부 match)
- **경영지원 엑셀 내보내기(2026-10-25 PR ① 공용 엔진 + 월간 입력)**: 공용 `modules/management/export/`, `GET /api/management/export?kind=entry&period=2026-10|2026-Q3|2026|2026-YTD10` (경영지원 view, `no-store`, 서버 로그 `[mgmt-export]`, 변경 이력 `screen = entry-export` — 기록 실패 시 503)
  - **원본 경영지원_관리.xlsx 와 "같은 사람이 만든 파일"처럼**: 원본 파일을 불러와(`openTemplateWorkbook` — 새 통합 문서로 만들면 테마가 바뀌어 머리글 회색 E7E6E6·연두 테마 9가 다른 색이 됨) 원본 셀 서식을 역할별로 복사(`readRoleStyles`), 시트를 새로 그린다. 새 색·글꼴을 만들지 않음 (빨간 글씨도 원본 C3 색 `warnColor`). 문서 속성은 `WORKBOOK_AUTHOR`(원본 작성자·수정자 개인 이름 남기지 않음)
  - 배치는 `blocks.ts`의 `SheetBuilder`(순수 함수): 제목(C:F 병합) → 머리글 → 그룹(F열 병합 + `=SUM` + 계산값, 가운데 행 H열 "← 메모") → 빈 행(원본 38·50·63행 높이). 숫자가 더 필요하면 열을 끼우지 않고 행으로 풀거나 H 라벨 + I 금액. 경영지원 관리 다운로드도 같은 엔진 (`ledger/export/__snapshots__` 결과물 스냅샷 — 리팩터링만 했으면 갱신 금지)
  - 기간·이름 `export/period.ts`: 시트 이름 = 기간("2026-Q3", 누적 "2026-01~10"), 파일 `경영지원_{화면}_{기간}.xlsx`, 메모 기간 "당월/3분기/2026년/1~10월"
  - 월간 입력(`entry/export/`): 당월 = 월 시트 1장, 분기·연간·누적 = 맨 앞 합계 시트 + 데이터 있는 달(임시저장 포함). **합계는 확정 월만**(대시보드와 같은 숫자), 월 시트 H1 상태(임시저장·입력 없음 빨간 글씨), 합계 시트 H2 "제외: 9월 임시저장". 항목 이름은 고객사 문서 표기 — 월 시트 "월간 상품 매입액", 합계 시트 "상품 매입액" + 제목 "(2026년 3분기 합계)", H 메모 "← 당월 매입 (월간 입력)"(경영지원 관리 "← 당월 매입 지출"과 구분)
  - 인쇄: 월간 입력·목표·미수금·경영지원 관리(월별·상세) 시트 모두 **A4 가로** + 너비 1페이지 맞춤 (2026-10-25 Excel 측정: 세로는 약 60~70%, 가로는 100%. 경영지원 관리 월별 시트는 2026-10-26 세로→가로, 스냅샷은 인쇄 방향 1칸만 바뀜). 월별 리포트 시트만 블록 단위 쪽 나눔이라 고정 배율
  - 확인: `npm run export:report -- [entry|targets|receivables|report] 2026-Q3 [폴더]`(읽기만 — 원본 ↔ 새 파일 셀 단위 비교표, 엑셀 숫자 ↔ 대시보드 화면 숫자, 파일 저장). 테스트는 "의도하지 않은 차이 0건"(`compare.ts`)·테마·문서 속성·합계 = 화면 숫자를 고정
  - **PR ②(2026-10-26) 목표 대비 실적·미수금**: 공용 쌓기형 엔진 `export/stacked.ts`(`buildStackedWorkbook` — 일반 행 = 원본 C41~F41, 빨간 행 = 장기 미수금 C3~F3, I열 보조 금액·비율, 목록형 시트), 비교 `export/compare-stacked.ts`
    - 목표 대비 실적(`settings/export/targets-layout.ts`, `?kind=targets` — 어떤 기간이든 그 해 시트 "2026", 파일 `경영지원_목표실적_2026.xlsx`): "연간 목표매출액"(1~4분기 목표 F = SUM) → "목표매출 달성률"(월 행 + 분기 그룹 F = SUM, 적요 "월 목표 234,166,666 (분기 ÷ 3)", 임시저장 = D 빈칸 + 빨간 "임시저장 — 합계 제외"). 분기 메모·빨간색은 **대시보드 `targetCardModel` 그대로**(끝났고 3개월 모두 확정 + 미달만 빨강, 미확정 "(9월 미확정)", 진행 중 "(경과 1/3개월)"). H·I: 연간 실적 합계·목표매출 달성률(분모 = 입력한 연간 목표)·부족분
    - 미수금 건별 기록(`receivables/export/receivables-layout.ts`, `?kind=receivables`, 시트 = 기간 + "미수금 상세" 목록형): 2026-10-26부터 대시보드 미수금(외상매출금)이 아니라 건별 목록 `computeItemReceivables(기준일 = min(기간 말일, 오늘))`, 경과일 그룹 90일 초과(행 전체 빨강) → 61~90 → 31~60 → 0~30, "예정일 지남"은 적요 글자로만, 거래처별 블록 + H·I "90일 초과"·"수금 예정일 지남"
    - 버튼: 목표·항목 설정(그 해), 미수금 건별 기록(이번 달 오늘 기준 / 지난달 말 / 지난 분기 말) — `export/management-export-menu.tsx`. 변경 이력 `targets-export`·`receivables-export`
    - 결과물 고정: `entry/export/__snapshots__`(월간 입력) + `export/__snapshots__`(목표·미수금) + 경영지원 관리 스냅샷 — 공용 엔진만 손댔으면 갱신 금지
    - 확정된 달이 하나도 없는 분기는 달성률(0.0%)을 쓰지 않고 "← 4분기 진행 중 (경과 1/3개월, 확정된 달 없음)" / 끝남 "(7·8·9월 미확정, 확정된 달 없음)" (2026-10-26 — 대시보드 목표 카드도 같은 문장 `QuarterRow.noConfirmedText`, [진행 중] 배지 유지)
  - **PR ③(2026-10-26) 월별 종합 리포트** (`report/report-layout.ts`, `?kind=report`, 파일 `경영지원_리포트_{기간}.xlsx`, 버튼 = 메인·상세 기간 선택 옆 [월별 리포트 엑셀] `export/report-download-button.tsx`): 리포트 시트(이름 = 기간) 블록 순서 = 새 대시보드 — 머리말("경 영 리 포 트" 16pt, 회사명 뉴토크코리아㈜·기간·작성일·작성자 / 집계 기준·비용 기준·확정 현황·생성, 직인·대표자·주소·연락처 없음) → 요약(대시보드 KPI 4개 `dashboardKpis`, F = 직전 기간 대비, H = 전년 동기) → 분기별 목표 달성 현황(`appendTargetBlocks` — 목표 엑셀과 같음) → 매출 → 지출(+ 기타 항목별) → 매출·지출 추이(대시보드와 같은 12개월 표, 그래프 없음) → 참고: 이익 구조(위 칸 가리키는 수식)·BEP(적용 기준, 각주 한 줄씩)·미수금(2026-10-26 외상매출금 기준월 — 원본 외상매출금 블록처럼 장기 미수금 빨간 그룹 → 당월 수금예정 그룹, H·I 미수금 합계 수식·당월 수금). 산업 분야별·제품별·AI 는 넣지 않음
    - 붙는 시트: "경영지원 관리 2026-10"(단독 다운로드와 같은 `addLedgerSheets`, 분기·연간·누적은 데이터 있는 달) · "경영지원 관리 상세" (건별 "미수금 상세"는 2026-10-26부터 넣지 않음). 다시 올리면 `selectLedgerSheet` 가 이름 끝 기준년월로 자동 선택
    - **인쇄: 블록 단위 쪽 나눔** — Excel 은 "페이지에 맞춤"이면 수동 쪽 나눔을 무시(2026-10-26 확인)하므로 리포트 시트만 맞춤 대신 고정 배율(`export/page-plan.ts` `planPages` — 열 너비로 계산, Mac Excel 이 약 1.1배 넓게 그려 숫자 폭 8px 기준) + 인쇄 범위 A:I(빈 열을 넣으면 빈 쪽이 생김) + 블록 앞 쪽 나눔. H열 메모가 잘리지 않게 I열을 넓힌다. 측정: 배율 85%, 리포트 시트 3쪽
    - 경영지원 관리 다운로드에도 연초 누적(`2026-YTD10`, 파일 `_2026-01~10`) 추가
- **변경 이력(2026-10-25 PR ①: 기록 표·공용 부품·경영지원 관리·미수금)**: 표 `audit_log`(`prisma/schema/audit.prisma`, 공용 — 관리자 화면 기록도 담음), 공용 부품 `shared/audit/`
  - 저장 Server Action 은 **원래 저장과 같은 `prisma.$transaction` 안에서 `recordAudit(tx, …)`** 를 부른다 → 기록이 실패하면 저장도 취소. `updatedAt` 동시 수정 확인도 트랜잭션 안(`updateMany` count 0 → `ConflictError` 로 취소)
  - 바뀐 칸만, 화면 표기 그대로: `diffFields(before, after, fields)` + 화면별 "기록할 칸" 목록(허용 목록 — `modules/management/audit-fields.ts`). 금액 `won`("12,500,000원"), 날짜 `date`, 선택값 `labelOf(…)`, 참·거짓 `flag(…)`. 목록에 없는 칸은 기록되지 않는다. 수정인데 바뀐 칸이 없으면 기록하지 않음
  - 금지 칸: password·hash·token·secret·session·salt 등 이름이 changes·meta 에 있으면 `recordAudit` 가 에러(`forbidden.ts`). 비밀번호 초기화는 값 없이 동작만
  - 사용자 표와 외래키 없음: `actorId` + `actorLoginId`(그때 아이디). 시각은 `getNow()`(UTC 저장, 표시는 한국 시간)
  - **수정·삭제 불가**: 마이그레이션의 DB 트리거가 UPDATE·DELETE·TRUNCATE 거부. **`db push` 로는 트리거가 생기지 않는다** → 기록 표가 있는 DB 는 `npm run db:deploy`(마이그레이션) 로 맞추고, `db:smoke` 가 트리거·롤백을 트랜잭션 안에서 점검 후 되돌린다. 테스트·점검은 트랜잭션 안에서 넣고 되돌리기, 로컬 전체 초기화는 `prisma migrate reset`
  - 확인용: `npm run audit:recent [건수] [화면]` (읽기만, 한국 시간). 보는 화면은 PR ③
  - **PR ②(2026-10-25)**: 월간 입력(`entry` — 확정·확정 후 수정·확정 취소만, 임시저장 제외, 바뀌기 전 값은 같은 트랜잭션에서 그 달 값 조회, 그 외 지출은 "그 외 지출 · 항목명")·목표(`targets`, 빈 분기 "자동 배분")·지출 항목(`expense-categories`, 추가·수정·삭제 각각 + 순서 1건)·엑셀 이관 2곳(`ledger-import`·`upload` — 요약 1건, `targetId`·`meta.uploadId` = `mgmt_data_upload.id`)·경영지원 관리 다운로드(`ledger-export` — 기록 실패 시 503으로 다운로드 막음, 서버 로그 유지)
  - **관리자 화면 기록은 `area: "admin"`, `screen: "admin-users"`** (권한 변경 사람별 1건·비밀번호 초기화 `meta.result = "초기화함"`만·계정 생성 아이디·이름·역할만·비활성화·복구, 칸 목록 `modules/admin/audit-fields.ts`). PR ③ 보는 화면은 **`area = "admin"` 행을 관리자(대표)만** 보이게 조회 조건에서 거른다
  - **PR ③(2026-10-25) 보는 화면**: `modules/management/history/`, `/management/history`(사이드바 경영지원 > 변경 이력). 권한·필터는 `rules.ts`(`historyAbilities()` — 열람 = 경영지원 view, 관리자 기록·엑셀 = `canManageUsers()`), **관리자(대표)가 아니면 `historyWhere()`가 어떤 필터에도 `area: "management"`를 붙인다** (화면 목록에서 숨기는 것과 별개로 서버 조회 조건에서 거름)
    - 표기는 `labels.ts`만: 화면 이름 한글(`HISTORY_SCREENS` — 새 화면을 기록하면 여기에 추가), 바뀐 내용 "잔액: A → B"(빈 값 "(없음)"), 추가 정보(meta)는 `metaSummary()`가 한글 문장으로 — **JSON 을 화면·엑셀에 그대로 보여 주지 않는다** (모르는 형식은 표시 안 함)
    - 필터: 기간(기본 오늘 포함 최근 30일, 한국 날짜)·사람·화면·동작·대상 검색(대상 이름, 대소문자 무시), 최신순 50건씩, 주소(GET 폼)로
    - 행 [이력]: `RowHistoryButton`(경영지원 관리·미수금 모든 행, 숨긴 행 포함) → Server Action `getRowHistory()`(경영지원 view, 대상 종류 `LedgerEntry`·`Receivable`만, `area: "management"`만). 이관 행은 맨 아래 "엑셀 이관으로 생성 — 파일명, 이름(아이디), 일시" (이관 요약 기록, 없으면 `mgmt_data_upload` 값)
    - 엑셀: `GET /api/management/history/export?…`(지금 필터 그대로, 관리자(대표)만 — 경영지원팀이 주소로 와도 403, `no-store`, 최대 10,000건), 원본 양식 스타일(맑은 고딕 10·머리글 E7E6E6 굵게·테두리·첫 행 고정·자동 필터·열 너비 자동), 일시는 엑셀 날짜(한국 시각) `yyyy-mm-dd hh:mm`. 2026-10-26부터 다른 엑셀과 같은 공용 엔진(원본 양식 파일을 불러와 테마 유지, 문서 속성 `WORKBOOK_AUTHOR`) — 스냅샷 `history/__snapshots__/history-export.json` 내려받기도 기록(`area: "admin"`, `screen: "history-export"`) — 기록 실패 시 503으로 막음

## 공통 정책

> 권한·계정은 고객사 요구사항 기록용이다. 실제 규칙은 `src/shared/auth/can.ts`와 `docs/integration-notes.md` 8번 (2026-10-26 자료 기반 확정 — `docs/05-open-questions.md` 14·15번).

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
- 다우오피스 스타일 참고 (고객사 요청 원문) → **2026-10-21 리스킨으로 대체**: 따뜻한 회색 바탕 + 흰 라운드 카드 + 강조 카드 1개(코퍼), 브랜드 딥 네이비 `#1F3A5F` · 코퍼 `#B8612E`, Pretendard. 규칙은 `docs/design-guide.md`
  - 회사 로고는 `shared/ui/brand/logo.tsx`의 `<Logo />`만 사용 (원본 PNG에서 자른 심볼+워드마크, 재채색·변형 금지). 제목·버튼·배지 클래스는 `shared/ui/styles.ts` 상수 (CI 색 대조는 05-21번 답변 대기 — 팔레트 유지)
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
│  │  ├─ production.prisma    # prod_* (통합 1단계 2026-11-03 — 친구 저장소에서 옮김)
│  │  └─ service.prisma       # svc_* (통합 1단계 — 출장보고서·동행자·제품만, 부품·가격은 다음 단계)
│  ├─ migrations/
│  └─ seed.ts                 # 경영지원팀 샘플 데이터 (가짜)
├─ src/
│  ├─ app/
│  │  ├─ (auth)/login/        # 로그인 (회원가입 없음)
│  │  ├─ (dashboard)/
│  │  │  ├─ layout.tsx        # 공통 셸: 헤더·사이드바 + 회색 바탕 (docs/design-guide.md)
│  │  │  ├─ page.tsx          # 메인 = 전사 요약 (경영지원팀)
│  │  │  ├─ admin/            # 관리자 설정 (관리자만)
│  │  │  ├─ management/
│  │  │  ├─ production/       # placeholder (화면 이식은 다음 단계)
│  │  │  └─ service/          # placeholder (화면 이식은 다음 단계)
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
│  │  ├─ production/          # 메인 연동 집계(metrics/)·조회(data/)·index.ts (통합 1단계)
│  │  └─ service/             # 메인 연동 집계(metrics/)·조회(data/)·index.ts (통합 1단계)
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

## 배포 (Render, PoC — 2026-10-21 내부 결정, 운영 서버 위치 05-8은 범위 밖 — IT·대표 결정)

- 루트 `render.yaml`(Blueprint): 웹 서비스 + PostgreSQL 16, 무료 플랜·싱가포르. Render는 **main 브랜치**의 `render.yaml`을 읽는다
- 빌드: `npm ci` → `prisma generate` → `prisma migrate deploy` → `npm run db:seed:if-empty`(계정이 없는 빈 DB일 때만 — 재배포 때 덮어쓰기 방지) → `next build`. 시작은 `npm start`(PORT 자동)
- 최초 관리자: `INITIAL_ADMIN_ID`·`INITIAL_ADMIN_PASSWORD`(sync: false, 첫 로그인 변경 강제). 이 값이 있고 `SEED_INITIAL_PASSWORD`가 없으면 샘플 계정 비밀번호는 로그에 출력하지 않는다
- 헬스체크 `/api/health`(로그인 없이, `proxy.ts` `PUBLIC_PATHS`). `SESSION_SECRET`은 쓰지 않는다 (DB 세션)
- 절차·환경변수 표: README 8번

## 담당

| 영역 | 담당 |
|---|---|
| `management/`, 메인 화면, `shared/`, `prisma/schema/base.prisma`·`management.prisma` | 나 (경영지원팀) — **이 저장소의 개발 범위** |
| `admin/`, 로그인·계정 | 나 (경영지원팀) — 2026-10-21 인증 시리즈로 구현, 다른 팀은 `docs/integration-notes.md` 8번 방식으로 붙인다 |
| `production/` (+ `production.prisma`) | 생산팀 담당 친구 저장소(Django+Vue)에서 개발 → 통합 1단계(2026-11-03)부터 이 저장소로 옮기는 중 |
| `service/` (+ `service.prisma`) | 서비스팀 담당 친구 저장소에서 개발 → 통합 1단계부터 이 저장소로 옮기는 중 |

## 운영 규칙

- **다른 팀 모듈 폴더**: 통합 1단계(2026-11-03)부터 생산·서비스 폴더도 이 저장소에서 수정한다 (친구 저장소 규칙을 옮기는 범위). 규칙 자체를 바꿔야 하면 생산·서비스 담당 친구와 먼저 맞춘다.
- **모듈 간 import 금지**: `modules/<팀>`끼리 직접 import하지 않는다. 공통 코드는 `shared/`에만 둔다. (`eslint-plugin-boundaries`로 검사)
- **연동은 `index.ts` 공개 함수로만**: 메인 대시보드 등에서 다른 팀 데이터가 필요하면 해당 모듈 `index.ts`가 export한 함수(예: `getSalesShareByIndustry(period)`)만 사용한다. 통합 전까지는 `docs/interface-production.md` 형식 그대로의 **목업**을 쓴다.
- **기간 처리**: DB에는 **월 단위로만 저장**하고, 분기·연간은 조회할 때 계산한다.
- **스키마를 바꾼 뒤**: (DB 트리거가 있는 `audit_log` 처럼 마이그레이션에만 있는 것은 `npm run db:deploy`) `npm run db:push` → `npm run db:generate` → **dev 서버 재시작**(옛 Prisma 클라이언트가 남아 "Unknown argument" 에러가 날 수 있음 — 2026-10-20) → `npm run db:smoke`(실제 DB로 모든 칸·주요 조회 점검). 보고할 때 "dev 서버 재시작 필요"를 꼭 적는다
- **마이그레이션**: 작업 중에는 `npm run db:push`로 로컬 DB에만 반영하고, 마이그레이션 파일은 **PR 올리기 직전에** `npx prisma migrate dev --name <설명>`으로 1개 생성한다. (`prisma/migrations/`는 git에 포함)
- **권한 확인은 반드시 서버에서, `can()`으로**: 페이지·Server Action·조회 함수 모두 서버에서 `shared/auth`의 `can()`을 호출해 확인한다. 역할 비교를 직접 쓰지 않는다. UI에서 메뉴·버튼을 숨기는 건 보조 수단일 뿐이다.

## 기능 작업 공통 절차

1. `main` 최신화(`git pull`) 후 `feat/<기능명>` 브랜치 생성
2. 코드 작성 전에 **설계안(화면 구성, 파일 목록, 데이터 흐름)과 질문 목록**을 먼저 보여주고 승인받기
3. 구현은 작은 단위로 나누고, 단위마다 `npm run check` 통과 확인
4. 스키마를 바꿨으면 PR 직전에 마이그레이션 생성 (아래 체크리스트)
5. 화면 작업이 끝나면 `npm run dev`로 확인할 **주소와 확인 포인트**를 알려주기
   - 화면을 확인할 때는 HTML 응답뿐 아니라 **dev 서버 로그(`.next/dev/logs/next-development.log`)에 에러·경고가 없는지도 반드시 확인** (cacheComponents 검증 에러는 화면 오버레이·로그에만 나옴)
   - **로컬 테스트 계정 비밀번호는 확인 작업 중에도 바꾸지 않는다** (2026-10-25 사용자 지시). 꼭 바꿔야 하면 먼저 묻고, 바꿨다면 보고 맨 위에 적는다. 잠금 해제·실패 횟수 0 같은 상태 정리는 비밀번호를 건드리지 않고 한다. 비밀번호는 파일·스크린샷·커밋에 남기지 않는다 (로그인 자동화는 환경변수로 넘기고 끝나면 브라우저 프로필 삭제)
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

`docs/05-open-questions.md` 표 참고 — **2026-10-26 고객사 추가 답변 없이 모두 "자료 기반 결정"으로 닫음**(생산·서비스·IT 질문은 범위 밖). 새 질문이 생기면 표에 추가하고, 상태가 "미확인"인 항목은 임의로 가정하지 않는다.
