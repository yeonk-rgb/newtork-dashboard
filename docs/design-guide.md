# 디자인 가이드 (공통 UI)

> 대상: 생산팀·서비스팀 화면을 만드는 팀원. 이 문서대로 만들면 경영지원팀·관리자 화면과 같은 모양이 됩니다.
> 기준: 2026-10-21 리스킨 (따뜻한 회색 바탕 + 흰색 라운드 카드 + 강조 카드 1개 + 넉넉한 여백), 같은 날 톤 다운: 딥 네이비 + 번트 오렌지·코퍼. 레퍼런스: OripioFin, Finexy 대시보드 시안.
> 같은 날 마감: 회사 로고 적용, 강조 카드 대비 수정, 제목·간격·버튼·배지·아이콘 규칙 통일 (CI 색 대조 결과는 2장 끝).
> 토큰 정의: `src/app/globals.css`, 차트 색: `src/shared/ui/chart-colors.ts`, **공통 클래스: `src/shared/ui/styles.ts`**, 로고: `src/shared/ui/brand/logo.tsx`

## 1. 원칙

- **5초 안에 현재 상태가 보이는 화면** — 정보 밀도보다 가독성.
- **직접 색상값(`#...`, `bg-blue-600` 등)을 쓰지 않는다.** 아래 토큰 클래스만 쓴다.
- 강조 카드(코퍼 바탕 + 흰 글씨)는 **화면당 1개**. 나머지는 흰 카드.
- 고급스러움은 여백과 얇은 보더로 낸다 — **그림자 없음**(대화상자·툴팁·고정 바 포함), 광택·네온·원색 강조·이모지 아이콘 금지.
- 3D·과한 그라데이션 금지. 한 카드에 차트 2개 이상 넣지 않는다.
- 제목·버튼·배지 클래스는 직접 적지 말고 `src/shared/ui/styles.ts` 상수를 쓴다 (화면마다 값이 달라지지 않게).
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
| 강조 카드 바탕 | `#AD5A2A` → `#9A4F24` | `bg-linear-to-br from-emphasis-from to-emphasis-to` (4장 강조 카드) |

상태 색 검증 (2026-10-21, 코퍼와 나란히 있을 때):

- 감소: 요청값 `#B83A3A`는 코퍼와 일반 시각 ΔE 8.7(기준 15 미만)로 구분이 어려워 **`#952C44`**(더 깊고 차가운 크림슨)로 조정 → ΔE 15.3, 색각 이상 14.4 PASS
- 경고: 요청값 `#C48A1E`는 코퍼와 ΔE 10.9로 비슷해 **`#C9A43A`**(노란 오커)로 조정 → ΔE 17.3, 색각 이상 14.8 PASS
- 증가 `#2F7D57`↔감소: 색각 이상 ΔE 6.3(경계) → 증감 배지는 항상 ▲▼ 화살표를 함께 쓴다
- 증가↔코퍼: 적색약(protan)에서 ΔE 5.1로 구분 어려움 → **증가색을 코퍼 위·옆에 두지 않는다** (강조 카드 안에서는 상태 색 대신 흰 글씨 + ▲▼)

### CI 색 대조 (2026-10-21, 로고 원본 PNG에서 추출)

로고에 쓰인 색은 **오렌지 1색 + 차콜(워드마크) 1색**이며 블루는 없다. 색상(hue)이 현재 팔레트와 크게 달라 **팔레트는 바꾸지 않고** 아래 제안값만 기록한다 (적용 여부 결정 대기 — `docs/05-open-questions.md` 21번).

| 구분 | 로고 추출값 | 현재값 | 차이 (OKLCH) | 제안값 |
|---|---|---|---|---|
| 오렌지 계열 | `#E45932` (L 0.64 · C 0.181 · H 36°) | 코퍼 `#B8612E` (L 0.59 · C 0.129 · H 48°) | 색상 12° 차이 — CI 쪽이 더 붉음, 채도 높음 | `#BC5C42` — CI 색상(H 36°) + 현재 코퍼의 명도·채도 (흰 바탕 대비 4.42:1) |
| 짙은 색 | `#3F3E3C` 차콜 (C 0.004, 무채색) | 딥 네이비 `#1F3A5F` (H 257°) | CI에는 블루가 없음 (무채색 vs 청색) | ① 네이비 유지(오렌지의 보색, 로고와 함께 써도 충돌 없음) 또는 ② 따뜻한 차콜 `#302E29` (흰 바탕 대비 13.6:1) |

