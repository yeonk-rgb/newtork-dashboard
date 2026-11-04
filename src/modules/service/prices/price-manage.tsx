"use client";
// 부품 가격 관리 — 친구 저장소 PriceManageView 그대로: 부품을 고르면 모든 출장지의 가격을 한 표에서 등록·수정·삭제
// 가격을 비워 둔 출장지는 "미입력"(다른 값으로 채우지 않음). 삭제 = 숨김 (다시 입력하면 되살림). 고른 부품은 주소 ?part=
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";

import { cn } from "@/shared/lib/utils";
import {
  buttonCompactClass,
  buttonPrimaryClass,
  buttonSecondaryClass,
  cardTitleClass,
} from "@/shared/ui/styles";

import { won } from "../labels";
import { removePrice, savePrice } from "../catalog/actions";
import { partStats } from "./compute";
import type { PriceData } from "./load-prices";

const omit = <T,>(o: Record<string, T>, k: string) =>
  Object.fromEntries(Object.entries(o).filter(([key]) => key !== k));
const field =
  "h-9 rounded-lg border border-input bg-background px-2 text-sm disabled:bg-muted";

export function Kpi({
  label,
  value,
  sub,
}: {
  label: string;
  value: React.ReactNode;
  sub: string;
}) {
  return (
    <section className="flex min-w-0 flex-col rounded-card border bg-card p-5">
      <h2 className="text-sm font-semibold">{label}</h2>
      <p className="mt-2 truncate text-[26px] leading-tight font-bold tabular-nums">
        {value}
      </p>
      <div className="mt-1 truncate text-xs text-muted-foreground">{sub}</div>
    </section>
  );
}

