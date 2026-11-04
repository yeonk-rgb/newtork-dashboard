# 배포(Render) 확인·운영 메모

> 작성 2026-11-04. 배포 설정은 루트 `render.yaml`, 환경변수 표는 README 8번, DB 만료 대응 결정은 `docs/render-db-expiry.md`.
> 배포 주소: https://newtork-dashboard.onrender.com — main 에 머지되면 자동 배포(`autoDeploy: true`).

## 1. 배포가 됐는지 보는 법

| 방법 | 하는 일 |
|---|---|
| GitHub | 저장소 → 오른쪽 **Deployments** → `main - newtork-dashboard` 맨 위가 머지 커밋이고 상태가 **Active/success** 인지. (Render 가 GitHub 에 배포 상태를 남긴다 — `gh api repos/yeonk-rgb/newtork-dashboard/deployments`) |
| Render 화면 | Dashboard → `newtork-dashboard` → **Events**: "Deploy live for <커밋>" / **Logs**(빌드 로그): `prisma migrate deploy` 줄에 `No pending migrations` 또는 `applied`, 이어서 `✓ Compiled successfully`, 마지막에 `Your service is live` |
| 로그인 없이 화면 | `npm run check:deployed -- https://newtork-dashboard.onrender.com` — `/api/health` 200(DB 연결 포함) + 생산·서비스·부품 13개 주소가 모두 로그인 화면으로 넘어가는지(404·500 없음). 무료 서비스가 잠들어 있으면 첫 요청이 30초~1분 |

빌드 명령(`render.yaml`): `npm ci → prisma generate → prisma migrate deploy → db:seed:if-empty → seed:ai-examples:if-enabled → next build`. 마이그레이션이 실패하면 빌드가 멈추고 이전 버전이 그대로 서비스된다.

## 2. 시연용 가짜 데이터 (생산·서비스·부품)

`npm run seed:teams` 는 **빌드 명령에 넣지 않는다** (재배포마다 다시 들어가므로). 한 번만 손으로 넣는다.

### 넣기

무료 웹 서비스에는 Render **Shell 이 없을 수 있다**. 두 방법 중 되는 쪽으로:

**A. Render Shell 이 열리면** (Dashboard → `newtork-dashboard` → **Shell**)
```bash
npm run seed:teams
```

**B. 내 컴퓨터에서 Render DB 로 직접** (Shell 이 없을 때)
1. Render Dashboard → `newtork-db` → **Connect** → **External Database URL** 복사 (화면에서만 보고 파일·채팅에 붙여 넣지 않는다)
2. 저장소 폴더에서 (그 터미널에서만 쓰이고 파일에 남지 않게):
   ```bash
   read -s -p "External Database URL: " RDB; echo
   DATABASE_URL="$RDB?sslmode=require" npm run seed:teams
   unset RDB
   ```
3. 끝에 `생산: 제조내역 …행 / 서비스: 출장보고서 …건·부품 10개·출장지 10곳·가격 …건` 이 나오면 성공

- 다시 실행하면 가짜 데이터만 지우고 새로 넣는다 (직접 입력·업로드한 것은 그대로)
- 넣은 뒤 화면 숫자 옆에 **"샘플 데이터"** 배지가 붙는다 (작성자 id `seed-production`·`seed-service`)

### 지우기 — ⚠️ 고객사 실제 데이터를 넣기 전에 반드시

```bash
npm run seed:teams -- --remove                         # Shell
DATABASE_URL="$RDB?sslmode=require" npm run seed:teams -- --remove   # 내 컴퓨터에서
```
- 작성자 id 로 가짜 데이터만 지운다. 실제 출장보고서가 가짜 부품을 쓰고 있으면 그 부품은 남는다
- 같은 때 예시 AI 분석도 지운다: `render.yaml` 의 `SEED_AI_EXAMPLES` 를 `"false"` 로 바꾸고 `npm run seed:ai-examples -- --remove`

## 3. 운영 주의사항

| 항목 | 내용 |
|---|---|
| **무료 DB 만료** | 만든 지 30일 후 만료. 첫 배포 2026-10-21 → **만료 추정 2026-11-20**, 14일 유예 후(≈ 2026-12-04) 삭제. **실제 날짜는 Render → `newtork-db` 화면 상단**에서 확인. 대응 결정·절차는 `docs/render-db-expiry.md`(C안: 만료되면 새로 만들고 시드만 다시) |
| 만료 전 백업 | 내 컴퓨터에서 `pg_dump "$RDB?sslmode=require" -Fc -f newtork-$(date +%Y%m%d).dump` (PostgreSQL 16 클라이언트). 새 DB 로 옮길 때 `pg_restore -d "<새 External URL>?sslmode=require" --no-owner newtork-….dump`. 백업 파일은 저장소에 넣지 않는다 |
| DB 용량 | 무료 1GB. 사용량은 Render → `newtork-db` **Metrics/Storage** 또는 `psql "$RDB?sslmode=require" -c "select pg_size_pretty(pg_database_size(current_database()))"`. 참고: 로컬(같은 시드 + 가짜 데이터) 약 11MB |
| 첨부 파일 | **출장보고서 사진·PDF 는 DB 에 저장된다** (파일당 20MB, 배포 서버에 디스크가 없어서). 사진을 많이 올리면 1GB 에 빨리 닿는다 — 큰 사진은 줄여서 올리기 |
| AI 키 | `ANTHROPIC_API_KEY` 는 Render → `newtork-dashboard` → **Environment** 에서 값이 있는지만 확인 (값은 어디에도 적지 않는다). 없으면 AI 카드는 예시 분석·안내 문구만. `AI_ALLOW_REAL_DATA=false` 라 관리자(대표) 외에는 [분석하기]가 막혀 있다 |
| 잠듦 | 무료 웹 서비스는 15분 동안 요청이 없으면 잠들고, 다음 접속이 30초~1분 걸린다. 시연 직전 한 번 열어 두기 |
| 새 환경변수 | 2026-11 생산·서비스 이식으로 **추가된 것 없음** (PDF 읽기 PDFium WASM 은 `node_modules` 에서 읽음 — `next start` 로 확인) |

