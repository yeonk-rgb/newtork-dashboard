# 디자인 가이드 (공통 UI)

> 대상: 생산팀·서비스팀 화면을 만드는 팀원. 이 문서대로 만들면 경영지원팀·관리자 화면과 같은 모양이 됩니다.
> 기준: 2026-10-21 리스킨 (따뜻한 회색 바탕 + 흰색 라운드 카드 + 강조 카드 1개 + 넉넉한 여백), 같은 날 톤 다운: 딥 네이비 + 번트 오렌지·코퍼. 레퍼런스: OripioFin, Finexy 대시보드 시안.
> 토큰 정의: `src/app/globals.css`, 차트 색: `src/shared/ui/chart-colors.ts`

## 1. 원칙

- **5초 안에 현재 상태가 보이는 화면** — 정보 밀도보다 가독성.
- **직접 색상값(`#...`, `bg-blue-600` 등)을 쓰지 않는다.** 아래 토큰 클래스만 쓴다.
- 강조 카드(코퍼 바탕 + 흰 글씨)는 **화면당 1개**. 나머지는 흰 카드.
- 고급스러움은 여백과 얇은 보더로 낸다 — 그림자·광택·네온 효과 없음, 형광·원색 금지.
- 진한 그림자·3D·과한 그라데이션 금지. 한 카드에 차트 2개 이상 넣지 않는다.
- 동작하지 않는 기능(검색·알림 등)은 화면에 표시하지 않는다.

## 2. 색상 토큰

### 브랜드 단계 (50~900)

OKLCH 에서 색상(hue)은 고정하고 명도만 조절, 채도는 기준값보다 올리지 않았다. 클래스: `bg-primary-50` … `bg-primary-900`, `bg-copper-50` … `bg-copper-900`

| 단계 | 50 | 100 | 200 | 300 | 400 | 500 | 600 | 700 | 800 | 900 |
|---|---|---|---|---|---|---|---|---|---|---|
| **primary (딥 네이비)** | `#EEF2F7` | `#D5DEEA` | `#B4C1D2` | `#94A4BA` | `#7588A3` | `#576D8C` | `#3B5375` | **`#1F3A5F`** | `#172C48` | `#0C1E36` |
| **copper (번트 오렌지)** | `#F8EEE7` | `#F3DCCB` | `#E7BCA6` | `#D89E80` | `#C98059` | **`#B8612E`** | `#9A4F24` | `#7E3D15` | `#652A01` | `#481C01` |

- `bg-primary` = primary-700 (주 버튼·활성 메뉴·링크), hover = primary-800, 연한 배경 = primary-50, 차트 비선택 막대 = primary-100
- copper 는 **강조 카드와 차트 2번 색에만**. 버튼·링크에 쓰지 않는다
- 주의: `bg-accent`(숫자 없음)는 shadcn 의 hover 면(따뜻한 회색)이고 코퍼가 아니다

### 면·글자·상태

| 용도 | 값 | Tailwind 클래스 |
|---|---|---|
| 브랜드 연한 바탕 | `#EEF2F7` | `bg-brand-soft` · 글씨 `text-brand-soft-foreground` |
| 화면 바탕 | `#F5F4F1` (따뜻한 회색) | `bg-canvas` (셸이 이미 깔아 둠) |
| 카드·입력칸 | `#FFFFFF` | `bg-card` · 입력칸 `bg-background` |
| 제목 글자 | `#1A1D23` | `text-foreground` |
| 본문 글자 | `#4A4F57` | `text-body` |
| 보조 글자 | `#6B6F76` | `text-muted-foreground` (흰 바탕 5.0:1, 회색 바탕 4.6:1) |
| 흐린 보조 | `#9A9EA5` | `text-subtle` — 축·자리표시 등 **큰 글자·장식용만** |
| 면·선 | `#F5F4F1` / `#E7E5E0` | `bg-muted` / `border` (기본 보더 색) |
| 증가·정상 | `#2F7D57` | 점·아이콘 `bg-success` / 배지 `bg-success-soft text-success-strong` |
| 감소 | `#952C44` | 점·아이콘 `bg-destructive` / 배지 `bg-danger-soft text-danger-strong` |
| 경고·진행 중 | `#C9A43A` | 점·아이콘 `bg-warning` / 배지·안내 `bg-warning-soft text-warning-strong` |
| 정보(구분용) | `#3B5D86` | `bg-info-soft text-info-strong` — 상태·브랜드 외에 한 가지 더 구분할 때만 |

