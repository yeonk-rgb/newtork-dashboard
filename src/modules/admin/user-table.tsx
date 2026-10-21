"use client";
// 관리자 설정 — 직원 목록 표 (역할·체크박스는 모아서 [변경]으로 저장)
import { useEffect, useMemo, useState, useTransition } from "react";

import {
  ROLE_LABEL,
  ROLES,
  SCOPE_TEAMS,
  TEAM_LABEL,
  type Role,
  type ScopeTeam,
} from "@/shared/auth/types";
import { cn } from "@/shared/lib/utils";

import {
  createUser,
  deactivateUser,
  resetUserPassword,
  restoreUser,
  saveUserChanges,
  type AdminActionResult,
} from "./actions";
import { ConfirmDialog, type ConfirmRequest } from "./confirm-dialog";
import { CreateUserDialog } from "./create-user-dialog";
import {
  hasAllTeams,
  normalizeScope,
  rowAbilities,
  sameScope,
  scopeError,
  type Scope,
} from "./rules";
import { TempPasswordDialog } from "./temp-password-dialog";

export type AdminUserRow = {
  id: string;
  loginId: string;
  name: string;
  role: Role;
  viewTeams: ScopeTeam[];
  editTeams: ScopeTeam[];
  mustChangePassword: boolean;
  /** "2026. 10. 19. 오후 3:05:48" (서버에서 한국 시간으로 만든 문자열) */
  lastLogin: string | null;
  active: boolean;
  deactivatedAt: string | null;
  updatedAt: string;
};

const TEAM_CHECK_LABEL: Record<ScopeTeam, string> = {
  production: `${TEAM_LABEL.production}팀`,
  service: `${TEAM_LABEL.service}팀`,
};

