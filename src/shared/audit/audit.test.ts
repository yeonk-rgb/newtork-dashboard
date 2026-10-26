import { describe, expect, it, vi } from "vitest";

import { date, diffFields, flag, labelOf, text, won } from "./diff";
import { findForbiddenKeys, isForbiddenKey } from "./forbidden";
import { AuditForbiddenFieldError, recordAudit, type AuditTx } from "./record";
import type { AuditEntry } from "./types";

describe("표시 형식", () => {
  it("금액 '12,500,000원', 날짜 'YYYY-MM-DD', 빈 값은 null", () => {
    expect(won(12_500_000n)).toBe("12,500,000원");
    expect(won("1000")).toBe("1,000원");
    expect(won(0n)).toBe("0원");
    expect(won(null)).toBeNull();
    expect(date(new Date("2026-10-15T00:00:00Z"))).toBe("2026-10-15");
    expect(date("2026-10-15")).toBe("2026-10-15");
    expect(text("  메모 ")).toBe("메모");
    expect(text("   ")).toBeNull();
    expect(labelOf({ LONG_OVERDUE: "장기 미수금" })("LONG_OVERDUE")).toBe(
      "장기 미수금",
    );
    expect(flag("자동이체")(true)).toBe("자동이체");
    expect(flag("자동이체")(false)).toBeNull();
    expect(flag("수금 완료", "미수")(false)).toBe("미수");
  });
});

describe("diffFields", () => {
  type Row = {
    name: string;
    amount: bigint;
    memo: string | null;
    secret?: string;
  };
  const fields = [
    { key: "name", label: "거래처명" },
    { key: "amount", label: "잔액", format: won },
    { key: "memo", label: "적요" },
  ] as const;

  it("바뀐 칸만, 화면 표기로", () => {
    expect(
      diffFields<Row>(
        { name: "가", amount: 1000n, memo: null },
        { name: "가", amount: 2000n, memo: "메모" },
        [...fields],
      ),
    ).toEqual([
      { field: "amount", label: "잔액", before: "1,000원", after: "2,000원" },
      { field: "memo", label: "적요", before: null, after: "메모" },
    ]);
  });

  it("추가는 before 없이 값 있는 칸만, 같으면 빈 배열", () => {
    expect(
      diffFields<Row>(null, { name: "가", amount: 0n, memo: "" }, [...fields]),
    ).toEqual([
      { field: "name", label: "거래처명", before: null, after: "가" },
      { field: "amount", label: "잔액", before: null, after: "0원" },
    ]);
    const same = { name: "가", amount: 1n, memo: null };
    expect(diffFields<Row>(same, { ...same, memo: "" }, [...fields])).toEqual(
      [],
    );
  });

  it("목록(허용 목록)에 없는 칸은 바뀌어도 기록하지 않는다", () => {
    expect(
      diffFields<Row>(
        { name: "가", amount: 1n, memo: null, secret: "a" },
        { name: "가", amount: 1n, memo: null, secret: "b" },
        [...fields],
      ),
    ).toEqual([]);
  });
});

describe("금지 칸", () => {
  it("비밀번호·해시·토큰·세션 이름을 찾는다 (중첩 포함)", () => {
    for (const k of [
      "password",
      "passwordHash",
      "newPassword",
      "tempPassword",
      "token",
      "sessionId",
      "secret",
      "salt",
    ]) {
      expect(isForbiddenKey(k), k).toBe(true);
    }
    for (const k of [
      "partnerName",
      "amount",
      "role",
      "viewTeams",
      "loginId",
      "fileName",
    ]) {
      expect(isForbiddenKey(k), k).toBe(false);
    }
    expect(
      findForbiddenKeys({
        a: 1,
        nested: { authToken: "x", list: [{ hash: 1 }] },
      }),
    ).toEqual(["nested.authToken", "nested.list[0].hash"]);
  });
});