상태 색 검증 (2026-10-21, 코퍼와 나란히 있을 때):

- 감소: 요청값 `#B83A3A`는 코퍼와 일반 시각 ΔE 8.7(기준 15 미만)로 구분이 어려워 **`#952C44`**(더 깊고 차가운 크림슨)로 조정 → ΔE 15.3, 색각 이상 14.4 PASS
- 경고: 요청값 `#C48A1E`는 코퍼와 ΔE 10.9로 비슷해 **`#C9A43A`**(노란 오커)로 조정 → ΔE 17.3, 색각 이상 14.8 PASS
- 증가 `#2F7D57`↔감소: 색각 이상 ΔE 6.3(경계) → 증감 배지는 항상 ▲▼ 화살표를 함께 쓴다
- 증가↔코퍼: 적색약(protan)에서 ΔE 5.1로 구분 어려움 → **증가색을 코퍼 위·옆에 두지 않는다** (강조 카드 안에서는 상태 색 대신 흰 글씨 + ▲▼)

## 3. 타이포그래피

- 폰트: **Pretendard** (npm `pretendard` 1.3.9 고정, `next/font/local`로 서버에서 제공 — 외부 CDN 없음). fallback: Noto Sans KR, system-ui
- 숫자: 전체에 `tabular-nums` 적용됨 (자릿수 폭이 같아 표·카드에서 세로 정렬)

| 요소 | 크기 | 클래스 |
|---|---|---|
| 페이지 제목 | 24px Bold | `text-2xl font-bold tracking-tight` |
| 카드 제목 | 15px SemiBold | `text-[15px] font-semibold` (KPI 카드 제목은 `font-medium text-body`) |
| 핵심 숫자 (KPI) | 30px Bold | `text-[30px] leading-tight font-bold tracking-tight` |
| 도넛 가운데 숫자 | 28px Bold | `text-[28px] font-bold` |
| 보조 텍스트 | 12~13px | `text-xs text-muted-foreground` |

금액: 기존 규칙 그대로 — 표·입력·툴팁은 천 단위 콤마 원 단위, 카드의 큰 숫자 등 이미 `formatWonShort()`를 쓰는 곳만 "7.09억원" 축약.

## 4. 카드·간격

```tsx
<section className="rounded-card border bg-card p-5">
  <h2 className="text-[15px] font-semibold">카드 제목</h2>
  …
</section>
```

- 라운드: 카드 `rounded-card`(18px), 버튼·입력칸 `rounded-lg`(10px), 얇은 안내 띠 `rounded-xl`, 배지·토글 `rounded-full`
- 보더: 1px 연한 보더(`border`), **그림자 없음** (대화상자·툴팁만 옅은 그림자)
- 간격: 카드 사이 `gap-5`(20px), 페이지 세로 `space-y-5`, 카드 안쪽 `p-5`
- 강조 카드: `rounded-card border border-copper-600 bg-linear-to-br from-copper-500 to-copper-600 text-white` — 그라데이션은 500→600 아주 미세하게만. 흰 글씨 대비가 코퍼 500에서 4.4:1이라 **작은 글씨도 흰색 100%** (투명도로 흐리게 하지 않음)

## 5. 부품

**증감 배지 (pill)** — 화살표를 함께 써서 색에만 의존하지 않는다

```tsx
<span className="inline-flex items-center rounded-full bg-success-soft px-2 py-0.5 text-[11px] font-semibold text-success-strong">▲5.0%</span>
<span className="inline-flex items-center rounded-full bg-danger-soft px-2 py-0.5 text-[11px] font-semibold text-danger-strong">▼3.0%</span>
```

**상태 (점 + 글자)** — 표의 상태 칸

```tsx
<span className="inline-flex items-center gap-1.5 text-xs font-medium">
  <span aria-hidden className="size-1.5 rounded-full bg-success" />완료
</span>
```

**세그먼트 토글** — 기간 단위 등 (예: `modules/management/components/period-selector.tsx`)

- 바깥: `inline-flex rounded-full border border-input bg-card p-1`
- 항목: `rounded-full px-3.5 py-1 text-sm font-medium`, 선택 `bg-primary text-primary-foreground`, 나머지 `text-muted-foreground hover:bg-muted`
- 드롭다운(select): `h-9 rounded-full border border-input bg-card px-3.5 text-sm font-medium`

**버튼**: `src/shared/ui/button.tsx`(shadcn) — 주 버튼 `bg-primary`, 보조 버튼 `rounded-lg border px-3 py-1.5 text-sm hover:bg-muted`