export function UserTable({
  actorId,
  users,
}: {
  actorId: string;
  users: AdminUserRow[];
}) {
  // 화면에서 바꾼 값 (원래 값과 같아지면 변경 건수에서 빠진다)
  const [drafts, setDrafts] = useState<Record<string, Scope>>({});
  const [result, setResult] = useState<AdminActionResult | null>(null);
  const [confirm, setConfirm] = useState<ConfirmRequest | null>(null);
  const [tempPassword, setTempPassword] = useState<{
    title: string;
    password: string;
  } | null>(null);
  const [creating, setCreating] = useState(false);
  const [isPending, startTransition] = useTransition();

  const changed = useMemo(
    () =>
      users.filter((u) => {
        const draft = drafts[u.id];
        return draft !== undefined && !sameScope(draft, u);
      }),
    [users, drafts],
  );
  const errors = useMemo(() => {
    const map = new Map<string, string>();
    for (const u of changed) {
      const error = scopeError(normalizeScope(drafts[u.id]));
      if (error) map.set(u.id, error);
    }
    return map;
  }, [changed, drafts]);
  const dirty = changed.length > 0;

  useEffect(() => {
    if (!dirty) return;
    const onBeforeUnload = (event: BeforeUnloadEvent) => {
      event.preventDefault();
    };
    window.addEventListener("beforeunload", onBeforeUnload);
    return () => window.removeEventListener("beforeunload", onBeforeUnload);
  }, [dirty]);

  const scopeOf = (u: AdminUserRow): Scope => drafts[u.id] ?? u;
  const update = (u: AdminUserRow, next: Partial<Scope>) =>
    setDrafts((prev) => ({ ...prev, [u.id]: { ...scopeOf(u), ...next } }));

  const toggle = (
    u: AdminUserRow,
    field: "viewTeams" | "editTeams",
    team: ScopeTeam,
    checked: boolean,
  ) => {
    const current = scopeOf(u);
    const list = checked
      ? [...current[field], team]
      : current[field].filter((t) => t !== team);
    // 열람을 끄면 그 팀 수정 권한도 함께 끈다
    const editTeams =
      field === "viewTeams" && !checked
        ? current.editTeams.filter((t) => t !== team)
        : current.editTeams;
    update(
      u,
      field === "viewTeams"
        ? { viewTeams: list, editTeams }
        : { editTeams: list },
    );
  };

  const act = (
    action: () => Promise<AdminActionResult>,
    onOk?: (res: Extract<AdminActionResult, { ok: true }>) => void,
  ) => {
    startTransition(async () => {
      const res = await action();
      setResult(res);
      if (res.ok) onOk?.(res);
    });
  };

  const save = () =>
    act(
      () =>
        saveUserChanges({
          changes: changed.map((u) => ({
            id: u.id,
            ...normalizeScope(drafts[u.id]),
            expectedUpdatedAt: u.updatedAt,
          })),
        }),
      () => setDrafts({}),
    );

  const askReset = (u: AdminUserRow) =>
    setConfirm({
      title: "비밀번호 초기화",
      body: (
        <p>
          {u.name}({u.loginId})의 비밀번호를 초기화할까요? 임시 비밀번호가 새로
          만들어지고, 지금 로그인 중이면 로그아웃됩니다. 다음 로그인 때
          비밀번호를 바꾸게 됩니다.
        </p>
      ),
      confirmLabel: "초기화",
      tone: "danger",
      onConfirm: () =>
        act(
          () => resetUserPassword({ id: u.id }),
          (res) =>
            res.tempPassword &&
            setTempPassword({
              title: `${u.name}(${u.loginId}) 임시 비밀번호`,
              password: res.tempPassword,
            }),
        ),
    });

  const askDeactivate = (u: AdminUserRow) =>
    setConfirm({
      title: "계정 비활성화",
      body: (
        <p>
          {u.name}({u.loginId}) 계정을 비활성화할까요? 로그인할 수 없게 되고
          지금 로그인 중이면 바로 로그아웃됩니다. 입력 기록은 남으며 [복구]로
          되돌릴 수 있습니다.
        </p>
      ),
      confirmLabel: "비활성화",
      tone: "danger",
      onConfirm: () => act(() => deactivateUser({ id: u.id })),
    });

  const blockedHint = dirty
    ? "바뀐 내용을 먼저 [변경]하거나 [되돌리기]하세요."
    : undefined;

  return (
    <section className="overflow-hidden rounded-md border bg-card">
      <div className="flex flex-wrap items-center gap-x-3 gap-y-1 border-b bg-muted/60 px-4 py-2.5">
        <h2 className="text-sm font-bold">직원 목록</h2>
        <p className="text-sm text-muted-foreground">
          역할·체크박스를 바꾼 뒤 맨 아래 [변경]을 눌러야 저장됩니다. 바뀐 줄은
          노란색으로 표시됩니다.
        </p>
        <button
          type="button"
          onClick={() => setCreating(true)}
          disabled={dirty || isPending}
          title={blockedHint}
          className="ml-auto rounded-md border bg-background px-2.5 py-1 text-xs hover:bg-muted disabled:opacity-50"
        >
          + 계정 추가
        </button>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full min-w-[60rem] text-sm">
          <thead>
            <tr className="border-b-2 border-foreground/70 text-left">
              {[
                "아이디",
                "이름",
                "역할",
                "열람 범위",
                "수정 권한",
                "비밀번호",
                "마지막 로그인",
              ].map((label) => (
                <th key={label} scope="col" className="px-2 py-2 font-bold">
                  {label}
                </th>
              ))}
              <th scope="col" className="px-2 py-2">
                <span className="sr-only">관리</span>
              </th>
            </tr>
          </thead>
          <tbody>
            {users.map((u) => {
              const ability = rowAbilities({ id: actorId }, u);
              const scope = scopeOf(u);
              const effective = normalizeScope(scope);
              const isChanged = changed.some((c) => c.id === u.id);
              const error = errors.get(u.id);
              return (
                <tr
                  key={u.id}
                  className={cn(
                    "border-b align-middle last:border-b-0",
                    isChanged && "bg-amber-100/70",
                    !u.active && "text-muted-foreground",
                  )}
                >
                  <td className="px-2 py-2.5">{u.loginId}</td>
                  <td className="px-2 py-2.5">
                    {u.name}
                    {!u.active && (
                      <span className="ml-1.5 rounded bg-muted px-1.5 py-0.5 text-xs">
                        비활성
                      </span>
                    )}
                  </td>
                  <td className="px-2 py-2.5">
                    <select
                      aria-label={`${u.name} 역할`}
                      value={scope.role}
                      disabled={!ability.editRole || isPending}
                      onChange={(e) =>
                        update(u, { role: e.target.value as Role })
                      }
                      className="h-9 w-36 rounded-md border border-input bg-background px-2 disabled:bg-muted disabled:text-muted-foreground"
                    >
                      {ROLES.map((role) => (
                        <option key={role} value={role}>
                          {ROLE_LABEL[role]}
                        </option>
                      ))}
                    </select>
                    {error && (
                      <p
                        role="alert"
                        className="mt-1 max-w-48 text-xs text-destructive"
                      >
                        {error}
                      </p>
                    )}
                  </td>
                  {(["viewTeams", "editTeams"] as const).map((field) => (
                    <td key={field} className="px-2 py-2.5">
                      {hasAllTeams(scope.role) ? (
                        <span className="text-muted-foreground">전체</span>
                      ) : (
                        <div className="flex flex-col gap-1">
                          {SCOPE_TEAMS.map((team) => {
                            const isEdit = field === "editTeams";
                            const enabled =
                              ability.editScope &&
                              !isPending &&
                              (!isEdit ||
                                (scope.role === "LEADER" &&
                                  effective.viewTeams.includes(team)));
                            return (
                              <label
                                key={team}
                                className={cn(
                                  "flex w-fit items-center gap-2",
                                  !enabled && "text-muted-foreground",
                                )}
                              >
                                <input
                                  type="checkbox"
                                  className="size-4 accent-primary"
                                  checked={effective[field].includes(team)}
                                  disabled={!enabled}
                                  onChange={(e) =>
                                    toggle(u, field, team, e.target.checked)
                                  }
                                />
                                {TEAM_CHECK_LABEL[team]}
                              </label>
                            );
                          })}
                        </div>
                      )}
                    </td>
                  ))}
                  <td className="px-2 py-2.5">
                    {u.mustChangePassword && (
                      <span className="inline-block rounded-md bg-amber-400 px-2 py-0.5 text-xs font-bold whitespace-nowrap text-amber-950">
                        초기 비밀번호 사용 중
                      </span>
                    )}
                  </td>
                  <td className="px-2 py-2.5 text-muted-foreground">
                    {u.lastLogin ?? "로그인 기록 없음"}
                  </td>
                  <td className="px-2 py-2.5 text-right">
                    {ability.isSelf ? (
                      <span className="text-muted-foreground">본인</span>
                    ) : u.active ? (
                      <div className="flex flex-col items-end gap-1">
                        <button
                          type="button"
                          onClick={() => askReset(u)}
                          disabled={dirty || isPending}
                          title={blockedHint}
                          className="rounded-md border border-destructive bg-background px-3 py-1.5 whitespace-nowrap text-destructive hover:bg-destructive/5 disabled:opacity-50"
                        >
                          비밀번호 초기화
                        </button>
                        <button
                          type="button"
                          onClick={() => askDeactivate(u)}
                          disabled={dirty || isPending}
                          title={blockedHint}
                          className="rounded-md px-2 py-0.5 text-xs text-muted-foreground underline-offset-2 hover:underline disabled:opacity-50"
                        >
                          비활성화
                        </button>
                      </div>
                    ) : (
                      <button
                        type="button"
                        onClick={() => act(() => restoreUser({ id: u.id }))}
                        disabled={dirty || isPending}
                        title={blockedHint}
                        className="rounded-md border bg-background px-3 py-1.5 text-foreground hover:bg-muted disabled:opacity-50"
                      >
                        복구
                      </button>
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {result && (
        <p
          role={result.ok ? "status" : "alert"}
          className={cn(
            "border-t px-4 py-2 text-sm",
            result.ok ? "text-primary" : "text-destructive",
          )}
        >
          {result.message}
        </p>
      )}

      <div className="flex items-center justify-between gap-2 border-t bg-muted/60 px-4 py-3">
        <p className="text-sm text-muted-foreground" aria-live="polite">
          {dirty ? `바뀐 내용 ${changed.length}건` : "바뀐 내용이 없습니다"}
        </p>
        <div className="flex gap-2">
          <button
            type="button"
            onClick={() => setDrafts({})}
            disabled={!dirty || isPending}
            className="rounded-md border bg-background px-4 py-2 text-sm hover:bg-muted disabled:opacity-50"
          >
            되돌리기
          </button>
          <button
            type="button"
            onClick={save}
            disabled={!dirty || errors.size > 0 || isPending}
            className="rounded-md bg-primary px-4 py-2 text-sm text-primary-foreground hover:bg-primary/90 disabled:opacity-50"
          >
            {isPending ? "저장 중…" : "변경"}
          </button>
        </div>
      </div>

      <ConfirmDialog request={confirm} onClose={() => setConfirm(null)} />
      <TempPasswordDialog
        value={tempPassword}
        onClose={() => setTempPassword(null)}
      />
      <CreateUserDialog
        open={creating}
        onClose={() => setCreating(false)}
        onSubmit={(input, done) =>
          startTransition(async () => {
            const res = await createUser(input);
            done(res);
            if (res.ok) {
              setResult(res);
              setCreating(false);
              if (res.tempPassword) {
                setTempPassword({
                  title: `${input.name}(${input.loginId}) 임시 비밀번호`,
                  password: res.tempPassword,
                });
              }
            }
          })
        }
      />
    </section>
  );
}
