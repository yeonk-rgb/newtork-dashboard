import { Suspense } from "react";

import { can, getCurrentUser } from "@/shared/auth";
import { Forbidden } from "@/shared/ui/forbidden";
import { PlaceholderPage } from "@/shared/ui/placeholder-page";

export default function ManagementPage() {
  return (
    <Suspense fallback={null}>
      <ManagementContent />
    </Suspense>
  );
}

async function ManagementContent() {
  const user = await getCurrentUser();
  if (!user || !can(user, "view", "management")) {
    return <Forbidden user={user} />;
  }

  return <PlaceholderPage title="경영지원팀" />;
}
