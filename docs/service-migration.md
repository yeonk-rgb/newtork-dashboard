# 서비스·부품·가격 화면 옮기기 (통합 3단계, 2026-11-03)

친구 저장소(lyjradiant-max/newtalk-korea-system)의 `backend/service/`(모델·API·집계)와 `frontend/src/views/service/` 를 이 저장소로 옮긴다.
규칙은 친구 저장소 그대로, 이 저장소 규칙(삭제 대신 숨김·변경 이력·design-guide 색·`can()` 권한)을 덧붙인다.

## 화면 9개

| 메뉴 묶음 | 화면 | 친구 주소 → 본체 주소 | 친구 파일 | 본체 폴더 |
|---|---|---|---|---|
| 서비스 | 서비스 대시보드 | `/service` | `ServiceDashboardView.vue` · `RegionBubbleMap.vue` · `dashboard.py` | `service/dashboard/` · `metrics/dashboard.ts` |
| 서비스 | 출장보고서 목록 | `/service/reports` | `ServiceReportsView.vue` | `service/reports/` |
| 서비스 | 출장보고서 상세(+첨부) | `/service/reports/{id}` | `ServiceReportDetailView.vue` | `service/reports/` |
| 서비스 | 출장보고서 입력·수정·PDF로 등록 | `/service/reports/new` · `?from=pdf` · `/{id}/edit` | `ServiceReportFormView.vue` · `pdf_import.py` | `service/reports/` · `pdf/` |
| 부품·가격 | 부품 목록 | `/service/parts` | `ServicePartsView.vue` | `service/parts/` |
| 부품·가격 | 출장지 관리 | `/service/sites` | `SitesView.vue` | `service/sites/` |
| 부품·가격 | 부품 가격 관리 | `/service/prices` | `PriceManageView.vue` | `service/prices/` |
| 부품·가격 | 출장지별 가격 조회 | `/service/prices/by-site` | `PriceBySiteView.vue` | `service/prices/` |
| 부품·가격 | 출장지 비교 분석 | `/service/prices/compare` | `PriceCompareView.vue` · `PriceBarChart.vue` | `service/prices/` |

친구 앱 메뉴(`config/menu.js`)에 있는 서비스·부품 화면은 이 9개가 전부다(엑셀 가져오기 `import_service_xlsx`·`seed_price_demo` 는 화면 없는 관리 명령).

## 테이블

| 친구 모델 | 본체 테이블 | 상태 | 이 저장소에서 더한 것 |
|---|---|---|---|
| `ServiceReport` | `svc_report` | 통합 1단계에 있음 | `deletedAt`·`deletedById`(숨김) |
| `ReportCompanion` · `ReportProduct` | `svc_report_companion` · `svc_report_product` | 있음 | — |
| `Part` | `svc_part` (새로) | 이름 고유 | 숨김 |
| `Site` | `svc_site` (새로) | 이름 고유 = 요청처와 같은 글자로 연결 | 숨김 |
| `SitePartPrice` | `svc_site_part_price` (새로) | (출장지, 부품) 고유, 단가 원 | 삭제 = 숨김(다시 입력하면 같은 행을 되살림) |
| `ReportPart` | `svc_report_part` (새로) | (보고서, 부품) 고유, 수량 선택 | — |
| `ReportAttachment` | `svc_report_attachment` (새로) | 종류 7개, SHA-256 | **파일은 DB(`bytea`)에 저장** — 배포 서버(Render)에 디스크가 없어서. 삭제 = 숨김 |

## 계산 규칙 (친구 `dashboard.py`·화면 코드 그대로)

| 항목 | 규칙 |
|---|---|
| 기간 | 출장 시작일 기준, 없으면 어느 기간에도 넣지 않고 따로 셈 |
| 유상 비율 | 유상 ÷ (유상 + 무상), 미입력 제외, 소수 1자리 |
| 지역 | 시·도 + 시·군·구(2026-10-01 공식 목록 `sigungu.json`, CC BY 4.0), 비율 분모 = 기간 전체 출장(미지정 포함) |
| 담당자 | 작성자 + 동행자, 보고서 1건에 1명 1회 |
| 교체 부품 순위 | 부품을 쓴 보고서 수, 수량은 입력된 것만 합, 상위 10 + "기타 N개" |
| 제품 모델 순위 | 수량 합 기준, 보고서 수·수량 미입력 함께 |
| 가격 | 출장지별 직접 입력, 없는 조합은 "미입력"(다른 값으로 채우지 않음). 평균 = 미입력 제외, 평균 대비 % 소수 1자리 |
| 출장지 비교 | 공통 부품만(고른 출장지 모두에 가격 있는 부품) / 등록된 부품 전체, 공통 부품이 없으면 전체로 계산하고 안내 |
| 금액 | 부품 비용·매출 합계는 계산하지 않음 |

## 권한 (생산과 같은 방식)

| 사용자 | 서비스·부품·가격 |
|---|---|
| 관리자·대표·경영지원팀 | 모두 |
| 서비스팀장(수정 권한) | 열람 + 입력·수정·숨김 |
| 서비스팀원 | 열람만 — 버튼 비활성 + "열람 전용" |
| 생산팀 | 접근 불가 (403) |

## 친구 앱과 다르게 한 것

| 항목 | 친구 앱 | 본체 | 이유 |
|---|---|---|---|
| 삭제 | 보고서·부품·출장지·가격·첨부를 지움 | 숨김 + 복구 | 이 저장소 규칙(삭제 대신 숨김) |
| 변경 이력 | 없음 | `audit_log` `area: "service"` | 이 저장소 규칙 |
| 수정 권한 | 서비스팀이면 누구나 | 팀장 이상 | 처음 요구사항(팀원은 열람만) |
| 차트 | Chart.js · chartjs-chart-geo | Recharts · SVG 지도(같은 경계 자료를 미리 투영) | 이 저장소 차트 도구 |
| PDF 글자 읽기 | pypdfium2 | pdfjs-dist | Node 서버 — 같은 줄 규칙(`parse`)을 그대로 옮김 |
| 첨부 저장 | 서버 디스크 | DB | 배포 서버에 디스크 없음 |