## 4. 친구 앱(newtalk-korea-frontend.onrender.com)

생산·서비스·부품 기능은 모두 이 저장소로 옮겼다 (`docs/integration-notes.md` 11번). 결정은 친구와 함께:

| 선택지 | 좋은 점 | 주의 |
|---|---|---|
| 그대로 두기 | 화면 비교·친구 쪽 확인용으로 계속 쓸 수 있음 | 데이터가 두 곳에 갈라짐 — 실제 데이터는 이 저장소 쪽에만 넣기. 친구 쪽 무료 DB 도 30일 만료 |
| 멈추기 (Render → 서비스 **Suspend**) | 혼동 없음, 무료 시간·DB 만료 신경 안 써도 됨 | 다시 켜면 그대로 돌아옴(Suspend 는 삭제가 아님). 완전히 지우려면 서비스·DB 삭제 |

## 5. 배포 후 화면 확인 체크리스트 (로그인 필요 — 사람이 직접)

시연용 가짜 PDF: `docs/samples/가상_출장보고서.pdf` (값 모두 가상 — 두 앱 PDF 읽기로 24개 항목 같음 확인).

1. 관리자 계정으로 로그인
2. 사이드바에 **생산**(6개)·**서비스**(2개)·**부품·가격**(5개) 메뉴가 모두 보이고, 13개가 모두 열린다
3. 생산 대시보드·서비스 대시보드·제조내역 등 숫자 옆에 **"샘플 데이터"** 배지가 보인다 (2번 시드를 넣은 뒤)
4. 메인(`/`)의 **④ 팀별 현황** 카드에 생산(확정 출고 수량·목표 달성률·납기 일정)·서비스(출장 건수·유상 비율·수리 제품)가 나온다
5. 메인 맨 아래 **AI 분석** 카드(예시)에 "생산 확정 출고 ○대, 서비스 출장 ○건(샘플 데이터 기준)" 문장이 있다
6. `/admin` → **[계정 추가]** 로 4개 만들기 (만든 뒤 임시 비밀번호가 한 번만 보이니 따로 적어 두기):
   - 생산팀장: 역할 **팀장**, 열람 범위 **생산**, 수정 권한 **생산**
   - 생산팀원: 역할 **팀원**, 열람 범위 **생산** (수정 권한 없음)
   - 서비스팀장: 역할 **팀장**, 열람 범위 **서비스**, 수정 권한 **서비스**
   - 서비스팀원: 역할 **팀원**, 열람 범위 **서비스** (수정 권한 없음)
   - (이미 시드 계정 `prod_leader`·`prod_member`·`svc_leader`·`svc_member` 가 있으면 [비밀번호 초기화]로 써도 된다)
7. 생산팀장으로 로그인 → 사이드바에 생산만, 제조내역 [수정]·목표 설정이 눌린다, `/service` 주소는 "권한 없음" 화면
8. 생산팀원으로 로그인 → 제목 옆 **"열람 전용"**, 버튼이 회색(비활성), 서비스·부품 메뉴가 없다
9. 서비스팀장으로 로그인 → 사이드바에 서비스·부품·가격만, `/production` 주소는 "권한 없음" 화면
10. 서비스팀원으로 로그인 → **"열람 전용"**, [출장보고서 입력]·[PDF로 등록]·[저장] 비활성, 생산 메뉴 없음
11. 서비스팀장으로 **출장보고서 → [PDF로 등록]** → `docs/samples/가상_출장보고서.pdf` 를 올린다 → "PDF에서 읽은 값을 아래 폼에 채웠습니다", 출장 목적 "가상정수장 밸브 A/S(시연용)", 확인 필요 1건(지역) → 지역 고르고 [저장] → 상세 화면에 원본 PDF 첨부 1개
12. 같은 PDF 를 한 번 더 올리면 "이미 등록된 PDF입니다" 로 막힌다
13. 확인이 끝나면 11번에서 만든 출장보고서를 상세 화면 [숨김]으로 숨긴다 (변경 이력에 남음)
