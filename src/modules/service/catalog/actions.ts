"use server";
// 부품·출장지·출장지별 가격 입력·수정·숨김 — 친구 저장소 PartViewSet·SiteViewSet·SitePartPriceViewSet 규칙 그대로
// 권한: 입력·수정 = 서비스 edit(팀장 이상), 숨김·복구 = confirm. 삭제 대신 숨김 + 변경 이력 (service-parts·service-sites·service-prices)
import { refresh } from "next/cache";
import { z } from "zod";

import { diffFields, won, type AuditField } from "@/shared/audit/diff";
import { recordAudit } from "@/shared/audit/record";
import { getCurrentUser, type AppUser } from "@/shared/auth";
import { prisma } from "@/shared/db/client";
import type { Prisma } from "@/shared/db/generated/client";
import { getNow } from "@/shared/time/now";

import { isValidRegion, regionLabel, SIGUNGU } from "../regions/regions";
import { NO_EDIT_MESSAGE, serviceAbilities } from "../rules";

export type ActionResult = {
  ok: boolean;
  message: string;
  errors?: Record<string, string>;
};

const CONFLICT = "다른 사람이 먼저 수정했습니다. 새로고침 후 다시 시도하세요.";
class ConflictError extends Error {}
const actor = (u: AppUser) => ({ id: u.id, loginId: u.loginId });

async function userWith(kind: "canEdit" | "canHide") {
  const user = await getCurrentUser();
  return user && serviceAbilities(user)[kind] ? user : null;
}

async function run(fn: () => Promise<ActionResult>): Promise<ActionResult> {
  try {
    const r = await fn();
    if (r.ok) refresh();
    return r;
  } catch (error) {
    if (error instanceof ConflictError) return { ok: false, message: CONFLICT };
    throw error;
  }
}

// ---------- 부품 ----------

const partName = z.string().trim().min(1, "부품명을 입력하세요.").max(200);
const note = z.string().trim().max(300).default("");

export async function addPart(raw: unknown): Promise<ActionResult> {
  const user = await userWith("canEdit");
  if (!user) return { ok: false, message: NO_EDIT_MESSAGE };
  const parsed = z.object({ name: partName, note }).safeParse(raw);
  if (!parsed.success) {
    return {
      ok: false,
      message: parsed.error.issues[0].message,
      errors: { name: parsed.error.issues[0].message },
    };
  }
  const { name, note: memo } = parsed.data;
  const now = await getNow();
  return run(async () => {
    const same = await prisma.svcPart.findUnique({ where: { name } });
    if (same) {
      const message = same.deletedAt
        ? "숨긴 부품 중에 같은 이름이 있습니다. [숨긴 부품 보기]에서 복구하세요."
        : "이미 있는 부품명입니다.";
      return { ok: false, message, errors: { name: message } };
    }
    await prisma.$transaction(async (tx) => {
      const p = await tx.svcPart.create({
        data: { name, note: memo, createdById: user.id, updatedById: user.id },
      });
      await recordAudit(tx, {
        occurredAt: now,
        actor: actor(user),
        area: "service",
        screen: "service-parts",
        action: "CREATE",
        target: { type: "SvcPart", id: p.id, label: name },
        changes: diffFields(null, { name, note: memo }, [
          { key: "name", label: "부품명" },
          { key: "note", label: "메모" },
        ]),
      });
    });
    return {
      ok: true,
      message: `${name}을(를) 추가했습니다. 가격은 [부품 가격 관리]에서 출장지별로 입력하세요.`,
    };
  });
}

