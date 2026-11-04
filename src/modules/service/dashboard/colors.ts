// 서비스 대시보드 색 — design-guide 팔레트 (친구 앱 COLORS.confirmed·reference 자리)
import { PALETTE } from "@/shared/ui/chart-colors";

export const BILLING_COLORS = {
  paid: PALETTE.navy,
  free: PALETTE.copper,
  unset: PALETTE.slate,
} as const;
