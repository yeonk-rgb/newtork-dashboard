"use client";
// 일련번호 상세의 [수정] — 제조내역 표와 같은 수정 창 (저장하면 서버가 화면을 다시 그림)
import { useState } from "react";

import { buttonPrimaryClass } from "@/shared/ui/styles";

import { RecordEditDialog, type RecordRow } from "../records/record-table";

export function EditButton({
  row,
  canEdit,
}: {
  row: RecordRow;
  canEdit: boolean;
}) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <button
        type="button"
        disabled={!canEdit}
        title={canEdit ? undefined : "열람 전용 — 수정은 팀장만"}
        onClick={() => setOpen(true)}
        className={buttonPrimaryClass}
      >
        수정
      </button>
      {open && <RecordEditDialog row={row} onClose={() => setOpen(false)} />}
    </>
  );
}
