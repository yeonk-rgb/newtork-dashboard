# NEWTORK 경영 대시보드 (newtork-dashboard)

뉴토크코리아 사내 경영 대시보드 PoC. 프로젝트 개요·규칙은 [CLAUDE.md](CLAUDE.md) 참고.

## 1. 필수 설치

| 도구 | 버전 | 비고 |
|---|---|---|
| Node.js | 22 이상 (LTS) | `node -v`로 확인 |
| PostgreSQL | 16 | **Postgres.app** 또는 **Docker** 중 하나 |
| Git | — | |

## 2. 설치

```bash
npm ci                 # package-lock.json 그대로 설치 (팀원 모두 같은 버전)
cp .env.example .env   # 아래 3단계에서 DATABASE_URL 수정
```

## 3. DB 준비 — 둘 중 하나 선택

### A. Postgres.app 사용 시 (포트 5432)

[Postgres.app](https://postgresapp.com)을 실행한 상태에서 DB를 만든다.

```bash
createdb newtork
```

`.env` 예시 (비밀번호 없음, `macbook` 자리에 본인 맥 사용자명):

```env
DATABASE_URL="postgresql://macbook@localhost:5432/newtork?schema=public"
```

### B. Docker 사용 시 (포트 5433)

```bash
npm run db:up        # = docker compose up -d
```

`.env` 예시 (docker-compose.yml의 계정):

```env
DATABASE_URL="postgresql://newtork:newtork@localhost:5433/newtork?schema=public"
```

> Docker는 5433을 쓴다. Postgres.app과 같은 맥에서 동시에 돌려도 포트가 겹치지 않는다.

### DB 설정 확인

```bash
npm run db:validate  # prisma.config.ts + prisma/schema/*.prisma 검사
```

### 처음 받았을 때: 클라이언트 생성 + 테이블 만들기 + 샘플 데이터

```bash
npm run db:generate  # Prisma Client 생성 → src/shared/db/generated (git 제외 — 이게 없으면 typecheck 실패)
npm run db:deploy    # prisma/migrations 의 마이그레이션을 순서대로 적용해 테이블 생성
npm run db:seed      # 최근 12개월 가짜 데이터 (여러 번 실행해도 중복 없음)
```

> 이미 `db:push`로 테이블을 만들어 둔 DB라면 `db:deploy` 대신
> `npx prisma migrate resolve --applied <마이그레이션 폴더명>`으로 "적용됨" 표시만 한다.

### 개발 중 스키마를 바꿨을 때

```bash
npm run db:push      # 로컬 DB에만 반영 (마이그레이션 파일은 PR 직전에만 생성 — CLAUDE.md 체크리스트)
npm run db:generate  # 클라이언트 다시 생성
```

## 4. 실행 및 확인

```bash
npm run check        # lint + typecheck(라우트 타입 생성 포함) + test — 여기까지 통과하면 환경 준비 끝
npm run dev          # http://localhost:3000
npm run build        # 배포 빌드 확인 (선택)
```

### 개발용 임시 사용자 (로그인은 통합 시 결정)

- 로그인 화면이 없다. `npm run dev`에서 헤더 오른쪽 **DEV 드롭다운**으로 사용자를 바꾼다.
  - 관리자 / 대표 / 경영지원 팀장(기본) / 경영지원 팀원 / 생산 팀원
- 권한 규칙과 교체 방법: [docs/integration-notes.md](docs/integration-notes.md) 8번

> ⚠️ **실제 로그인 전에는 외부 공개 배포 금지.**
> `npm run build && npm run start`(배포 모드)는 기본적으로 **모든 요청을 403으로 차단**한다.
> 사내 시연할 때만 `.env`에 `DEMO_MODE=true`를 넣으면 "경영지원 팀장"으로 고정되어 열린다 — 접속하는 누구나 그 권한을 갖게 되므로 외부에 공개하지 않는다.

## 5. 자주 쓰는 명령

| 명령 | 설명 |
|---|---|
| `npm run dev` | 개발 서버 (Turbopack) |
| `npm run test` | 테스트 1회 실행 (Vitest) |
| `npm run test:watch` | 테스트 감시 모드 — 필요할 때만 |
| `npm run lint` | ESLint (팀 모듈 경계 검사 포함) |
| `npm run format` | Prettier로 전체 포맷 |
| `npm run db:validate` | Prisma 스키마 검사 |
| `npm run db:generate` | Prisma Client 생성 (스키마 변경 후) |
| `npm run db:deploy` | 마이그레이션 파일을 DB에 적용 (처음 받았을 때, main pull 후) |
| `npm run db:push` | 스키마를 로컬 DB에 반영 (개발 중) |
| `npm run check` | lint + typecheck + test (작업 단계마다, PR 전 필수) |
| `npm run db:seed` | 샘플 데이터 넣기 |

## 6. 팀 작업 규칙 (요약)

- 각자 담당 폴더(`src/modules/<팀>`, `src/app/(dashboard)/<팀>`, `prisma/schema/<팀>.prisma`)만 수정한다. 담당자는 [CODEOWNERS](CODEOWNERS) 참고.
- 팀 모듈끼리 직접 import 금지. 다른 팀 데이터는 그 모듈의 `index.ts`가 export한 함수로만 가져온다. → `npm run lint`가 잡아낸다.
- 마이그레이션 파일은 main 머지 직전에만 생성한다.
- 비밀키는 `.env`에만. `.env`는 git에 올라가지 않는다(`.env.example`만 커밋).

## 7. 저사양 PC 팁

- 개발 서버는 Turbopack이 기본이다. `next dev`와 `next build`를 동시에 돌리지 않는다.
- 테스트는 `npm run test`(1회 실행)를 기본으로 쓰고, 감시 모드는 필요할 때만 켠다.
- `.vscode/settings.json`에서 `node_modules`, `.next`를 파일 감시·검색에서 제외해 두었다.
- macOS에서는 터미널을 "개발자 도구"로 등록하면 Gatekeeper 검사가 줄어 빌드가 빨라진다 (Next.js 공식 가이드, 관리자 비밀번호 필요):
  1. 터미널에서 `sudo spctl developer-mode enable-terminal`
  2. 시스템 설정 → 개인정보 보호 및 보안 → 개발자 도구 → 사용하는 터미널(VS Code 포함) 켜기
  3. 터미널 재시작
