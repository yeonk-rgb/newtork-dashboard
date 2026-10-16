"use client";
// 개발용 사용자 전환 드롭다운 — 실제 로그인으로 교체할 때 삭제한다.
import { useRouter } from "next/navigation";
import { useTransition } from "react";

import { switchDevUser } from "@/shared/auth/dev-switch";

type Props = {
  currentId: string;
  users: { id: string; name: string }[];
};

export function DevUserSwitcher({ currentId, users }: Props) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();

  return (
    <label className="flex items-center gap-1.5 rounded bg-white/15 px-2 py-0.5 text-xs">
      <span className="font-semibold text-amber-200">DEV</span>
      <span className="sr-only">사용자 전환</span>
      <select
        value={currentId}
        disabled={isPending}
        onChange={(event) => {
          const userId = event.target.value;
          startTransition(async () => {
            await switchDevUser(userId);
            router.refresh();
          });
        }}
        className="rounded bg-transparent py-0.5 text-header-foreground outline-none [&>option]:text-foreground"
      >
        {users.map((user) => (
          <option key={user.id} value={user.id}>
            {user.name}
          </option>
        ))}
      </select>
    </label>
  );
}
