import { getServerSession } from "next-auth";
import { authOptions, type UserRole } from "./auth";

export async function getSession() {
  return getServerSession(authOptions);
}

export async function requireAuth(minRole?: UserRole) {
  const session = await getSession();
  if (!session?.user) {
    return { error: "認証が必要です", status: 401 } as const;
  }

  if (minRole) {
    const hierarchy: UserRole[] = ["viewer", "editor", "admin", "owner"];
    const userLevel = hierarchy.indexOf((session.user as { role: UserRole }).role);
    const requiredLevel = hierarchy.indexOf(minRole);
    if (userLevel < requiredLevel) {
      return { error: "権限がありません", status: 403 } as const;
    }
  }

  return { session } as const;
}
