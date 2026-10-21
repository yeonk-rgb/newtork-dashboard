"use client";
// [계정 추가] — 아이디·이름·역할·열람/수정 범위. 성공하면 임시 비밀번호를 한 번만 보여준다
import { useEffect, useRef, useState } from "react";

import {
  ROLE_LABEL,
  ROLES,
  SCOPE_TEAMS,
  TEAM_LABEL,
  type Role,
  type ScopeTeam,
} from "@/shared/auth/types";

import type { AdminActionResult } from "./actions";
import { hasAllTeams, normalizeScope, scopeError } from "./rules";
import { LOGIN_ID_RULE, type CreateUserInput } from "./schemas";

const fieldClass =
  "h-9 w-full rounded-md border border-input bg-background px-2 text-sm outline-none focus-visible:ring-2 focus-visible:ring-ring/50";

const EMPTY = {
  loginId: "",
  name: "",
  role: "MEMBER" as Role,
  viewTeams: [] as ScopeTeam[],
  editTeams: [] as ScopeTeam[],
};

export function CreateUserDialog({
  open,
  onClose,
  onSubmit,
}: {
  open: boolean;
  onClose: () => void;
  onSubmit: (
    input: CreateUserInput,
    done: (result: AdminActionResult) => void,
  ) => void;
}) {
  const ref = useRef<HTMLDialogElement>(null);
  const [form, setForm] = useState(EMPTY);
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  useEffect(() => {
    const dialog = ref.current;
    if (!dialog) return;
    if (open && !dialog.open) {
      setForm(EMPTY);
      setError(null);
      dialog.showModal();
    }
    if (!open && dialog.open) dialog.close();
  }, [open]);

  const scope = normalizeScope(form);
  const toggle = (field: "viewTeams" | "editTeams", team: ScopeTeam) =>
    setForm((prev) => {
      const has = prev[field].includes(team);
      const list = has
        ? prev[field].filter((t) => t !== team)
        : [...prev[field], team];
      if (field === "viewTeams" && has) {
        return {
          ...prev,
          viewTeams: list,
          editTeams: prev.editTeams.filter((t) => t !== team),
        };
      }
      return { ...prev, [field]: list };
    });

  const submit = (event: React.FormEvent) => {
    event.preventDefault();
    const problem = scopeError(scope);
    if (problem) {
      setError(problem);
      return;
    }
    setPending(true);
    setError(null);
    onSubmit({ ...form, ...scope }, (result) => {
      setPending(false);
      if (!result.ok) setError(result.message);
    });
  };

  return (
    <dialog
      ref={ref}
      onClose={onClose}
      aria-labelledby="create-user-title"
      className="m-auto w-[min(30rem,calc(100vw-2rem))] rounded-lg border bg-card p-5 text-card-foreground shadow-lg backdrop:bg-black/30"
    >
      {open && (
        <form onSubmit={submit} className="space-y-3">
          <h2 id="create-user-title" className="text-base font-semibold">
            계정 추가
          </h2>
          <label className="block text-sm">
            <span className="mb-1 block font-medium">아이디</span>
            <input
              className={fieldClass}
              value={form.loginId}
              onChange={(e) => setForm({ ...form, loginId: e.target.value })}
              autoComplete="off"
              required
              aria-describedby="login-id-rule"
            />
            <span
              id="login-id-rule"
              className="mt-0.5 block text-xs text-muted-foreground"
            >
              {LOGIN_ID_RULE}
            </span>
          </label>
          <label className="block text-sm">
            <span className="mb-1 block font-medium">이름</span>
            <input
              className={fieldClass}
              value={form.name}
              onChange={(e) => setForm({ ...form, name: e.target.value })}
              autoComplete="off"
              required
            />
          </label>
          <label className="block text-sm">
            <span className="mb-1 block font-medium">역할</span>
            <select
              className={fieldClass}
              value={form.role}
              onChange={(e) =>
                setForm({ ...form, role: e.target.value as Role })
              }
            >
              {ROLES.map((role) => (
                <option key={role} value={role}>
                  {ROLE_LABEL[role]}
                </option>
              ))}
            </select>
          </label>
          {hasAllTeams(form.role) ? (
            <p className="text-sm text-muted-foreground">
              {ROLE_LABEL[form.role]}은(는) 모든 팀을 열람·수정할 수 있습니다.
            </p>
          ) : (
            <div className="grid grid-cols-2 gap-3 text-sm">
              {(["viewTeams", "editTeams"] as const).map((field) => (
                <fieldset key={field}>
                  <legend className="mb-1 font-medium">
                    {field === "viewTeams" ? "열람 범위" : "수정 권한"}
                  </legend>
                  {SCOPE_TEAMS.map((team) => {
                    const enabled =
                      field === "viewTeams" ||
                      (form.role === "LEADER" &&
                        scope.viewTeams.includes(team));
                    return (
                      <label
                        key={team}
                        className={
                          enabled
                            ? "flex items-center gap-2"
                            : "flex items-center gap-2 text-muted-foreground"
                        }
                      >
                        <input
                          type="checkbox"
                          className="size-4 accent-primary"
                          checked={scope[field].includes(team)}
                          disabled={!enabled}
                          onChange={() => toggle(field, team)}
                        />
                        {TEAM_LABEL[team]}팀
                      </label>
                    );
                  })}
                </fieldset>
              ))}
            </div>
          )}
          {error && (
            <p role="alert" className="text-sm text-destructive">
              {error}
            </p>
          )}
          <div className="flex justify-end gap-2 pt-2">
            <button
              type="button"
              onClick={onClose}
              className="rounded-md border px-3 py-1.5 text-sm hover:bg-muted"
            >
              취소
            </button>
            <button
              type="submit"
              disabled={pending}
              className="rounded-md bg-primary px-3 py-1.5 text-sm text-primary-foreground hover:bg-primary/90 disabled:opacity-50"
            >
              {pending ? "추가 중…" : "추가"}
            </button>
          </div>
        </form>
      )}
    </dialog>
  );
}