export async function savePartNote(
  id: string,
  updatedAt: string,
  rawNote: string,
): Promise<ActionResult> {
  const user = await userWith("canEdit");
  if (!user) return { ok: false, message: NO_EDIT_MESSAGE };
  const memo = note.parse(String(rawNote ?? ""));
  const now = await getNow();
  return run(() =>
    prisma.$transaction(async (tx) => {
      const before = await tx.svcPart.findUnique({ where: { id: String(id) } });
      if (!before || before.deletedAt) throw new ConflictError();
      const updated = await tx.svcPart.updateMany({
        where: { id: before.id, updatedAt: new Date(updatedAt) },
        data: { note: memo, updatedById: user.id },
      });
      if (updated.count === 0) throw new ConflictError();
      const changes = diffFields(before, { note: memo }, [
        { key: "note", label: "메모" },
      ]);
      if (changes.length) {
        await recordAudit(tx, {
          occurredAt: now,
          actor: actor(user),
          area: "service",
          screen: "service-parts",
          action: "UPDATE",
          target: { type: "SvcPart", id: before.id, label: before.name },
          changes,
        });
      }
      return { ok: true, message: `${before.name} 메모를 저장했습니다.` };
    }),
  );
}

/** 숨김·복구 — 숨기지 않은 출장보고서에서 쓰는 부품은 숨길 수 없다 (친구: 사용 중이면 삭제 불가) */
export async function setPartHidden(
  id: string,
  hide: boolean,
): Promise<ActionResult> {
  const user = await userWith("canHide");
  if (!user) return { ok: false, message: NO_EDIT_MESSAGE };
  const now = await getNow();
  return run(() =>
    prisma.$transaction(async (tx) => {
      const p = await tx.svcPart.findUnique({ where: { id: String(id) } });
      if (!p || (p.deletedAt !== null) === hide) throw new ConflictError();
      if (hide) {
        const used = await tx.svcReportPart.count({
          where: { partId: p.id, report: { deletedAt: null } },
        });
        if (used) {
          return {
            ok: false,
            message: "출장보고서에서 사용 중인 부품은 숨길 수 없습니다.",
          };
        }
      }
      await tx.svcPart.update({
        where: { id: p.id },
        data: hide
          ? { deletedAt: now, deletedById: user.id }
          : { deletedAt: null, deletedById: null },
      });
      await recordAudit(tx, {
        occurredAt: now,
        actor: actor(user),
        area: "service",
        screen: "service-parts",
        action: hide ? "HIDE" : "RESTORE",
        target: { type: "SvcPart", id: p.id, label: p.name },
      });
      return {
        ok: true,
        message: hide
          ? `${p.name}을(를) 숨겼습니다.`
          : `${p.name}을(를) 복구했습니다.`,
      };
    }),
  );
}

// ---------- 출장지 ----------

const siteSchema = z
  .object({
    name: z.string().trim().min(1, "출장지 이름을 입력하세요.").max(200),
    region: z.string().trim().max(20).default(""),
    sigungu: z.string().trim().max(20).default(""),
    note,
  })
  .transform((v, ctx) => {
    const region = v.region || null;
    const sigungu = v.sigungu || null;
    if (region === null && sigungu !== null) {
      ctx.addIssue({
        code: "custom",
        path: ["region"],
        message: "시·도를 먼저 고르세요.",
      });
    } else if (region !== null && !(region in SIGUNGU)) {
      ctx.addIssue({
        code: "custom",
        path: ["region"],
        message: "공식 시·도 목록에 없는 이름입니다.",
      });
    } else if (!isValidRegion(region, sigungu)) {
      ctx.addIssue({
        code: "custom",
        path: ["sigungu"],
        message: `${region}에 없는 시·군·구입니다.`,
      });
    }
    return { ...v, region, sigungu };
  });

const SITE_FIELDS: AuditField<Record<string, unknown>>[] = [
  { key: "name", label: "출장지(요청처)" },
  { key: "regionLabel", label: "지역" },
  { key: "note", label: "메모" },
];
const siteAudit = (s: {
  name: string;
  region: string | null;
  sigungu: string | null;
  note: string;
}) => ({
  ...s,
  regionLabel: regionLabel(s.region, s.sigungu),
});

