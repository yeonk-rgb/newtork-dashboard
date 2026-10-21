"use client";
// 헤더 오른쪽 프로필: 이름·역할 + 펼침 메뉴(비밀번호 변경·로그아웃)
import { Menu } from "@base-ui/react/menu";
import Link from "next/link";
import { useRef } from "react";
import { ChevronDown, KeyRound, LogOut } from "lucide-react";

import { logout } from "@/shared/auth/actions";

const itemClass =
  "flex w-full cursor-default items-center gap-2 rounded-lg px-2.5 py-2 text-sm text-body outline-none select-none data-highlighted:bg-muted data-highlighted:text-foreground";

export function ProfileMenu({ name, role }: { name: string; role: string }) {
  // 로그아웃은 기존과 같은 form + Server Action (메뉴가 닫혀도 남도록 메뉴 밖에 둔다)
  const logoutForm = useRef<HTMLFormElement>(null);

  return (
    <>
      <form ref={logoutForm} action={logout} hidden />
      <Menu.Root>
        <Menu.Trigger className="flex items-center gap-2.5 rounded-full border border-border py-1 pr-3 pl-1 text-left outline-none hover:bg-muted focus-visible:ring-2 focus-visible:ring-ring/50 data-popup-open:bg-muted">
          <span
            aria-hidden
            className="flex size-8 items-center justify-center rounded-full bg-brand-soft text-sm font-semibold text-brand-soft-foreground"
          >
            {name.slice(0, 1)}
          </span>
          <span className="leading-tight">
            <span className="block text-sm font-semibold text-foreground">
              {name}
            </span>
            <span className="block text-xs text-muted-foreground">{role}</span>
          </span>
          <ChevronDown className="size-4 text-muted-foreground" aria-hidden />
        </Menu.Trigger>
        <Menu.Portal>
          <Menu.Positioner align="end" sideOffset={8} className="z-50">
            <Menu.Popup className="min-w-44 rounded-xl border border-border bg-popover p-1.5 text-popover-foreground outline-none">
              <Menu.LinkItem
                render={<Link href="/account/password" />}
                className={itemClass}
              >
                <KeyRound className="size-4" aria-hidden />
                비밀번호 변경
              </Menu.LinkItem>
              <Menu.Item
                className={itemClass}
                onClick={() => logoutForm.current?.requestSubmit()}
              >
                <LogOut className="size-4" aria-hidden />
                로그아웃
              </Menu.Item>
            </Menu.Popup>
          </Menu.Positioner>
        </Menu.Portal>
      </Menu.Root>
    </>
  );
}