export function PriceManage({
  data,
  partId,
  canEdit,
  canHide,
}: {
  data: PriceData;
  partId: string | null;
  canEdit: boolean;
  canHide: boolean;
}) {
  const router = useRouter();
  const { sites, parts, prices } = data;
  const [partSearch, setPartSearch] = useState("");
  const [siteSearch, setSiteSearch] = useState("");
  const [message, setMessage] = useState<{ ok: boolean; text: string } | null>(
    null,
  );
  const [pending, startTransition] = useTransition();
  const part = parts.find((p) => p.id === partId) ?? null;
  const priceBySite = new Map(
    prices.filter((p) => p.partId === partId).map((p) => [p.siteId, p]),
  );
  const [drafts, setDrafts] = useState<
    Record<string, { price: string; note: string }>
  >({});
  const draft = (siteId: string) => {
    const cur = priceBySite.get(siteId);
    return (
      drafts[siteId] ?? {
        price: cur ? String(cur.unitPrice) : "",
        note: cur?.note ?? "",
      }
    );
  };
  const changed = (siteId: string) => {
    const cur = priceBySite.get(siteId);
    const d = draft(siteId);
    return (
      (cur ? String(cur.unitPrice) : "") !== d.price.trim() ||
      (cur?.note ?? "") !== d.note.trim()
    );
  };
  const k = partSearch.trim().toLowerCase();
  const partOptions = k
    ? parts.filter((p) => p.name.toLowerCase().includes(k))
    : parts;
  const rows = sites.filter(
    (s) =>
      !siteSearch.trim() ||
      s.name.includes(siteSearch.trim()) ||
      s.regionLabel.includes(siteSearch.trim()),
  );
  const stats = part ? partStats(prices, part.id) : null;

  const choose = (id: string) => {
    setDrafts({});
    router.replace(`/service/prices?part=${id}`);
  };
  const save = (siteId: string) => {
    const d = draft(siteId);
    if (!/^\d+$/.test(d.price.trim())) {
      setMessage({
        ok: false,
        text: "단가는 0 이상의 정수(원)로 입력하세요. 가격을 지우려면 [삭제]를 누르세요.",
      });
      return;
    }
    startTransition(async () => {
      const r = await savePrice({
        siteId,
        partId,
        unitPrice: d.price.trim(),
        note: d.note.trim(),
      });
      setMessage({ ok: r.ok, text: r.message });
      if (r.ok) setDrafts((all) => omit(all, siteId));
    });
  };
  const remove = (siteId: string, siteName: string) => {
    const cur = priceBySite.get(siteId);
    if (
      !cur ||
      !part ||
      !window.confirm(
        `${siteName}의 ${part.name} 가격(${won(cur.unitPrice)})을 삭제할까요?`,
      )
    )
      return;
    startTransition(async () => {
      const r = await removePrice(siteId, part.id);
      setMessage({ ok: r.ok, text: r.message });
      if (r.ok) setDrafts((all) => omit(all, siteId));
    });
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-end gap-2">
        <input
          value={partSearch}
          onChange={(e) => setPartSearch(e.target.value)}
          placeholder="부품 검색"
          aria-label="부품 검색"
          className={cn(field, "w-40")}
        />
        <select
          value={partId ?? ""}
          onChange={(e) => choose(e.target.value)}
          aria-label="부품 선택"
          className={cn(field, "min-w-52")}
        >
          {partOptions.map((p) => (
            <option key={p.id} value={p.id}>
              {p.name}
            </option>
          ))}
        </select>
        {partId && (
          <Link
            href={`/service/prices/compare?part=${partId}`}
            className={buttonSecondaryClass}
          >
            출장지 비교 보기
          </Link>
        )}
      </div>
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
      {!parts.length ? (
        <p className="rounded-card border bg-card p-5 text-sm text-muted-foreground">
          부품이 없습니다. 출장보고서에 부품을 입력하거나{" "}
          <Link href="/service/parts" className="text-primary hover:underline">
            부품 목록
          </Link>
          에서 추가하세요.
        </p>
      ) : !sites.length ? (
        <p className="rounded-card border bg-card p-5 text-sm text-muted-foreground">
          출장지가 없습니다.{" "}
          <Link href="/service/sites" className="text-primary hover:underline">
            출장지 관리
          </Link>
          에서 먼저 등록하세요.
        </p>
      ) : part && stats ? (
        <>
          <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
            <Kpi
              label="가격 등록 출장지"
              value={
                <>
                  {stats.count}{" "}
                  <small className="text-base font-normal text-muted-foreground">
                    / {sites.length}곳
                  </small>
                </>
              }
              sub={part.name}
            />
            <Kpi
              label="최저 단가"
              value={won(stats.min)}
              sub="등록된 출장지 중"
            />
            <Kpi
              label="최고 단가"
              value={won(stats.max)}
              sub="등록된 출장지 중"
            />
            <Kpi
              label="평균 단가"
              value={won(stats.avg)}
              sub="미입력 출장지 제외"
            />
          </div>
          <section className="rounded-card border bg-card">
            <div className="flex flex-wrap items-center gap-2 px-6 pt-5 pb-3">
              <h2 className={cardTitleClass}>{part.name} · 출장지별 가격</h2>
              {part.note && (
                <span className="text-xs text-muted-foreground">
                  메모: {part.note}
                </span>
              )}
              <input
                value={siteSearch}
                onChange={(e) => setSiteSearch(e.target.value)}
                placeholder="출장지 검색"
                aria-label="출장지 검색"
                className={cn(field, "ml-auto h-8 w-56")}
              />
            </div>
            <div className="overflow-x-auto">
              <table className="w-full min-w-[56rem] text-sm">
                <thead>
                  <tr className="border-y bg-muted text-left text-xs text-muted-foreground">
                    <th className="px-3 py-2 font-medium">출장지</th>
                    <th className="px-3 py-2 font-medium">지역</th>
                    <th className="w-44 px-3 py-2 font-medium">단가(원)</th>
                    <th className="min-w-52 px-3 py-2 font-medium">메모</th>
                    <th className="px-3 py-2 font-medium">최근 수정</th>
                    <th className="px-3 py-2" />
                  </tr>
                </thead>
                <tbody>
                  {rows.map((s) => {
                    const d = draft(s.id);
                    const cur = priceBySite.get(s.id);
                    const set = (k: "price" | "note", v: string) =>
                      setDrafts({ ...drafts, [s.id]: { ...d, [k]: v } });
                    const enter = (e: React.KeyboardEvent) => {
                      if (e.key === "Enter" && changed(s.id)) {
                        e.preventDefault();
                        save(s.id);
                      }
                    };
                    return (
                      <tr
                        key={s.id}
                        className={cn(
                          "border-b last:border-0",
                          changed(s.id) && "bg-warning-soft/40",
                        )}
                      >
                        <td className="px-3 py-1.5 font-semibold">{s.name}</td>
                        <td className="px-3 py-1.5 text-xs">{s.regionLabel}</td>
                        <td className="px-3 py-1.5">
                          <input
                            inputMode="numeric"
                            value={d.price}
                            disabled={!canEdit}
                            onChange={(e) => set("price", e.target.value)}
                            onKeyDown={enter}
                            aria-label={`${s.name} 단가`}
                            placeholder="미입력"
                            className={cn(field, "h-8 w-full")}
                          />
                        </td>
                        <td className="px-3 py-1.5">
                          <input
                            maxLength={300}
                            value={d.note}
                            disabled={!canEdit}
                            onChange={(e) => set("note", e.target.value)}
                            onKeyDown={enter}
                            aria-label={`${s.name} 메모`}
                            placeholder="메모(선택)"
                            className={cn(field, "h-8 w-full")}
                          />
                        </td>
                        <td className="px-3 py-1.5 text-xs text-muted-foreground">
                          {cur
                            ? `${cur.updatedBy} · ${cur.updatedAtLabel}`
                            : ""}
                        </td>
                        <td className="px-3 py-1.5 text-right whitespace-nowrap">
                          <button
                            type="button"
                            disabled={!canEdit || !changed(s.id) || pending}
                            onClick={() => save(s.id)}
                            className={
                              changed(s.id)
                                ? cn(buttonPrimaryClass, "h-8 px-3")
                                : buttonCompactClass
                            }
                          >
                            저장
                          </button>
                          {cur && (
                            <button
                              type="button"
                              disabled={!canHide || pending}
                              title={
                                canHide
                                  ? undefined
                                  : "열람 전용 — 삭제는 팀장만"
                              }
                              onClick={() => remove(s.id, s.name)}
                              className="ml-1 text-xs text-danger-strong hover:underline disabled:opacity-40"
                            >
                              삭제
                            </button>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </section>
        </>
      ) : null}
    </div>
  );
}
