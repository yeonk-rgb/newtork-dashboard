// 일련번호 검색·제품 상세 (서버) — 친구 저장소 SerialSearchView.vue 그대로. 상태는 주소(?serial=, ?id=, ?list=1)
// 같은 일련번호가 여러 건이면(시트가 다름) 임의로 하나를 고르지 않고 목록에서 고른다. 숨긴 행은 찾지 않는다
import "server-only";

import Link from "next/link";

import { getCurrentUser, loadUserNames } from "@/shared/auth";
import { cn } from "@/shared/lib/utils";
import { Forbidden } from "@/shared/ui/forbidden";
import {
  buttonPrimaryClass,
  buttonSecondaryClass,
  labelClass,
  pageTitleClass,
  pillClass,
} from "@/shared/ui/styles";

import { INDUSTRY_LABEL, UNCLASSIFIED_LABEL, formatBush } from "../labels";
import { ReadOnlyBadge } from "../read-only-badge";
import type { RecordRowData } from "../records/load-records";
import type { RecordRow } from "../records/record-table";
import { toRow } from "../records/to-row";
import { productionAbilities } from "../rules";
import { EditButton } from "./edit-button";
import { loadSerialDetail, searchSerial } from "./load-search";

const str = (v: string | string[] | undefined) =>
  typeof v === "string" ? v : undefined;
const v = (value: string | null | undefined) => value || "-";
const searchHref = (serial: string, extra = "") =>
  `/production/search?serial=${encodeURIComponent(serial)}${extra}`;

function Spec({ rows }: { rows: [string, React.ReactNode][] }) {
  return (
    <dl className="grid grid-cols-[6rem_1fr] gap-x-3 gap-y-2 text-sm">
      {rows.map(([dt, dd]) => (
        <div key={dt} className="contents">
          <dt className="text-muted-foreground">{dt}</dt>
          <dd className="font-medium break-all">{dd}</dd>
        </div>
      ))}
    </dl>
  );
}

const shippedBadge = (shipped: string | undefined) =>
  shipped ? (
    <span className={cn(pillClass, "bg-muted text-foreground")}>
      출고 {shipped}
    </span>
  ) : (
    <span className={cn(pillClass, "bg-warning-soft text-warning-strong")}>
      출고일 없음
    </span>
  );