- 로고 이미지 자체는 원본 색 그대로 쓴다 (팔레트와 별개).

## 3. 타이포그래피

- 폰트: **Pretendard** (npm `pretendard` 1.3.9 고정, `next/font/local`로 서버에서 제공 — 외부 CDN 없음). fallback: Noto Sans KR, system-ui
- 숫자: 전체에 `tabular-nums` 적용됨 (자릿수 폭이 같아 표·카드에서 세로 정렬)

제목 위계는 3단계이며 모든 화면에서 같다 (`styles.ts`):

| 단계 | 크기·굵기·색 | 상수 | 쓰는 곳 |
|---|---|---|---|
| 페이지 제목 | 24px Bold, 제목색 | `pageTitleClass` | 각 화면 h1 (로그인·비밀번호 변경·403 포함) |
| 카드 제목 | 16px SemiBold, 제목색 | `cardTitleClass` | 카드·표 카드·대화상자 h2, 입력 묶음 legend, KPI 카드 제목 |
| 라벨 | 12px Medium, 보조색 | `labelClass` | 카드 안 소제목(h3), 요약 수치 이름, 표 머리글과 같은 단계 |

| 숫자 | 크기 | 클래스 |
|---|---|---|
| 핵심 숫자 (KPI) | 30px Bold, 자간 -0.02em, `tabular-nums` | `text-[30px] leading-tight font-bold tracking-[-0.02em] tabular-nums` |
| 도넛 가운데 숫자 | 글자 수에 따라 22px(5자 이하) · 18px(7자 이하) · 16px, Bold, 자간 -0.02em | `DonutCard` 안 `centerValueSize()` — 도넛 구멍 안쪽 88px 폭(`px-11`)을 넘지 않게 |
| 보조 텍스트 | 12px | `text-xs text-muted-foreground` |

- KPI 큰 금액의 단위 "원"은 숫자보다 작고 연하게: `<Won value={…} unit="subtle" />` ("4.8억" + 작은 회색 "원")
- 금액: 기존 규칙 그대로 — 표·입력·툴팁은 천 단위 콤마 원 단위, 카드의 큰 숫자 등 이미 `formatWonShort()`를 쓰는 곳만 "7.09억원" 축약.

## 4. 카드·간격

```tsx
import { cardTitleClass } from "@/shared/ui/styles";

<section className="rounded-card border bg-card p-6">
  <h2 className={cardTitleClass}>카드 제목</h2>
  …
</section>
```

- 라운드: 카드 `rounded-card`(18px), 버튼·입력칸 `rounded-lg`(10px), 얇은 안내 띠 `rounded-xl`, 배지·토글 `rounded-full`
- 보더·구분선: **1px `#E7E5E0`(`border`) 하나로 통일**. 합계 행도 1px(굵은 글자로 구분), 이중 보더·2px 구분선·진한 머리글 선 없음. 안내 띠(경고·정보)는 보더 없이 옅은 바탕만
  - 예외: AI 카드 왼쪽 4px 네이비 강조선, 설정 탭의 선택 밑줄(2px)
- **간격은 8px 배수**: 카드 안쪽 `p-6`(24px), 카드 사이 `gap-6`(24px), 페이지 세로 `space-y-6`(24px), 카드 안 묶음 사이 `space-y-4`(16px). 버튼·배지·표 칸 안쪽 같은 미세 간격만 4px 단위(4·12px) 허용 — 2·6·10·14·20px 값은 쓰지 않는다
- 강조 카드: `rounded-card border border-emphasis-to bg-linear-to-br from-emphasis-from to-emphasis-to text-white` (도넛은 `DonutCard tone="accent"`)

**강조 카드 대비 수정 (2026-10-21)**

| | 수정 전 | 수정 후 |
|---|---|---|
| 그라데이션 | 코퍼 500 `#B8612E` → 600 `#9A4F24` | **`#AD5A2A`** → 600 `#9A4F24` |
| 흰 글씨 최저 대비 (시작점) | 4.39:1 (AA 미달) | **4.91:1** (끝점 5.97:1) |
| 선택한 목록 줄 바탕 | 흰색 15% 겹침 → 흰 글씨 3.74:1 | 검정 10% 겹침 → **5.80:1** |
| 배지 바탕 | 흰색 20% 겹침 → 3.43:1 | 검정 15% 겹침 → **6.31:1** |
| 버튼 호버 | 흰색 10% | 검정 10% |

