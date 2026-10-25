# Render 시험 서버 DB 만료 대응 (선택지 정리)

> 작성 2026-10-25. **결정: C안 (만료되면 새로 만들고 시드만 다시)** — 아래 "만료 후 재생성 절차". 이 문서를 만드는 동안 시험 서버에는 접속·쓰기를 하지 않았다.
> **고객사 시연이 만료일 근처에 잡히면 그 한 달만 A안(유료)으로 바꾼다** (시연 중 끊기지 않게, 시연 뒤 다시 무료로 돌릴지는 그때 결정).
> 근거: Render 문서 [Deploy for Free](https://render.com/docs/free) · [무료 DB 30일 만료 변경](https://render.com/changelog/free-postgresql-instances-now-expire-after-30-days-previously-90) · [요금](https://render.com/pricing) (2026-10-25 조회, 금액은 결정 전에 요금 페이지에서 다시 확인)

## 지금 상태

| 항목 | 값 |
|---|---|
| DB | `newtork-db` (PostgreSQL 16, 무료, 싱가포르) |
| 만든 날 | 2026-10-21 08:02 UTC (GitHub 배포 기록의 `newtork-db` 환경 첫 기록) |
| **만료일** | **2026-11-20 (추정 — Render 대시보드 `newtork-db` 화면에서 실제 날짜 확인 필요)** |
| 만료 후 | 접속 불가 → **14일 유예** 안에 유료로 올리면 데이터 유지, 유예가 끝나면(≈ 2026-12-04) **DB와 데이터 삭제** |
| 알림 | 만료 전·유예 종료 전에 Render가 이메일로 알림 |
| 들어 있는 데이터 | 샘플(가짜) 재무 데이터 + 최초 관리자·샘플 계정 + 시험 중 입력한 값·변경 이력(audit_log). 실제 재무 데이터는 넣지 않는 원칙(05-19) |
| 제약 | 무료 DB는 계정당 1개 |

## 선택지

| | A. 유료 DB로 올리기 | B. 백업 받아 새 무료 DB로 옮기기 | C. 만료되면 새로 만들고 시드만 다시 |
|---|---|---|---|
| 월 비용 | Basic-256mb 약 **$6/월** + 저장 공간 $0.30/GB (1GB) | 0원 | 0원 |
| 데이터 | 그대로 유지 (이전 작업 없음) | 백업 시점까지 유지 | **모두 새로** (샘플 데이터·계정 처음 상태) |
| 반복 부담 | 없음 | **30일마다** 백업 → 삭제 → 새로 만들기 → 복원 | 30일마다 다시 만들기 (작업은 짧음) |
| 끊기는 시간 | 없음 | 옮기는 동안 (수십 분) | 만료 ~ 다시 만들 때까지 |
| 추천 상황 | 고객 시연·시험 사용 중에 끊기면 안 될 때, 운영 위치가 Render(클라우드)로 정해질 때 | 비용 없이 시험 기록을 꼭 이어가야 할 때 (추천하지 않음) | 지금처럼 가짜 데이터만 있고 운영 위치가 정해지지 않았을 때 |

### A. 유료 DB로 올리기

- **Render 대시보드에서 할 일**
  1. `newtork-db` → **Upgrade**(또는 Settings의 인스턴스 종류) → `Basic-256mb` 선택 → 결제 수단 확인
  2. 바뀐 뒤 `newtork-db` 화면에서 **만료일 표시가 사라졌는지** 확인
  3. 웹 서비스 `/api/health`가 `{"status":"ok"}`인지 확인
- **코드·설정에서 바꿀 것**
  - `render.yaml`의 `databases[0].plan: free` → `basic-256mb`. 대시보드 설정과 Blueprint가 다르면 다음 Blueprint 동기화 때 헷갈림 → 대시보드에서 올린 날 같은 PR로 맞춤
  - `DATABASE_URL`은 `fromDatabase`로 연결돼 있어 **바꿀 것 없음**. 코드 변경도 없음
  - README 8번 "무료 PostgreSQL은 30일 후 만료" 문구 갱신
- **위험**
  - 월 비용 발생 (결제 담당·기간 결정 필요)
  - 데이터는 여전히 해외(싱가포르)에 있음 (Render에 한국 지역 없음)
  - 웹 서비스는 무료라 15분 뒤 잠드는 건 그대로 (웹도 올리면 별도 비용)

### B. 만료 전에 백업(pg_dump) 받고 새 무료 DB로 옮기기

- **Render 대시보드에서 할 일** (만료 전에, 30일마다)
  1. `newtork-db` → Connect → External Database URL 복사 (비밀번호 포함 — 채팅·파일·git에 남기지 않음)
  2. 내 PC에서 `pg_dump -Fc "<URL>" > newtork-YYYYMMDD.dump` (읽기만). **백업 파일에는 비밀번호 해시·세션·변경 이력이 들어 있다** → 암호화된 곳에 보관, 저장소에 넣지 않음
  3. 무료 DB는 1개만 → 기존 `newtork-db` 삭제 → 같은 이름으로 새로 만들기 (Blueprint 동기화)
  4. `pg_restore --no-owner -d "<새 URL>" newtork-YYYYMMDD.dump`
  5. 웹 서비스 다시 배포 → `/api/health` 확인 → 로그인 확인
- **코드·설정에서 바꿀 것**: 없음 (같은 이름으로 만들면 `fromDatabase` 연결 유지). 이름을 바꾸면 `render.yaml`의 `fromDatabase.name`도 바꿔야 함
- **위험**
  - 30일마다 사람이 해야 하고, 잊으면 데이터가 사라짐
  - 삭제와 복원 사이에 실패하면 되돌릴 곳이 백업 파일뿐
  - 백업 파일이 PC에 남음 (개인 정보·비밀번호 해시)
  - 변경 이력 표의 삭제 금지 트리거는 백업에 함께 들어가고, 복원(INSERT)은 막지 않는다. 복원 뒤 `_prisma_migrations`·트리거가 있는지 확인 필요

### C. 만료되면 새로 만들고 시드만 다시 넣기

- **Render 대시보드에서 할 일** (만료 후)
  1. (유예 중이면) 기존 `newtork-db` 삭제
  2. Blueprint → **Sync**(또는 New → PostgreSQL, 이름 `newtork-db`, 싱가포르, PostgreSQL 16)
  3. 웹 서비스 → Environment에 `INITIAL_ADMIN_ID`·`INITIAL_ADMIN_PASSWORD`가 남아 있는지 확인. 첫 로그인 뒤 지웠다면 다시 입력
  4. 웹 서비스 **Manual Deploy** → 빌드 로그에서 `prisma migrate deploy`(8개 적용) → `최초 관리자 생성` 확인
  5. `/api/health` → `/login`에서 최초 관리자로 로그인 → 새 비밀번호
- **코드·설정에서 바꿀 것**: 없음. 빌드 명령이 빈 DB에 마이그레이션(변경 이력 트리거 포함) + `db:seed:if-empty`를 이미 한다
- **위험**
  - 시험 중 만든 계정·바꾼 비밀번호·입력값·변경 이력이 모두 사라짐 (가짜 데이터라 큰 손실은 아님)
  - 실수로 실제 데이터를 넣었다면 함께 사라짐 → 지금 시험 서버에 실제 데이터가 없는지 먼저 확인
  - 만료부터 다시 만들기까지 화면이 열리지 않음 (헬스체크 503)

## 만료 후 재생성 절차 (C안 — Render 대시보드에서 직접)

> 누가: 저장소 담당자(사람). Claude 는 시험 서버에 접속하지 않는다.
> 언제: 만료 메일을 받은 뒤 (유예 14일 안이든 뒤든 상관없음 — 데이터를 살리지 않는 안이므로)

### 0. 만료 전에 미리 (한 번만)

1. 시험 서버에 **실제 재무 데이터가 들어가 있지 않은지** 확인 (들어 있다면 C안이 아니라 B안 백업부터)
2. 웹 서비스 `newtork-dashboard` → **Environment** 에서 `INITIAL_ADMIN_ID`·`INITIAL_ADMIN_PASSWORD` 가 아직 있는지 본다
   - 첫 로그인 뒤 지웠다면, 재생성 직전에 다시 입력할 값을 정해 둔다
   - **관리자 비밀번호가 쉬운 값(아이디에 숫자만 붙인 값, 아이디와 비슷한 값, 숫자만)이면 이번에 바꾼다.** 시험 서버는 인터넷에 열려 있어 누구나 로그인 화면에 들어올 수 있다. 8자 이상 · 영문+숫자 · 로컬 테스트 계정과 다른 값 (로그인 후 첫 화면에서 다시 바꾸게 된다)
   - 값은 Render 화면에만 입력하고 메신저·문서·저장소에 적지 않는다

### 1. 기존 DB 정리

1. Render 대시보드 → **newtork-db** → (만료/유예 표시 확인) → **Settings → Delete Database**
   - 무료 DB는 계정당 1개라 지워야 새로 만들 수 있다
   - 이름 `newtork-db` 를 그대로 다시 쓸 것 (웹 서비스의 `DATABASE_URL` 이 이 이름으로 연결돼 있음 — `render.yaml` `fromDatabase.name`)

### 2. 새 DB 만들기

방법 ① (권장) **Blueprint 동기화**
1. 대시보드 → **Blueprints** → 이 저장소 Blueprint → **Manual Sync** (또는 "Sync")
2. 변경 목록에 `newtork-db` 생성이 나오면 **Apply** — `render.yaml` 대로 PostgreSQL 16 · 무료 · 싱가포르 · DB 이름 `newtork` · 사용자 `newtork`

방법 ② (Blueprint 가 안 되면) **New → PostgreSQL**
- Name `newtork-db`, Database `newtork`, User `newtork`, Region **Singapore**(웹 서비스와 같은 지역), PostgreSQL **16**, Plan **Free**
- 만든 뒤 웹 서비스 → Environment 에서 `DATABASE_URL` 이 새 DB 의 **Internal** 주소인지 확인 (`fromDatabase` 연결이 끊겼으면 새 DB 의 Internal Database URL 로 다시 지정)

### 3. 웹 서비스 다시 배포

1. 웹 서비스 `newtork-dashboard` → Environment 에 `INITIAL_ADMIN_ID`·`INITIAL_ADMIN_PASSWORD` 입력(0단계에서 정한 값) → Save
2. **Manual Deploy → Deploy latest commit**
3. 빌드 로그(Logs)에서 아래 순서를 확인 — 이 중 하나라도 없거나 에러면 배포를 멈추고 로그를 저장해 둔다
   - `npm ci` → `prisma generate`
   - `8 migrations found in prisma/migrations` → `Applying migration ...` 8줄 → `All migrations have been successfully applied.`
   - `최초 관리자 생성: <아이디> (비밀번호: INITIAL_ADMIN_PASSWORD)`
   - `계정 7개 생성: ...` (샘플 계정 — 비밀번호는 로그에 나오지 않음) → 샘플 데이터 시드
   - `next build` 성공 → **Deploy live**

### 4. 재생성 후 확인 체크리스트

| # | 확인 | 방법 | 기대 결과 |
|---|---|---|---|
| 1 | 헬스체크 | 브라우저로 `https://newtork-dashboard.onrender.com/api/health` (잠들어 있으면 1분쯤 걸림) | `{"status":"ok"}` |
| 2 | 마이그레이션 8개 | 빌드 로그, 또는 아래 읽기 전용 SQL ① | 8행, 모두 `finished_at` 있음·`rolled_back_at` 비어 있음 |
| 3 | 변경 이력 삭제 금지 트리거 2개 | 읽기 전용 SQL ② | `audit_log_no_update_delete`, `audit_log_no_truncate` (`tgenabled = O`) |
| 4 | 관리자 로그인 | `/login` 에서 `INITIAL_ADMIN_ID` 로 로그인 | 비밀번호 변경 화면으로 이동 → 새 비밀번호(쉬운 값 금지) 저장 → 경영 대시보드 |
| 5 | 샘플 데이터 | 경영 대시보드 기간 2026-Q3 | 숫자가 보임 (샘플, 2024-10 ~ 2026-09) |
| 6 | AI 차단 | AI 분석 카드 | [분석하기] 막힘 안내 (`AI_ALLOW_REAL_DATA=false`) |
| 7 | 새 만료일 | `newtork-db` 화면 | 만든 날 + 30일 → 06 후속 과제 날짜 갱신, 1주 전 알림 일정 등록 |
| 8 | (선택) 샘플 계정 | `/admin` → 필요한 계정만 [비밀번호 초기화] | 쓰지 않는 샘플 계정은 [비활성화] |

읽기 전용 SQL (새 DB 의 External URL 로, 세션을 읽기 전용으로 강제 — URL 은 터미널에서만):

```bash
PGOPTIONS='-c default_transaction_read_only=on' psql "<새 DB External URL>"
```

```sql
-- ① 마이그레이션 8개
SELECT migration_name, finished_at, rolled_back_at FROM _prisma_migrations ORDER BY started_at;
-- ② 트리거 2개
SELECT tgname, tgenabled, pg_get_triggerdef(oid)
FROM pg_trigger WHERE tgrelid = '"audit_log"'::regclass AND NOT tgisinternal;
```

하지 말 것: 시험 서버 주소로 `db:smoke`·`db:deploy`·`db:seed`·`prisma studio` 실행, DELETE 시험

## 고객사 IT 질문 1번(운영 위치)과의 관계

`docs/client-questions-2026-10-others.md` "대표님 또는 IT 담당" 1번, `docs/05-open-questions.md` 8번.

| 고객사 답 | DB 대응 |
|---|---|
| **A. 클라우드 유료 요금제** | 이 문서의 A로 그대로 이어감. 실제 데이터를 넣기 전에 (1) 샘플 데이터 정리 방법, (2) 05-19 외부 AI 전송 동의, (3) 지역(해외 저장) 동의를 함께 확인 |
| **B. 회사 안 서버(또는 PC)** | Render는 시험·시연용으로만 쓰다 끝남 → 유료로 올릴 이유가 적음 → C (시연 일정이 만료일과 겹치면 그 달만 A) |
| 아직 답 없음 | **C 추천**. 단, 만료일(11-20 전후)과 고객 시연(10단계) 날짜가 가까우면 시연이 끝날 때까지 A로 한 달만 올리는 것을 검토 |

## 결정하면 할 일

- 06 후속 과제 맨 위 "Render 시험 서버 DB 만료" 행의 상태·결정 갱신
- A면 `render.yaml`·README 8번 수정 PR
- B·C면 만료 1주 전 알림을 일정에 등록
