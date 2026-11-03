"use client";
// 사진·자료 첨부 — 친구 저장소 ServiceReportDetailView 첨부 카드 그대로 (종류 선택 + 끌어 놓기, 종류별 묶음, 이미지 미리보기)
// 파일은 로그인한 사람만 받는 /api/service/attachments/{id} 로. 삭제 대신 숨김
import { useId, useRef, useState, useTransition } from "react";

import { cn } from "@/shared/lib/utils";
import { Modal } from "@/shared/ui/modal";
import { buttonSecondaryClass, labelClass } from "@/shared/ui/styles";

import { ATTACHMENT_KINDS, formatBytes } from "../labels";
import { hideAttachment, uploadAttachments } from "./actions";

export type AttachmentItem = {
  id: string;
  kind: string;
  name: string;
  size: number;
  isImage: boolean;
  uploadedBy: string;
  uploadedAt: string;
};

const fileUrl = (id: string, download = false) =>
  `/api/service/attachments/${id}${download ? "?download=1" : ""}`;

export function AttachmentPanel({
  reportId,
  canEdit,
  attachments,
}: {
  reportId: string;
  canEdit: boolean;
  attachments: AttachmentItem[];
}) {
  const titleId = useId();
  const input = useRef<HTMLInputElement>(null);
  const [kind, setKind] = useState("ORIGINAL");
  const [dragging, setDragging] = useState(false);
  const [message, setMessage] = useState<{ ok: boolean; text: string } | null>(
    null,
  );
  const [preview, setPreview] = useState<AttachmentItem | null>(null);
  const [pending, startTransition] = useTransition();

  const upload = (files: File[]) => {
    if (!files.length || !canEdit) return;
    const form = new FormData();
    form.set("reportId", reportId);
    form.set("kind", kind);
    for (const f of files) form.append("file", f);
    startTransition(async () => {
      const r = await uploadAttachments(form);
      setMessage({ ok: r.ok, text: r.message });
      if (input.current) input.current.value = "";
    });
  };
  const remove = (a: AttachmentItem) => {
    if (!window.confirm(`${a.name} 파일을 숨길까요? (첨부 목록에서 빠집니다)`))
      return;
    startTransition(async () => {
      const r = await hideAttachment(a.id);
      setMessage({ ok: r.ok, text: r.message });
    });
  };

  return (
    <section className="rounded-card border bg-card p-6">
      <h3 className="mb-2.5 border-b pb-1.5 text-sm font-bold text-primary">
        사진·자료 첨부
      </h3>
      <div className="mb-2 flex flex-wrap items-end gap-2">
        <label className="flex flex-col gap-1">
          <span className={labelClass}>종류</span>
          <select
            value={kind}
            onChange={(e) => setKind(e.target.value)}
            disabled={!canEdit}
            className="h-9 rounded-lg border border-input bg-background px-2 text-sm disabled:bg-muted"
          >
            {ATTACHMENT_KINDS.map((k) => (
              <option key={k.value} value={k.value}>
                {k.label}
              </option>
            ))}
          </select>
        </label>
        <div
          role="button"
          tabIndex={canEdit ? 0 : -1}
          aria-disabled={!canEdit}
          onClick={() => canEdit && input.current?.click()}
          onKeyDown={(e) =>
            e.key === "Enter" && canEdit && input.current?.click()
          }
          onDragOver={(e) => {
            e.preventDefault();
            if (canEdit) setDragging(true);
          }}
          onDragLeave={() => setDragging(false)}
          onDrop={(e) => {
            e.preventDefault();
            setDragging(false);
            upload([...e.dataTransfer.files]);
          }}
          className={cn(
            "min-w-60 flex-1 rounded-lg border-2 border-dashed p-3 text-center text-sm text-muted-foreground",
            canEdit
              ? "cursor-pointer hover:border-primary hover:text-primary"
              : "cursor-not-allowed opacity-60",
            dragging && "border-primary text-primary",
          )}
        >
          <input
            ref={input}
            type="file"
            accept=".pdf,.jpg,.jpeg,.png"
            multiple
            className="hidden"
            data-test="attachment-input"
            onChange={(e) => upload([...(e.target.files ?? [])])}
          />
          {pending
            ? "올리는 중…"
            : canEdit
              ? "파일을 끌어다 놓거나 클릭해서 선택 · PDF·JPG·PNG, 파일당 20MB 이하"
              : "열람 전용 — 첨부는 팀장만 할 수 있습니다"}
        </div>
      </div>
      {message && (
        <p
          role={message.ok ? "status" : "alert"}
          className={cn(
            "mb-2 rounded-lg px-3 py-2 text-sm",
            message.ok
              ? "bg-primary-50 text-primary"
              : "bg-danger-soft text-danger-strong",
          )}
        >
          {message.text}
        </p>
      )}

      {ATTACHMENT_KINDS.map((k) => {
        const items = attachments.filter((a) => a.kind === k.value);
        return (
          <div key={k.value} className="mb-3">
            <div className="text-xs font-medium text-muted-foreground">
              {k.label} <span>({items.length})</span>
            </div>
            {items.length ? (
              <div className="mt-1 flex flex-wrap gap-2">
                {items.map((a) => (
                  <div key={a.id} className="w-30">
                    <button
                      type="button"
                      title={a.name}
                      onClick={() =>
                        a.isImage
                          ? setPreview(a)
                          : window.open(fileUrl(a.id), "_blank", "noopener")
                      }
                      className="flex h-22 w-30 items-center justify-center overflow-hidden rounded-md border bg-muted"
                    >
                      {a.isImage ? (
                        // eslint-disable-next-line @next/next/no-img-element -- 로그인 쿠키가 필요한 첨부 주소
                        <img
                          src={fileUrl(a.id)}
                          alt={a.name}
                          className="h-full w-full object-cover"
                        />
                      ) : (
                        <span className="font-bold text-danger-strong">
                          PDF
                        </span>
                      )}
                    </button>
                    <div
                      className="mt-0.5 truncate text-xs"
                      title={`${a.name} · ${a.uploadedBy} ${a.uploadedAt}`}
                    >
                      {a.name}
                    </div>
                    <div className="flex items-center gap-1.5 text-[0.72rem] text-muted-foreground">
                      {formatBytes(a.size)}
                      <a
                        href={fileUrl(a.id, true)}
                        className="text-primary hover:underline"
                      >
                        받기
                      </a>
                      <button
                        type="button"
                        disabled={!canEdit || pending}
                        onClick={() => remove(a)}
                        className="text-danger-strong hover:underline disabled:opacity-40"
                      >
                        숨김
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="text-xs text-muted-foreground">없음</div>
            )}
          </div>
        );
      })}

      {preview && (
        <Modal
          open
          onClose={() => setPreview(null)}
          title={preview.name}
          titleId={titleId}
          wide
        >
          {/* eslint-disable-next-line @next/next/no-img-element -- 로그인 쿠키가 필요한 첨부 주소 */}
          <img
            src={fileUrl(preview.id)}
            alt={preview.name}
            className="mx-auto max-h-[70vh]"
          />
          <div className="mt-4 flex justify-end">
            <button
              type="button"
              onClick={() => setPreview(null)}
              className={buttonSecondaryClass}
            >
              닫기
            </button>
          </div>
        </Modal>
      )}
    </section>
  );
}
