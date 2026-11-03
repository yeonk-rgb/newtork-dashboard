"use client";
// 출장지 관리 — 친구 저장소 SitesView 그대로 (추가 · 이름·지역 검색 · 행 안에서 수정 · [출장보고서 요청처에서 가져오기])
// 이름이 출장보고서 요청처와 같은 글자여야 보고서 수·상세의 출장지 단가가 연결된다. 삭제 대신 숨김 (그 출장지 가격도 함께 숨김)
import { useState, useTransition } from "react";

import { cn } from "@/shared/lib/utils";
import {
  buttonCompactClass,
  buttonPrimaryClass,
  buttonSecondaryClass,
  cardTitleClass,
} from "@/shared/ui/styles";

import { regionChoices } from "../regions/regions";
import {
  addSite,
  importSitesFromReports,
  setSiteHidden,
  updateSite,
} from "./actions";
import type { SiteRow } from "./load-catalog";

const REGIONS = regionChoices();
const sigunguOf = (region: string) =>
  REGIONS.find((r) => r.name === region)?.sigungu ?? [];
type Draft = { name: string; region: string; sigungu: string; note: string };
const empty: Draft = { name: "", region: "", sigungu: "", note: "" };
const fix = (d: Draft): Draft => ({
  ...d,
  sigungu:
    d.region === "세종특별자치시"
      ? "세종시"
      : sigunguOf(d.region).includes(d.sigungu)
        ? d.sigungu
        : "",
});
const input =
  "h-9 w-full rounded-lg border border-input bg-background px-2 text-sm aria-invalid:border-destructive disabled:bg-muted";

function RegionSelects({
  d,
  set,
  errors,
  size = "h-9",
  none = ["시·도(선택)", "시·군·구(선택)"],
}: {
  d: Draft;
  set: (d: Draft) => void;
  errors: Record<string, string>;
  size?: string;
  none?: [string, string];
}) {
  return (
    <>
      <select
        aria-label="시·도"
        value={d.region}
        aria-invalid={!!errors.region}
        onChange={(e) => set(fix({ ...d, region: e.target.value }))}
        className={cn(input, size)}
      >
        <option value="">{none[0]}</option>
        {REGIONS.map((r) => (
          <option key={r.name} value={r.name}>
            {r.name}
          </option>
        ))}
      </select>
      <select
        aria-label="시·군·구"
        value={d.sigungu}
        aria-invalid={!!errors.sigungu}
        disabled={!d.region || d.region === "세종특별자치시"}
        onChange={(e) => set({ ...d, sigungu: e.target.value })}
        className={cn(input, size)}
      >
        <option value="">{none[1]}</option>
        {sigunguOf(d.region).map((g) => (
          <option key={g} value={g}>
            {g}
          </option>
        ))}
      </select>
    </>
  );
}