function ResultTable({ rows, serial }: { rows: RecordRow[]; serial: string }) {
  return (
    <div className="overflow-x-auto">
      <table className="w-full min-w-[48rem] text-sm">
        <thead>
          <tr className="border-b bg-muted text-left text-xs text-muted-foreground">
            {[
              "일련번호",
              "시트",
              "모델명",
              "판매처",
              "수주번호",
              "납기일자",
              "출고일자",
            ].map((h) => (
              <th key={h} className="px-3 py-2 font-medium">
                {h}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((r) => (
            <tr
              key={r.id}
              className="border-b last:border-0 hover:bg-primary-50"
            >
              <td className="px-3 py-2 font-semibold">
                <Link
                  href={searchHref(serial || r.serialNo, `&id=${r.id}`)}
                  className="text-primary hover:underline"
                >
                  {r.serialNo}
                </Link>
              </td>
              <td className="px-3 py-2">{r.sheetName}</td>
              <td className="px-3 py-2">{v(r.modelCode)}</td>
              <td className="px-3 py-2">{v(r.seller)}</td>
              <td className="px-3 py-2">{v(r.orderNo)}</td>
              <td className="px-3 py-2 tabular-nums">{v(r.dueDate)}</td>
              <td className="px-3 py-2 tabular-nums">
                {r.shippedDate || shippedBadge(undefined)}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function Detail({
  row,
  exactCount,
  moreSimilar,
  serial,
  canEdit,
}: {
  row: RecordRow;
  exactCount: number;
  moreSimilar: number;
  serial: string;
  canEdit: boolean;
}) {
  const calendarHref = row.dueDate
    ? `/production/calendar?year=${Number(row.dueDate.slice(0, 4))}&month=${Number(row.dueDate.slice(5, 7))}&date=${row.dueDate}${row.orderNo ? `&order=${encodeURIComponent(row.orderNo)}` : ""}`
    : null;
  return (
    <>
      {exactCount > 1 ? (
        <p className="flex flex-wrap items-center gap-2 rounded-lg bg-warning-soft px-4 py-2 text-sm text-warning-strong">
          같은 일련번호가 {exactCount}건 있습니다. 지금 보는 건은 시트{" "}
          <strong>{row.sheetName}</strong>입니다.
          <Link
            href={searchHref(row.serialNo)}
            className="ml-auto text-primary hover:underline"
          >
            목록으로
          </Link>
        </p>
      ) : (
        moreSimilar > 0 && (
          <p className="text-sm text-muted-foreground">
            비슷한 일련번호 {moreSimilar}건이 더 있습니다.{" "}
            <Link
              href={searchHref(serial, "&list=1")}
              className="text-primary hover:underline"
            >
              목록 보기
            </Link>
          </p>
        )
      )}

      <section className="rounded-card border bg-card p-6">
        <div className="mb-4 flex flex-wrap items-center gap-2">
          <h2 className="text-2xl font-bold tabular-nums">{row.serialNo}</h2>
          <span className={cn(pillClass, "border bg-card text-foreground")}>
            {row.sheetName}
          </span>
          {row.category && (
            <span className={cn(pillClass, "bg-brand-soft text-primary")}>
              {INDUSTRY_LABEL[row.category]}
            </span>
          )}
          {shippedBadge(row.shippedDate || undefined)}
          <div className="ml-auto flex gap-2">
            {calendarHref ? (
              <Link href={calendarHref} className={buttonSecondaryClass}>
                같은 수주번호 일정 보기
              </Link>
            ) : (
              <span
                aria-disabled
                title="납기일이 없어 캘린더에 표시되지 않습니다"
                className={cn(
                  buttonSecondaryClass,
                  "pointer-events-none opacity-50",
                )}
              >
                같은 수주번호 일정 보기
              </span>
            )}
            <EditButton row={row} canEdit={canEdit} />
          </div>
        </div>
        {row.warnings.length > 0 && (
          <div className="mb-4 rounded-lg bg-warning-soft px-4 py-2 text-sm text-warning-strong">
            {row.warnings.map((w, i) => (
              <p key={i}>⚠ {w.message}</p>
            ))}
          </div>
        )}

        <div className="grid gap-6 lg:grid-cols-3">
          <section>
            <h3 className="mb-3 border-b pb-1.5 text-xs font-bold text-muted-foreground">
              제품 사양
            </h3>
            <Spec
              rows={[
                ["모델명", v(row.modelCode)],
                [
                  "플랜지",
                  <span
                    key="f"
                    className="text-xs font-normal text-muted-foreground"
                  >
                    자료 없음 — 제조내역 엑셀에 플랜지 항목이 없습니다
                  </span>,
                ],
                [
                  "부시 사이즈",
                  row.bushSize ? (
                    <>
                      {formatBush(row.bushSize)}{" "}
                      <span className="text-xs font-normal text-muted-foreground">
                        ({row.bushSize})
                      </span>
                    </>
                  ) : (
                    "-"
                  ),
                ],
                ["RPM", v(row.rpm)],
                ["전원", v(row.power)],
              ]}
            />
          </section>
          <section>
            <h3 className="mb-3 border-b pb-1.5 text-xs font-bold text-muted-foreground">
              제조·검사
            </h3>
            <Spec
              rows={[
                ["제조년월", v(row.manufacturedDate?.slice(0, 7))],
                ["검사일자", v(row.inspectedDate)],
                ["검사번호", v(row.inspectionNo)],
              ]}
            />
          </section>
          <section>
            <h3 className="mb-3 border-b pb-1.5 text-xs font-bold text-muted-foreground">
              판매·납품
            </h3>
            <Spec
              rows={[
                ["수주번호", v(row.orderNo)],
                ["판매처", v(row.seller)],
                ["최종발주처", v(row.finalClient)],
                ["사업명", v(row.projectName)],
                [
                  "사업구분",
                  row.category
                    ? INDUSTRY_LABEL[row.category]
                    : UNCLASSIFIED_LABEL,
                ],
                ["출고일자", v(row.shippedDate)],
                ["납기일자", v(row.dueDate)],
                ["비고", v(row.note)],
              ]}
            />
          </section>
        </div>

        <details className="mt-4">
          <summary className="cursor-pointer text-sm text-primary">
            원본 추가 정보
          </summary>
          <div className="mt-2 max-w-2xl rounded-lg bg-muted px-4 py-3">
            <Spec
              rows={[
                ["SO번호", v(row.soNo)],
                ["거래처 주문번호", v(row.customerOrderNo)],
                ["기타", v(row.etc)],
                ["비고2", v(row.note2)],
                ["OPUN / CLUN", `${v(row.opun)} / ${v(row.clun)}`],
                ["OPLO / CLLO", `${v(row.oplo)} / ${v(row.cllo)}`],
                ["수량", row.quantity || "미입력"],
                ["엑셀 위치", `${row.sheetName} · ${row.sourceRow}행`],
                ["업로드 파일", row.fileName],
                ["최근 수정", `${row.updatedBy} (${row.updatedAtLabel})`],
              ]}
            />
          </div>
        </details>
      </section>
    </>
  );
}

export async function SerialSearchScreen({
  searchParams,
}: {
  searchParams: Record<string, string | string[] | undefined>;
}) {
  const user = await getCurrentUser();
  const abilities = productionAbilities(user);
  if (!abilities.canView) return <Forbidden user={user} />;

  const rawSerial = str(searchParams.serial);
  const id = str(searchParams.id);
  const serial = (rawSerial ?? "").trim().slice(0, 50);
  const listMode = str(searchParams.list) === "1";

  const toRows = async (rows: RecordRowData[]) => {
    const nameOf = await loadUserNames(rows.map((r) => r.updatedById));
    return rows.map((r) => toRow(r, nameOf));
  };

  let body: React.ReactNode = null;
  if (id) {
    const found = await loadSerialDetail(id);
    body = found ? (
      <Detail
        row={(await toRows([found.detail]))[0]}
        exactCount={found.exact.length}
        moreSimilar={0}
        serial={serial || found.detail.serialNo}
        canEdit={abilities.canEdit}
      />
    ) : (
      <p
        role="alert"
        className="rounded-lg bg-danger-soft px-4 py-2 text-sm text-danger-strong"
      >
        해당 제조내역을 찾을 수 없습니다. 숨겼거나 없는 행일 수 있습니다.
      </p>
    );
  } else if (rawSerial !== undefined && !serial) {
    body = (
      <p className="rounded-lg bg-muted px-4 py-2 text-sm">
        일련번호를 입력하세요.
      </p>
    );
  } else if (serial) {
    const { exact, similar } = await searchSerial(serial);
    if (exact.length === 1 && !listMode) {
      body = (
        <Detail
          row={(await toRows(exact))[0]}
          exactCount={1}
          moreSimilar={Math.max(similar.total - 1, 0)}
          serial={serial}
          canEdit={abilities.canEdit}
        />
      );
    } else if (exact.length > 1 || similar.total > 0) {
      const duplicates = exact.length > 1;
      body = (
        <section className="rounded-card border bg-card pt-6">
          <div className="px-6 pb-3">
            {duplicates ? (
              <p
                role="status"
                className="rounded-lg bg-warning-soft px-4 py-2 text-sm text-warning-strong"
              >
                <strong>
                  같은 일련번호 &quot;{serial}&quot;가 {exact.length}건
                  있습니다.
                </strong>{" "}
                시트(연도·제품 계열)가 다른 제조내역입니다. 확인할 건을
                선택하세요.
              </p>
            ) : (
              <p className="text-sm">
                {exact.length === 0 && "정확히 일치하는 일련번호가 없습니다. "}
                <strong>비슷한 일련번호 {similar.total}건</strong>
                {similar.total > similar.rows.length && (
                  <span className="text-muted-foreground">
                    {" "}
                    (앞의 {similar.rows.length}건 표시 — 더 정확히 입력하세요)
                  </span>
                )}
              </p>
            )}
          </div>
          <ResultTable
            rows={await toRows(duplicates ? exact : similar.rows)}
            serial={serial}
          />
        </section>
      );
    } else {
      body = (
        <section className="rounded-card border bg-card p-6">
          <h2 className="font-bold">
            일련번호 &quot;{serial}&quot;에 해당하는 제조내역이 없습니다.
          </h2>
          <ul className="mt-2 list-disc space-y-1 pl-5 text-sm text-muted-foreground">
            <li>
              엑셀의 일련번호는 앞자리 0을 포함한 4자리입니다(예:{" "}
              <code>0001</code>).
            </li>
            <li>엑셀에서 일련번호 칸이 비어 있는 행은 저장되지 않습니다.</li>
            <li>
              숨긴 행은 찾지 않습니다 —{" "}
              <Link
                href="/production/records?hidden=1"
                className="text-primary hover:underline"
              >
                숨긴 행 보기
              </Link>
            </li>
            <li>
              해당 제조내역 엑셀이 올라갔는지{" "}
              <Link
                href="/production/upload"
                className="text-primary hover:underline"
              >
                업로드 이력
              </Link>
              에서 확인하세요.
            </li>
          </ul>
        </section>
      );
    }
  }

  return (
    <div className="space-y-4">
      <h1 className={`${pageTitleClass} flex flex-wrap items-center gap-3`}>
        일련번호 검색
        {!abilities.canEdit && (
          <ReadOnlyBadge note="수정은 팀장만 할 수 있습니다" />
        )}
      </h1>
      <form method="get" className="rounded-card border bg-card p-6">
        <label htmlFor="s-serial" className={cn(labelClass, "text-sm")}>
          일련번호
        </label>
        <div className="mt-1 flex max-w-lg gap-2">
          <input
            id="s-serial"
            name="serial"
            defaultValue={rawSerial ?? ""}
            placeholder="예: 0001 (일부만 입력해도 됩니다)"
            autoComplete="off"
            autoFocus
            className="h-10 flex-1 rounded-lg border border-input bg-background px-3 text-sm"
          />
          <button type="submit" className={cn(buttonPrimaryClass, "px-6")}>
            검색
          </button>
        </div>
        <p className="mt-1 text-xs text-muted-foreground">
          제조내역 엑셀 B열의 일련번호(앞자리 0 포함 4자리)로 찾습니다.
        </p>
      </form>
      {body}
    </div>
  );
}
