// 출장보고서 입력·수정·PDF로 등록 화면 (서버) — 입력 권한(팀장 이상)이 없으면 안내만
import "server-only";

import Link from "next/link";

import { getCurrentUser } from "@/shared/auth";
import { AuditNotice } from "@/shared/ui/audit-notice";
import { Forbidden } from "@/shared/ui/forbidden";
import { pageTitleClass } from "@/shared/ui/styles";

import { ReadOnlyBadge } from "../read-only-badge";
import { serviceAbilities } from "../rules";
import { loadNames, loadReport } from "./load-reports";
import { emptyForm, type FormValues } from "./form-values";
import { ReportForm } from "./report-form";

const iso = (d: Date | null) => (d ? d.toISOString().slice(0, 10) : "");
const kstLocal = (d: Date | null) =>
  d ? new Date(d.getTime() + 9 * 3600_000).toISOString().slice(0, 16) : "";

export async function ReportFormScreen({
  id,
  fromPdf,
}: {
  id?: string;
  fromPdf?: boolean;
}) {
  const user = await getCurrentUser();
  const abilities = serviceAbilities(user);
  if (!abilities.canView) return <Forbidden user={user} />;
  const title = id
    ? "출장보고서 수정"
    : fromPdf
      ? "PDF로 등록"
      : "출장보고서 입력";
  if (!abilities.canEdit) {
    return (
      <div className="space-y-4">
        <h1 className={`${pageTitleClass} flex flex-wrap items-center gap-3`}>
          {title}
          <ReadOnlyBadge note="입력·수정은 팀장만 할 수 있습니다" />
        </h1>
        <p className="rounded-card border bg-card p-6 text-sm text-muted-foreground">
          서비스팀원은 출장보고서를 열람만 할 수 있습니다.{" "}
          <Link
            href={id ? `/service/reports/${id}` : "/service/reports"}
            className="text-primary hover:underline"
          >
            {id ? "상세로 돌아가기" : "출장보고서 목록"}
          </Link>
        </p>
      </div>
    );
  }

  const names = await loadNames();
  let initial: FormValues | undefined;
  let updatedAt: string | undefined;
  if (id) {
    const r = await loadReport(id);
    if (!r || r.deletedAt) {
      return (
        <p
          role="alert"
          className="rounded-lg bg-danger-soft px-4 py-2 text-sm text-danger-strong"
        >
          출장보고서를 찾을 수 없습니다(숨긴 보고서는 복구한 뒤 수정하세요).
        </p>
      );
    }
    updatedAt = r.updatedAt.toISOString();
    initial = {
      ...emptyForm(),
      ...Object.fromEntries(
        Object.entries(r).filter(([, v]) => typeof v === "string"),
      ),
      region: r.region ?? "",
      sigungu: r.sigungu ?? "",
      billing: r.billing ?? "",
      tripStart: iso(r.tripStart),
      tripEnd: iso(r.tripEnd),
      happyCallDate: iso(r.happyCallDate),
      writtenAt: kstLocal(r.writtenAt),
      companions: r.companions.map((c) => c.name),
      products: r.products.map((p) => ({
        ...p,
        quantity: p.quantity === null ? "" : String(p.quantity),
      })),
      parts: r.parts.map((p) => ({
        name: p.name,
        quantity: p.quantity === null ? "" : String(p.quantity),
      })),
    } as FormValues;
  }

  return (
    <div className="space-y-4">
      <div>
        <h1 className={pageTitleClass}>{title}</h1>
        <AuditNotice />
      </div>
      <ReportForm
        mode={id ? "edit" : fromPdf ? "pdf" : "new"}
        id={id}
        updatedAt={updatedAt}
        initial={initial}
        names={names}
      />
    </div>
  );
}
