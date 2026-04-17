import type { DefaultSession } from "next-auth";

declare module "next-auth" {
  interface Session {
    user: {
      id: string;
      username: string;
      displayName: string;
      avatar: string | null;
      role: string;
    } & DefaultSession["user"];
  }

  interface User {
    username?: string;
    displayName?: string;
    avatar?: string | null;
    role?: string;
  }
}

declare module "@auth/core/jwt" {
  interface JWT {
    id?: string;
    username?: string;
    displayName?: string;
    avatar?: string | null;
    role?: string;
  }
}