- 카드 안 모든 작은 글씨가 4.5:1 이상. 흰 글씨는 투명도로 흐리게 하지 않는다 (100%)
- 코퍼 기준값 `#B8612E`는 그대로 — 차트 2번 색·미수금 경과 단계 등에서 계속 쓴다. 조각 간격 색 `ACCENT_SURFACE`는 새 그라데이션의 중간 `#A45527`

## 5. 부품

**배지 (pill)** — 모든 화면에서 높이 24px · 글자 12px Medium (`pillClass`), 색만 바꾼다. 증감은 화살표를 함께 써서 색에만 의존하지 않는다

```tsx
<span className={`${pillClass} bg-success-soft text-success-strong`}>▲5.0%</span>
<span className={`${pillClass} bg-danger-soft text-danger-strong`}>▼3.0%</span>
<span className={`${pillClass} bg-muted text-muted-foreground`}>샘플 데이터</span>
```

**상태 (점 + 글자)** — 표의 상태 칸

```tsx
<span className="inline-flex items-center gap-1.5 text-xs font-medium">
  <span aria-hidden className="size-1.5 rounded-full bg-success" />완료
</span>
```

**세그먼트 토글** — 기간 단위 등 (예: `modules/management/components/period-selector.tsx`)

- 바깥: `inline-flex h-10 rounded-full border border-input bg-card p-1`
- 항목: `flex items-center rounded-full px-4 text-sm font-medium`, 선택 `bg-primary text-primary-foreground`, 나머지 `text-muted-foreground hover:bg-primary-50`
- 드롭다운(select): `h-10 rounded-full border border-input bg-card px-4 text-sm font-medium`
- 작은 테두리 토글(차트 "표로 보기"·내보내기): `chipClass` (높이 32px)

**버튼** — 높이 40px · 라운드 10px · 글자 14px Medium (`styles.ts`)

| 종류 | 상수 | 모양 |
|---|---|---|
| 기본 (저장·확정 등 주 동작) | `buttonPrimaryClass` | 네이비 단색, 호버 primary-800 |
| 보조 (취소·다운로드·되돌리기) | `buttonSecondaryClass` | 흰 바탕 + 1px 보더, 호버 primary-50 |
| 위험 보조 (확정 취소 등) | `buttonDangerClass` | 흰 바탕 + 보더 + 감소색 글자 |
| 위험 확정 (확인창 안에서만) | `buttonDangerSolidClass` | 감소색 단색 |
| 표 행 안의 작은 버튼 | `buttonCompactClass` / 아이콘만 `iconButtonClass` | 높이 32px (표 줄 높이 유지용 예외) |

- 입력칸·드롭다운도 높이 40px(`h-10`)로 버튼과 맞춘다 (표 행 안의 입력칸은 32px)
- `src/shared/ui/button.tsx`(shadcn, 현재 미사용)도 기본 40px · sm 32px 로 맞춰 둠

**호버·포커스**: 배경색만 아주 옅게 바뀐다 — 흰 면 위는 `hover:bg-primary-50`(네이비 50), 네이비 버튼은 `hover:bg-primary-800`. 전환 150ms(`globals.css`가 a·button·summary 에 기본 적용), 이동·확대 같은 움직임 없음. 키보드 포커스는 접근성을 위해 옅은 링(`focus-visible:ring-2 ring-ring/40`)을 함께 둔다 (마우스로는 보이지 않음)

**표**

- `<table className="w-full text-sm [&_td]:px-3 [&_th]:px-3">`
- 머리글: `<thead className="bg-muted text-xs text-muted-foreground">`, `th`는 `py-2.5 font-medium`
- 행: `border-b`, 칸 `py-2.5` (넉넉하게)
- 검색창·필터는 표 카드 오른쪽 위

**체크박스·라디오**: 브라우저 기본 모양 + 브랜드 색(`accent-color`, 전역 적용). 크기 `size-4`

