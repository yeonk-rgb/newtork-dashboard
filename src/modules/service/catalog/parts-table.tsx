"use client";
// 부품 목록 표 — 친구 저장소 ServicePartsView 그대로 (메모 바로 고쳐 저장, 교체한 출장지 칩 3개 + "외 N곳", 부품 추가)
// 삭제 대신 숨김 (사용 중인 부품은 숨길 수 없음), 가격 칸 → 출장지 비교(가격 있음) / 부품 가격 관리(미입력)
import Link from "next/link";
import { useState, useTransition } from "react";

import { cn } from "@/shared/lib/utils";
import {
  buttonCompactClass,
  buttonPrimaryClass,
  buttonSecondaryClass,
  cardTitleClass,
} from "@/shared/ui/styles";

import { won } from "../labels";
import { addPart, savePartNote, setPartHidden } from "./actions";
import type { PartRow } from "./load-catalog";

const ORG_PREVIEW = 3;
const range = (p: PartRow) =>
  !p.priceSites
    ? ""
    : p.priceMin === p.priceMax
      ? won(p.priceMin)
      : `${won(p.priceMin)} ~ ${won(p.priceMax)}`;

export function PartsTable({
  parts,
  hidden,
  canEdit,
  canHide,
}: {
  parts: PartRow[];
  hidden: boolean;
  canEdit: boolean;
  canHide: boolean;
}) {
  const [drafts, setDrafts] = useState(() =>
    Object.fromEntries(parts.map((p) => [p.id, p.note])),
  );
  const [all, setAll] = useState<Record<string, boolean>>({});
  const [message, setMessage] = useState<{ ok: boolean; text: string } | null>(
    null,
  );
  const [newPart, setNewPart] = useState({ name: "", note: "" });
  const [newError, setNewError] = useState("");
  const [pending, startTransition] = useTransition();
  const say = (r: { ok: boolean; message: string }) =>
    setMessage({ ok: r.ok, text: r.message });
  const changed = (p: PartRow) => (drafts[p.id] ?? p.note).trim() !== p.note;

  const save = (p: PartRow) =>
    startTransition(async () =>
      say(await savePartNote(p.id, p.updatedAt, drafts[p.id] ?? p.note)),
    );
  const toggle = (p: PartRow) => {
    if (
      !p.hidden &&
      !window.confirm(
        `${p.name}을(를) 부품 목록에서 숨길까요? [숨긴 부품 보기]에서 복구할 수 있습니다.`,
      )
    )
      return;
    startTransition(async () => say(await setPartHidden(p.id, !p.hidden)));
  };
  const add = (e: React.FormEvent) => {
    e.preventDefault();
    setNewError("");
    startTransition(async () => {
      const r = await addPart(newPart);
      if (r.ok) setNewPart({ name: "", note: "" });
      else setNewError(r.errors?.name ?? r.message);
      say(r);
    });
  };

  return (
    <>
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
      <section className="rounded-card border bg-card">
        <div className="overflow-x-auto">
          <table className="w-full min-w-[60rem] text-sm">
            <thead>
              <tr className="border-b bg-muted text-left text-xs text-muted-foreground">
                <th className="px-3 py-2 font-medium">부품명</th>
                <th className="px-3 py-2 font-medium">출장지별 가격</th>
                <th className="min-w-56 px-3 py-2 font-medium">메모</th>
                <th className="px-3 py-2 font-medium">교체한 출장지(요청처)</th>
                <th className="px-3 py-2 text-right font-medium">
                  사용 보고서
                </th>
                <th className="px-3 py-2" />
              </tr>
            </thead>
            <tbody>
              {parts.map((p) => (
                <tr
                  key={p.id}
                  className={cn(
                    "border-b align-middle last:border-0",
                    changed(p) && "bg-warning-soft/40",
                    p.hidden && "text-muted-foreground",
                  )}
                >
                  <td className="px-3 py-2 font-semibold">{p.name}</td>
                  <td className="px-3 py-2 text-xs whitespace-nowrap">
                    <Link
                      href={`${p.priceSites ? "/service/prices/compare" : "/service/prices"}?part=${p.id}`}
                      className="text-primary hover:underline"
                    >
                      {p.priceSites
                        ? `${p.priceSites}곳 · ${range(p)}`
                        : "미입력 — 입력하기"}
                    </Link>
                  </td>
                  <td className="px-3 py-2">
                    <input
                      aria-label={`${p.name} 메모`}
                      maxLength={300}
                      value={drafts[p.id] ?? p.note}
                      disabled={!canEdit || p.hidden}
                      onChange={(e) =>
                        setDrafts({ ...drafts, [p.id]: e.target.value })
                      }
                      onKeyDown={(e) => {
                        if (e.key === "Enter" && changed(p)) {
                          e.preventDefault();
                          save(p);
                        }
                      }}
                      placeholder="메모(선택)"
                      className="h-8 w-full rounded-md border border-input bg-background px-2 text-sm disabled:bg-muted"
                    />
                  </td>
                  <td className="px-3 py-2 text-xs" data-test="used-at">
                    {p.usedAt.length === 0 ? (
                      <span className="text-muted-foreground">-</span>
                    ) : (
                      <>
                        {(all[p.id]
                          ? p.usedAt
                          : p.usedAt.slice(0, ORG_PREVIEW)
                        ).map((o) => (
                          <span
                            key={o.requestOrg}
                            className="mr-1 mb-1 inline-block rounded-full border bg-muted/50 px-2 py-px whitespace-nowrap"
                          >
                            {o.requestOrg || "(요청처 없음)"}{" "}
                            <strong className="text-primary">
                              {o.reports}
                            </strong>
                          </span>
                        ))}
                        {p.usedAt.length > ORG_PREVIEW && (
                          <button
                            type="button"
                            onClick={() =>
                              setAll({ ...all, [p.id]: !all[p.id] })
                            }
                            className="text-primary hover:underline"
                          >
                            {all[p.id]
                              ? "접기"
                              : `외 ${p.usedAt.length - ORG_PREVIEW}곳`}
                          </button>
                        )}
                      </>
                    )}
                  </td>
                  <td className="px-3 py-2 text-right tabular-nums">
                    {p.usageCount}
                  </td>
                  <td className="px-3 py-2 text-right whitespace-nowrap">
                    {!p.hidden && (
                      <button
                        type="button"
                        disabled={!canEdit || !changed(p) || pending}
                        onClick={() => save(p)}
                        className={
                          changed(p)
                            ? cn(buttonPrimaryClass, "h-8 px-3")
                            : buttonCompactClass
                        }
                      >
                        저장
                      </button>
                    )}
                    <button
                      type="button"
                      disabled={
                        !canHide || pending || (!p.hidden && p.usageCount > 0)
                      }
                      title={
                        !canHide
                          ? "열람 전용 — 숨기기는 팀장만"
                          : !p.hidden && p.usageCount
                            ? "출장보고서에서 사용 중이라 숨길 수 없습니다"
                            : undefined
                      }
                      onClick={() => toggle(p)}
                      className={cn(buttonCompactClass, "ml-1")}
                    >
                      {p.hidden ? "복구" : "숨김"}
                    </button>
                  </td>
                </tr>
              ))}
              {parts.length === 0 && (
                <tr>
                  <td
                    colSpan={6}
                    className="px-3 py-6 text-center text-sm text-muted-foreground"
                  >
                    {hidden
                      ? "숨긴 부품이 없습니다."
                      : "부품이 없습니다. 출장보고서에 부품을 입력하면 자동으로 등록됩니다."}
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </section>

      {!hidden && (
        <form onSubmit={add} className="rounded-card border bg-card p-6">
          <h3 className={cn(cardTitleClass, "mb-3")}>부품 추가</h3>
          <div className="grid grid-cols-12 items-start gap-2">
            <div className="col-span-12 md:col-span-5">
              <input
                aria-label="새 부품명"
                value={newPart.name}
                disabled={!canEdit}
                onChange={(e) =>
                  setNewPart({ ...newPart, name: e.target.value })
                }
                aria-invalid={!!newError}
                placeholder="부품명"
                className="h-9 w-full rounded-lg border border-input bg-background px-3 text-sm disabled:bg-muted aria-invalid:border-destructive"
              />
              {newError && (
                <div className="mt-1 text-xs text-destructive">{newError}</div>
              )}
            </div>
            <input
              aria-label="새 부품 메모"
              value={newPart.note}
              disabled={!canEdit}
              onChange={(e) => setNewPart({ ...newPart, note: e.target.value })}
              placeholder="메모(선택)"
              className="col-span-12 h-9 rounded-lg border border-input bg-background px-3 text-sm disabled:bg-muted md:col-span-6"
            />
            <button
              type="submit"
              disabled={!canEdit || pending}
              className={cn(buttonSecondaryClass, "col-span-12 md:col-span-1")}
            >
              추가
            </button>
          </div>
        </form>
      )}
    </>
  );
}