function siteErrors(error: z.ZodError): ActionResult {
  const errors: Record<string, string> = {};
  for (const i of error.issues) errors[String(i.path[0])] ??= i.message;
  return {
    ok: false,
    message: Object.values(errors)[0] ?? "입력값을 확인하세요.",
    errors,
  };
}

async function nameTaken(
  tx: Prisma.TransactionClient,
  name: string,
  exceptId?: string,
) {
  const same = await tx.svcSite.findUnique({ where: { name } });
  if (!same || same.id === exceptId) return null;
  return same.deletedAt
    ? "숨긴 출장지 중에 같은 이름이 있습니다. [숨긴 출장지 보기]에서 복구하세요."
    : "이미 있는 출장지 이름입니다.";
}

export async function addSite(raw: unknown): Promise<ActionResult> {
  const user = await userWith("canEdit");
  if (!user) return { ok: false, message: NO_EDIT_MESSAGE };
  const parsed = siteSchema.safeParse(raw);
  if (!parsed.success) return siteErrors(parsed.error);
  const v = parsed.data;
  const now = await getNow();
  return run(() =>
    prisma.$transaction(async (tx) => {
      const taken = await nameTaken(tx, v.name);
      if (taken) return { ok: false, message: taken, errors: { name: taken } };
      const s = await tx.svcSite.create({
        data: { ...v, createdById: user.id, updatedById: user.id },
      });
      await recordAudit(tx, {
        occurredAt: now,
        actor: actor(user),
        area: "service",
        screen: "service-sites",
        action: "CREATE",
        target: { type: "SvcSite", id: s.id, label: v.name },
        changes: diffFields(null, siteAudit(v), SITE_FIELDS),
      });
      return { ok: true, message: `${v.name}을(를) 출장지로 등록했습니다.` };
    }),
  );
}

export async function updateSite(
  id: string,
  updatedAt: string,
  raw: unknown,
): Promise<ActionResult> {
  const user = await userWith("canEdit");
  if (!user) return { ok: false, message: NO_EDIT_MESSAGE };
  const parsed = siteSchema.safeParse(raw);
  if (!parsed.success) return siteErrors(parsed.error);
  const v = parsed.data;
  const now = await getNow();
  return run(() =>
    prisma.$transaction(async (tx) => {
      const before = await tx.svcSite.findUnique({ where: { id: String(id) } });
      if (!before || before.deletedAt) throw new ConflictError();
      const taken = await nameTaken(tx, v.name, before.id);
      if (taken) return { ok: false, message: taken, errors: { name: taken } };
      const updated = await tx.svcSite.updateMany({
        where: { id: before.id, updatedAt: new Date(updatedAt) },
        data: { ...v, updatedById: user.id },
      });
      if (updated.count === 0) throw new ConflictError();
      const changes = diffFields(siteAudit(before), siteAudit(v), SITE_FIELDS);
      if (changes.length) {
        await recordAudit(tx, {
          occurredAt: now,
          actor: actor(user),
          area: "service",
          screen: "service-sites",
          action: "UPDATE",
          target: { type: "SvcSite", id: before.id, label: v.name },
          changes,
        });
      }
      return { ok: true, message: "출장지를 수정했습니다." };
    }),
  );
}

