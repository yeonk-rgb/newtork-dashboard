"use client";
// 저장하지 않은 변경이 있을 때 나가기 경고: 새로고침·창 닫기 + 앱 안의 링크 이동
// (브라우저 뒤로 가기는 막을 수 없어 월간 입력은 브라우저 임시 보관으로 보완)
import { useEffect } from "react";

export const LEAVE_MESSAGE =
  "저장하지 않은 입력이 있습니다. 이 화면을 떠날까요?";

export function useUnsavedGuard(dirty: boolean) {
  useEffect(() => {
    if (!dirty) return;
    const onBeforeUnload = (e: BeforeUnloadEvent) => {
      e.preventDefault();
    };
    const onClick = (e: MouseEvent) => {
      const anchor = (e.target as HTMLElement).closest(
        "a[href]",
      ) as HTMLAnchorElement | null;
      if (
        !anchor ||
        anchor.target === "_blank" ||
        anchor.origin !== window.location.origin
      ) {
        return;
      }
      if (!window.confirm(LEAVE_MESSAGE)) {
        e.preventDefault();
        e.stopPropagation();
      }
    };
    window.addEventListener("beforeunload", onBeforeUnload);
    document.addEventListener("click", onClick, true);
    return () => {
      window.removeEventListener("beforeunload", onBeforeUnload);
      document.removeEventListener("click", onClick, true);
    };
  }, [dirty]);
}