export function SitesTable({
  sites,
  hidden,
  canEdit,
  canHide,
}: {
  sites: SiteRow[];
  hidden: boolean;
  canEdit: boolean;
  canHide: boolean;
}) {
  const [q, setQ] = useState("");
  const [form, setForm] = useState<Draft>(empty);
  const [formErrors, setFormErrors] = useState<Record<string, string>>({});
  const [editId, setEditId] = useState<string | null>(null);
  const [edit, setEdit] = useState<Draft>(empty);
  const [editErrors, setEditErrors] = useState<Record<string, string>>({});
  const [message, setMessage] = useState<{ ok: boolean; text: string } | null>(
    null,
  );
  const [pending, startTransition] = useTransition();
  const say = (r: { ok: boolean; message: string }) =>
    setMessage({ ok: r.ok, text: r.message });
  const k = q.trim();
  const shown = k
    ? sites.filter((s) => s.name.includes(k) || s.regionLabel.includes(k))
    : sites;

  const add = (e: React.FormEvent) => {
    e.preventDefault();
    setFormErrors({});
    startTransition(async () => {
      const r = await addSite(form);
      if (r.ok) setForm(empty);
      else setFormErrors(r.errors ?? {});
      say(r);
    });
  };
  const save = (s: SiteRow) =>
    startTransition(async () => {
      setEditErrors({});
      const r = await updateSite(s.id, s.updatedAt, edit);
      if (r.ok) setEditId(null);
      else setEditErrors(r.errors ?? {});
      say(r);
    });
  const toggle = (s: SiteRow) => {
    if (!s.hidden) {
      const extra = s.priceCount
        ? `\n이 출장지의 부품 가격 ${s.priceCount}개도 함께 숨겨집니다.`
        : "";
      if (
        !window.confirm(
          `${s.name}을(를) 출장지에서 숨길까요?${extra}\n(출장보고서는 그대로 남습니다)`,
        )
      )
        return;
    }
    startTransition(async () => say(await setSiteHidden(s.id, !s.hidden)));
  };
  const importAll = () =>
    startTransition(async () => say(await importSitesFromReports()));

  return (
    <>
      {!hidden && (
        <div className="flex justify-end">
          <button
            type="button"
            disabled={!canEdit || pending}
            onClick={importAll}
            className={buttonSecondaryClass}
          >
            출장보고서 요청처에서 가져오기
          </button>
        </div>
      )}
      {message && (
        <p
          role={message.ok ? "status" : "alert"}
          className={cn(
            "rounded-lg px-3 py-2 text-sm",
            message.ok
              ? "bg-primary-50 text-primary"
              : "bg-danger-soft text-danger-strong",
          )}
        >
          {message.text}
        </p>
      )}
      {!hidden && (
        <form onSubmit={add} className="rounded-card border bg-card p-6">
          <h2 className={cn(cardTitleClass, "mb-3")}>출장지 추가</h2>
          <fieldset
            disabled={!canEdit}
            className="grid grid-cols-12 items-start gap-2"
          >
            <div className="col-span-12 md:col-span-3">
              <input
                aria-label="새 출장지 이름"
                value={form.name}
                aria-invalid={!!formErrors.name}
                onChange={(e) => setForm({ ...form, name: e.target.value })}
                placeholder="출장지(요청처) 이름"
                className={input}
              />
              {formErrors.name && (
                <div className="mt-1 text-xs text-destructive">
                  {formErrors.name}
                </div>
              )}
            </div>
            <div className="col-span-12 grid grid-cols-2 gap-2 md:col-span-4">
              <RegionSelects d={form} set={setForm} errors={formErrors} />
              {(formErrors.region || formErrors.sigungu) && (
                <div className="col-span-2 text-xs text-destructive">
                  {formErrors.region || formErrors.sigungu}
                </div>
              )}
            </div>
            <input
              aria-label="새 출장지 메모"
              maxLength={300}
              value={form.note}
              onChange={(e) => setForm({ ...form, note: e.target.value })}
              placeholder="메모(선택)"
              className={cn(input, "col-span-12 md:col-span-4")}
            />
            <button
              type="submit"
              disabled={pending}
              className={cn(buttonPrimaryClass, "col-span-12 md:col-span-1")}
            >
              추가
            </button>
          </fieldset>
        </form>
      )}
      <section className="rounded-card border bg-card">
        <div className="flex flex-wrap items-center gap-2 px-6 pt-5 pb-3">
          <h2 className={cardTitleClass}>출장지 {sites.length}곳</h2>
          <input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="이름·지역 검색"
            aria-label="출장지 검색"
            className="ml-auto h-8 w-60 rounded-md border border-input bg-background px-2 text-sm"
          />
        </div>
        <div className="overflow-x-auto">
          <table className="w-full min-w-[56rem] text-sm">
            <thead>
              <tr className="border-y bg-muted text-left text-xs text-muted-foreground">
                <th className="px-3 py-2 font-medium">출장지(요청처)</th>
                <th className="px-3 py-2 font-medium">지역</th>
                <th className="px-3 py-2 text-right font-medium">출장보고서</th>
                <th className="px-3 py-2 text-right font-medium">
                  등록된 부품 가격
                </th>
                <th className="px-3 py-2 font-medium">메모</th>
                <th className="px-3 py-2" />
              </tr>
            </thead>
            <tbody>
              {shown.map((s) =>
                editId === s.id ? (
                  <tr key={s.id} className="border-b align-top">
                    <td className="px-3 py-2">
                      <input
                        aria-label="출장지 이름"
                        value={edit.name}
                        aria-invalid={!!editErrors.name}
                        onChange={(e) =>
                          setEdit({ ...edit, name: e.target.value })
                        }
                        className={cn(input, "h-8")}
                      />
                      {editErrors.name && (
                        <div className="mt-1 text-xs text-destructive">
                          {editErrors.name}
                        </div>
                      )}
                    </td>
                    <td className="px-3 py-2">
                      <div className="flex gap-1">
                        <RegionSelects
                          d={edit}
                          set={setEdit}
                          errors={editErrors}
                          size="h-8"
                          none={["미지정", "미확인"]}
                        />
                      </div>
                      {(editErrors.region || editErrors.sigungu) && (
                        <div className="mt-1 text-xs text-destructive">
                          {editErrors.region || editErrors.sigungu}
                        </div>
                      )}
                    </td>
                    <td className="px-3 py-2 text-right tabular-nums">
                      {s.reportCount}
                    </td>
                    <td className="px-3 py-2 text-right tabular-nums">
                      {s.priceCount}
                    </td>
                    <td className="px-3 py-2">
                      <input
                        aria-label="메모"
                        maxLength={300}
                        value={edit.note}
                        onChange={(e) =>
                          setEdit({ ...edit, note: e.target.value })
                        }
                        className={cn(input, "h-8")}
                      />
                    </td>
                    <td className="px-3 py-2 text-right whitespace-nowrap">
                      <button
                        type="button"
                        disabled={pending}
                        onClick={() => save(s)}
                        className={cn(buttonPrimaryClass, "h-8 px-3")}
                      >
                        저장
                      </button>
                      <button
                        type="button"
                        onClick={() => setEditId(null)}
                        className={cn(buttonCompactClass, "ml-1")}
                      >
                        취소
                      </button>
                    </td>
                  </tr>
                ) : (
                  <tr
                    key={s.id}
                    className={cn(
                      "border-b last:border-0",
                      s.hidden && "text-muted-foreground",
                    )}
                  >
                    <td className="px-3 py-2 font-semibold">{s.name}</td>
                    <td className="px-3 py-2 text-xs">{s.regionLabel}</td>
                    <td className="px-3 py-2 text-right tabular-nums">
                      {s.reportCount ? (
                        s.reportCount
                      ) : (
                        <span
                          className="text-xs text-muted-foreground"
                          title="이 이름과 같은 요청처의 출장보고서가 없습니다"
                        >
                          0
                        </span>
                      )}
                    </td>
                    <td className="px-3 py-2 text-right tabular-nums">
                      {s.priceCount}
                    </td>
                    <td className="px-3 py-2 text-xs">{s.note}</td>
                    <td className="px-3 py-2 text-right whitespace-nowrap">
                      {!s.hidden && (
                        <button
                          type="button"
                          disabled={!canEdit}
                          title={
                            canEdit ? undefined : "열람 전용 — 수정은 팀장만"
                          }
                          onClick={() => {
                            setEditId(s.id);
                            setEditErrors({});
                            setEdit({
                              name: s.name,
                              region: s.region ?? "",
                              sigungu: s.sigungu ?? "",
                              note: s.note,
                            });
                          }}
                          className={buttonCompactClass}
                        >
                          수정
                        </button>
                      )}
                      <button
                        type="button"
                        disabled={!canHide || pending}
                        title={
                          canHide ? undefined : "열람 전용 — 숨기기는 팀장만"
                        }
                        onClick={() => toggle(s)}
                        className={cn(buttonCompactClass, "ml-1")}
                      >
                        {s.hidden ? "복구" : "숨김"}
                      </button>
                    </td>
                  </tr>
                ),
              )}
              {shown.length === 0 && (
                <tr>
                  <td
                    colSpan={6}
                    className="px-3 py-6 text-center text-sm text-muted-foreground"
                  >
                    {hidden ? "숨긴 출장지가 없습니다." : "출장지가 없습니다."}
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </section>
    </>
  );
}
