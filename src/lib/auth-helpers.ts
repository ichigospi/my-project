import { getServerSession } from "next-auth";
import { headers } from "next/headers";
import { authOptions, type UserRole } from "./auth";

async function isLocalhost(): Promise<boolean> {
  try {
    const headersList = await headers();
    const host = headersList.get("host") || "";
    return !host.includes("my-project-production-d888.up.railway.app");
  } catch {
    return false;
  }
}

const LOCAL_SESSION = {
  user: {
    id: "local",
    name: "ローカルユーザー",
    email: "local@localhost",
    role: "admin" as UserRole,
  },
};

export async function getSession() {
  if (await isLocalhost()) {
    return LOCAL_SESSION;
  }
  return getServerSession(authOptions);
}

export async function requireAuth(minRole?: UserRole) {
  if (await isLocalhost()) {
    return { session: LOCAL_SESSION } as const;
  }

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