**표**

- `<table className="w-full text-sm [&_td]:px-3 [&_th]:px-3">`
- 머리글: `<thead className="bg-muted text-xs text-muted-foreground">`, `th`는 `py-2.5 font-medium`
- 행: `border-b`, 칸 `py-2.5` (넉넉하게)
- 검색창·필터는 표 카드 오른쪽 위

**체크박스·라디오**: 브라우저 기본 모양 + 브랜드 색(`accent-color`, 전역 적용). 크기 `size-4`

**아이콘**: lucide-react 라인 아이콘. 강조가 필요하면 연회색 원 안에: `flex size-11 items-center justify-center rounded-full bg-muted`

## 6. 차트

비중·달성률 = **도넛**(`src/shared/ui/donut-card.tsx`의 `DonutCard` 재사용), 시계열 = 막대.

- 도넛 두께: 지름의 약 20%, 조각 끝 라운드(4px), 조각 사이 2px 간격(카드 배경색)
- 가운데 핵심 값(28px Bold) + 아래 작은 이름, 오른쪽 범례 [색 점 · 항목명 · % · 값], 마우스·키보드로 조각 강조
- **"표로 보기" 전환은 항상 둔다** (금색·주황은 흰 배경 대비가 낮아 값은 글자로도 보여야 함)
- 강조 카드 위 도넛: `tone="accent"` + `METER_ON_ACCENT`
- 막대: 위쪽 라운드, 선택 기간만 진한 색, 나머지는 연한 단계(`FLOW_COLORS.*Soft`), 미확정은 빗금

### 범주 팔레트 (`PALETTE`, 고정 순서, 저채도)

| 순서 | 이름 | 값 |
|---|---|---|
| 1 | navy (브랜드) | `#1F3A5F` |
| 2 | copper | `#B8612E` |
| 3 | sage (세이지) | `#86A382` |
| 4 | mauve (모브) | `#86607E` |
| 5 | sand (샌드) | `#CBB27A` |
| 6 | steel (스틸블루) | `#5A83B0` |
| 기타 | slate (슬레이트) | `#BCC1C8` |

- **같은 항목 = 같은 색** (산업분야 `INDUSTRY_COLORS`, 제품 시리즈 `SERIES_COLORS`를 그대로 import해서 쓴다 — 생산·서비스 화면에서도 상하수도는 네이비)
- 조각은 이 순서대로 놓는다 (순서까지 검증한 값). 항목이 7개를 넘으면 새 색을 만들지 말고 "기타"로 묶는다
- 이익 구조는 매입 코퍼 · 경비 샌드 · 이익 네이비 (코퍼↔모브가 맞닿으면 구분이 약함)
- 순서가 있는 값(미수금 경과 구간)은 코퍼 한 색의 명도 단계 `AGING_COLORS`: `#DDA78B → #C98059 → #B8612E → #9A4F24`
  (요청한 가장 밝은 값 `#F3DCCB`는 흰 카드 대비 1.29:1 로 조각이 거의 안 보여 `#DDA78B`(2.05:1)로 올림)
- 막대: 매출 네이비 · 지출 코퍼, 선택 기간 밖의 달은 primary-100 `#D5DEEA` · copper-300 `#D89E80`
- 색을 바꾸면 dataviz 검증 스크립트로 인접 쌍(마지막↔첫 조각 포함)을 다시 확인한다

검증 결과 (2026-10-21): 7색 인접 쌍(마지막↔첫 포함) 색각 이상 ΔE 최소 11.4 · 일반 시각 ΔE 최소 17.5 PASS. 저채도 요청이라 "채도 하한" 검사는 FAIL(회색빛), 네이비는 명도 범위 밖 — 인접 구분은 통과하므로 이름·%·금액 목록과 "표로 보기"를 항상 함께 둔다.

## 7. 셸 (이미 제공 — 팀 화면에서 만들 필요 없음)

- 헤더: 흰 바탕, 왼쪽 로고(네이비 사각형 + NEWTORK), 오른쪽 프로필(이름·역할 ▾ → 비밀번호 변경·로그아웃)
- 사이드바: 흰 바탕, 현재 메뉴는 네이비 pill(`bg-sidebar-primary`), 메뉴는 권한별로 자동 숨김
- 팀 화면은 `(dashboard)/<팀>/page.tsx` 안의 내용만 만들면 위 셸과 회색 바탕이 씌워진다