/** 숨기면 그 출장지의 부품 가격도 함께 숨김 (친구: 삭제하면 가격도 함께 삭제, 출장보고서는 그대로) */
export async function setSiteHidden(
  id: string,
  hide: boolean,
): Promise<ActionResult> {
  const user = await userWith("canHide");
  if (!user) return { ok: false, message: NO_EDIT_MESSAGE };
  const now = await getNow();
  return run(() =>
    prisma.$transaction(async (tx) => {
      const s = await tx.svcSite.findUnique({ where: { id: String(id) } });
      if (!s || (s.deletedAt !== null) === hide) throw new ConflictError();
      await tx.svcSite.update({
        where: { id: s.id },
        data: hide
          ? { deletedAt: now, deletedById: user.id }
          : { deletedAt: null, deletedById: null },
      });
      const prices = hide
        ? await tx.svcSitePartPrice.updateMany({
            where: { siteId: s.id, deletedAt: null },
            data: { deletedAt: now, deletedById: user.id },
          })
        : { count: 0 };
      await recordAudit(tx, {
        occurredAt: now,
        actor: actor(user),
        area: "service",
        screen: "service-sites",
        action: hide ? "HIDE" : "RESTORE",
        target: { type: "SvcSite", id: s.id, label: s.name },
        ...(hide && prices.count
          ? { meta: { hiddenPrices: prices.count } }
          : {}),
      });
      return {
        ok: true,
        message: hide
          ? `${s.name}을(를) 숨겼습니다.${prices.count ? ` 부품 가격 ${prices.count}개도 함께 숨겼습니다.` : ""}`
          : `${s.name}을(를) 복구했습니다. 숨긴 부품 가격은 [부품 가격 관리]에서 다시 입력하세요.`,
      };
    }),
  );
}

/** 출장보고서 요청처 중 아직 출장지에 없는 이름을 출장지로 (지역은 그 요청처 보고서에서 가장 많이 쓴 값 — 같으면 최신 보고서 먼저) */
export async function importSitesFromReports(): Promise<
  ActionResult & { created?: string[] }
> {
  const user = await userWith("canEdit");
  if (!user) return { ok: false, message: NO_EDIT_MESSAGE };
  const now = await getNow();
  const reports = await prisma.svcReport.findMany({
    where: { deletedAt: null, NOT: { requestOrg: "" } },
    orderBy: [
      { tripStart: { sort: "desc", nulls: "first" } },
      { createdAt: "desc" },
    ],
    select: { requestOrg: true, region: true, sigungu: true },
  });
  const places = new Map<
    string,
    Map<string, { region: string | null; sigungu: string | null; n: number }>
  >();
  for (const r of reports) {
    const name = r.requestOrg.trim();
    if (!name) continue;
    const counts = places.get(name) ?? new Map();
    const k = `${r.region}|${r.sigungu}`;
    const c = counts.get(k) ?? { region: r.region, sigungu: r.sigungu, n: 0 };
    c.n++;
    counts.set(k, c);
    places.set(name, counts);
  }
  const existing = new Set(
    (await prisma.svcSite.findMany({ select: { name: true } })).map(
      (s) => s.name,
    ),
  );
  const created: string[] = [];
  await prisma.$transaction(async (tx) => {
    for (const name of [...places.keys()].sort((a, b) =>
      a < b ? -1 : a > b ? 1 : 0,
    )) {
      if (existing.has(name)) continue;
      // Counter.most_common: 많은 순, 같으면 먼저 나온 것
      const best = [...places.get(name)!.values()].reduce((a, b) =>
        b.n > a.n ? b : a,
      );
      const s = await tx.svcSite.create({
        data: {
          name,
          region: best.region,
          sigungu: best.sigungu,
          createdById: user.id,
          updatedById: user.id,
        },
      });
      await recordAudit(tx, {
        occurredAt: now,
        actor: actor(user),
        area: "service",
        screen: "service-sites",
        action: "CREATE",
        target: { type: "SvcSite", id: s.id, label: name },
        changes: diffFields(
          null,
          siteAudit({
            name,
            region: best.region,
            sigungu: best.sigungu,
            note: "",
          }),
          SITE_FIELDS,
        ),
        meta: { from: "출장보고서 요청처에서 가져오기" },
      });
      created.push(name);
    }
  });
  if (created.length) refresh();
  return {
    ok: true,
    created,
    message: created.length
      ? `요청처 ${created.length}곳을 출장지로 등록했습니다: ${created.join(", ")}`
      : "새로 등록할 요청처가 없습니다.",
  };
}

// ---------- 출장지별 가격 ----------