describe("금지 검사는 칸 이름(키)만 — 사용자가 쓴 글자(값)는 막지 않는다", () => {
  it("값에 pass·session·token 같은 단어가 있어도 기록된다", async () => {
    const create = vi.fn(async () => ({}));
    const tx = { auditLog: { create } } as unknown as AuditTx;
    const ok = await recordAudit(tx, {
      occurredAt: new Date("2026-10-25T03:00:00Z"),
      actor: { id: "u1", loginId: "mgmt_member" },
      area: "management",
      screen: "ledger",
      action: "CREATE",
      target: {
        type: "LedgerEntry",
        id: "r1",
        label: "2026-10 외상매입금 · 패스테크(Pass Tech)",
      },
      changes: [
        {
          field: "partnerName",
          label: "거래처명",
          before: null,
          after: "패스테크(Pass Tech)",
        },
        {
          field: "note",
          label: "적요",
          before: null,
          after: "Bypass 밸브 교체 · session 점검 · token 회수",
        },
      ],
      meta: { fileName: "password_list_backup.xlsx", memo: "secret 아님" },
    });
    expect(ok).toBe(true);
    expect(create).toHaveBeenCalledTimes(1);
    expect(findForbiddenKeys({ note: "Bypass", name: "Session Corp" })).toEqual(
      [],
    );
  });
});

describe("recordAudit", () => {
  const entry: AuditEntry = {
    occurredAt: new Date("2026-10-25T03:00:00Z"),
    actor: { id: "u1", loginId: "mgmt_member" },
    area: "management",
    screen: "ledger",
    action: "UPDATE",
    target: { type: "LedgerEntry", id: "r1", label: "2026-10 외상매출금 · 가" },
    changes: [{ field: "amount", label: "잔액", before: "1원", after: "2원" }],
  };
  const fakeTx = () => {
    const create = vi.fn(async () => ({}));
    return { tx: { auditLog: { create } } as unknown as AuditTx, create };
  };

  it("기록 한 건 (아이디도 함께 저장)", async () => {
    const { tx, create } = fakeTx();
    expect(await recordAudit(tx, entry)).toBe(true);
    expect(create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        actorId: "u1",
        actorLoginId: "mgmt_member",
        action: "UPDATE",
        targetLabel: "2026-10 외상매출금 · 가",
        changes: entry.changes,
      }),
    });
  });

  it("수정인데 바뀐 칸이 없으면 기록하지 않음 (숨김·복구는 칸 없이 기록)", async () => {
    const { tx, create } = fakeTx();
    expect(await recordAudit(tx, { ...entry, changes: [] })).toBe(false);
    expect(
      await recordAudit(tx, { ...entry, action: "HIDE", changes: [] }),
    ).toBe(true);
    expect(create).toHaveBeenCalledTimes(1);
  });

  it("비밀번호 같은 칸이 changes·meta 에 있으면 저장하지 않고 에러", async () => {
    const { tx, create } = fakeTx();
    await expect(
      recordAudit(tx, {
        ...entry,
        changes: [
          {
            field: "passwordHash",
            label: "비밀번호",
            before: null,
            after: "x",
          },
        ],
      }),
    ).rejects.toBeInstanceOf(AuditForbiddenFieldError);
    await expect(
      recordAudit(tx, {
        ...entry,
        action: "PASSWORD_RESET",
        changes: [],
        meta: { tempPassword: "x" },
      }),
    ).rejects.toThrow("meta.tempPassword");
    expect(create).not.toHaveBeenCalled();
  });

  it("알 수 없는 동작·빈 대상은 거부", async () => {
    const { tx } = fakeTx();
    await expect(
      recordAudit(tx, { ...entry, action: "DROP" as never }),
    ).rejects.toThrow();
    await expect(
      recordAudit(tx, { ...entry, target: { ...entry.target, label: "" } }),
    ).rejects.toThrow();
  });
});