**아이콘**: lucide-react 라인 아이콘
- 선 굵기 1.5 (`globals.css`의 `svg.lucide`가 전체 적용 — 따로 `strokeWidth` 주지 않는다)
- 크기 두 가지만: **16px `size-4`**(글자 옆·버튼 안), **20px `size-5`**(빈 상태·안내 원 안)
- 색: 보조 글자색 `text-muted-foreground`. 버튼·색 있는 안내 띠 안에서는 그 글자색을 따른다
- 강조가 필요하면 연회색 원 안에: `flex size-10 items-center justify-center rounded-full bg-muted` + `size-5` 아이콘

## 6. 차트

비중·달성률 = **도넛**(`src/shared/ui/donut-card.tsx`의 `DonutCard` 재사용), 시계열 = 막대.

- 도넛 두께: 지름의 약 20%, 조각 끝 라운드(4px), 조각 사이 2px 간격(카드 배경색)
- 가운데 핵심 값(22·18·16px Bold, 도넛 선과 겹치지 않게 글자 수로 크기 조절) + 아래 작은 이름, 오른쪽 범례 [색 점 · 항목명 · % · 값], 마우스·키보드로 조각 강조
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

- 헤더: 흰 바탕, 왼쪽 회사 로고(8장) + "경영 대시보드", 오른쪽 프로필(이름·역할 ▾ → 비밀번호 변경·로그아웃)
- 사이드바: 흰 바탕, 현재 메뉴는 네이비 pill(`bg-sidebar-primary`), 메뉴는 권한별로 자동 숨김
- 팀 화면은 `(dashboard)/<팀>/page.tsx` 안의 내용만 만들면 위 셸과 회색 바탕이 씌워진다

## 8. 로고

- 원본: `src/shared/ui/brand/newtork-logo-original.png` (고객사 제공 PNG 738×387, 세로형 = 심볼 위 · 워드마크 아래). SVG 없음
- 화면용: 원본에서 **심볼**(`newtork-symbol.png`, 200×204)과 **워드마크**(`newtork-wordmark.png`, 470×64)를 픽셀 그대로 잘라 가로로 나란히 놓는다 — 세로형 그대로는 헤더 높이(32px)에서 워드마크가 6px 정도로 읽히지 않기 때문. 공식 가로형·SVG를 받으면 이 두 파일만 바꾼다 (05-open-questions 21번)
- 컴포넌트: `<Logo size="md" />`(헤더·403) / `<Logo size="lg" />`(로그인·비밀번호 변경). 직접 `<img>`를 쓰지 않는다
- 이미지 최적화(WebP 재압축)를 끄고(`unoptimized`) 원본 PNG를 그대로 보낸다 — 색 변형 방지. 크기는 width·height 고정이라 레이아웃이 밀리지 않는다

| 위치 | 심볼 높이 | 워드마크 높이 | 둘 사이 | 주변 여백 |
|---|---|---|---|---|
| 헤더 왼쪽 | 32px | 14px | 12px | 위아래 16px(헤더 64px), 왼쪽 24px, 오른쪽 글자까지 16px |
| 로그인·비밀번호 변경 카드 위 | 48px | 20px | 16px | 카드 안쪽 32px, 아래 글자("경영 대시보드")까지 24px |
| 403 화면 카드 위 | 32px | 14px | 12px | 카드 안쪽 32px, 아래 아이콘까지 32px |
| 파비콘 | 심볼만 16·32px (`src/app/favicon.ico`), 180px (`src/app/apple-icon.png`, 흰 바탕 + 여백 15%) | | | |

**규칙**

- 최소 크기: 심볼 높이 **24px 이상** (그보다 작으면 육각형 사이 틈이 뭉개짐 — 파비콘 16px는 틈이 거의 안 보이는 주황 고리로 보임)
- 여백: 로고 주변에 **심볼 높이의 50% 이상** 비워 둔다 (다른 글자·선·버튼이 그 안에 들어오지 않게)
- 바탕: 흰색(`#FFFFFF`) 위에만 둔다 — 화면용 이미지는 원본의 흰 바탕을 그대로 포함
- 금지: 재채색, 가로·세로 비율 변경(늘리기), 그림자, 테두리, 회전, 효과, 강조 카드(코퍼) 위 배치, 심볼과 워드마크 사이 간격·크기 비율 임의 변경
- alt 텍스트: 심볼 이미지 `alt="뉴토크코리아"`, 워드마크는 같은 이름이라 `alt=""` (스크린 리더가 한 번만 읽음)