const priceSchema = z.object({
  siteId: z.string().min(1),
  partId: z.string().min(1),
  unitPrice: z
    .string()
    .trim()
    .regex(
      /^\d+$/,
      "단가는 0 이상의 정수(원)로 입력하세요. 가격을 지우려면 [삭제]를 누르세요.",
    ),
  note,
});
const PRICE_FIELDS: AuditField<Record<string, unknown>>[] = [
  { key: "unitPrice", label: "단가", format: won },
  { key: "note", label: "메모" },
];

/** 가격 저장 — 없으면 새로, 숨긴(삭제한) 행이 있으면 되살려 같은 행에 (출장지·부품 조합 하나에 가격 하나) */
export async function savePrice(raw: unknown): Promise<ActionResult> {
  const user = await userWith("canEdit");
  if (!user) return { ok: false, message: NO_EDIT_MESSAGE };
  const parsed = priceSchema.safeParse(raw);
  if (!parsed.success)
    return { ok: false, message: parsed.error.issues[0].message };
  const v = parsed.data;
  const now = await getNow();
  return run(() =>
    prisma.$transaction(async (tx) => {
      // 트랜잭션 안에서는 한 연결이라 차례로 읽는다 (동시에 읽으면 pg 경고)
      const site = await tx.svcSite.findUnique({ where: { id: v.siteId } });
      const part = await tx.svcPart.findUnique({ where: { id: v.partId } });
      if (!site || site.deletedAt || !part || part.deletedAt)
        throw new ConflictError();
      const before = await tx.svcSitePartPrice.findUnique({
        where: { siteId_partId: { siteId: v.siteId, partId: v.partId } },
      });
      const live = before && !before.deletedAt ? before : null;
      const data = {
        unitPrice: BigInt(v.unitPrice),
        note: v.note,
        updatedById: user.id,
      };
      const row = await tx.svcSitePartPrice.upsert({
        where: { siteId_partId: { siteId: v.siteId, partId: v.partId } },
        create: { siteId: v.siteId, partId: v.partId, ...data },
        update: { ...data, deletedAt: null, deletedById: null },
      });
      const changes = diffFields(live, data, PRICE_FIELDS);
      if (changes.length) {
        await recordAudit(tx, {
          occurredAt: now,
          actor: actor(user),
          area: "service",
          screen: "service-prices",
          action: live ? "UPDATE" : "CREATE",
          target: {
            type: "SvcSitePartPrice",
            id: row.id,
            label: `${site.name} · ${part.name}`,
          },
          changes,
        });
      }
      return {
        ok: true,
        message: `${site.name} · ${part.name} 가격을 저장했습니다.`,
      };
    }),
  );
}

/** 가격 삭제 = 숨김 (그 조합은 다시 "미입력") */
export async function removePrice(
  siteId: string,
  partId: string,
): Promise<ActionResult> {
  const user = await userWith("canHide");
  if (!user) return { ok: false, message: NO_EDIT_MESSAGE };
  const now = await getNow();
  return run(() =>
    prisma.$transaction(async (tx) => {
      const row = await tx.svcSitePartPrice.findUnique({
        where: {
          siteId_partId: { siteId: String(siteId), partId: String(partId) },
        },
      });
      if (!row || row.deletedAt) throw new ConflictError();
      const site = await tx.svcSite.findUniqueOrThrow({
        where: { id: row.siteId },
      });
      const part = await tx.svcPart.findUniqueOrThrow({
        where: { id: row.partId },
      });
      await tx.svcSitePartPrice.update({
        where: { id: row.id },
        data: { deletedAt: now, deletedById: user.id },
      });
      await recordAudit(tx, {
        occurredAt: now,
        actor: actor(user),
        area: "service",
        screen: "service-prices",
        action: "HIDE",
        target: {
          type: "SvcSitePartPrice",
          id: row.id,
          label: `${site.name} · ${part.name}`,
        },
        changes: diffFields(
          { unitPrice: row.unitPrice, note: row.note },
          null,
          PRICE_FIELDS,
        ),
      });
      return { ok: true, message: "삭제했습니다." };
    }),
  );
}
