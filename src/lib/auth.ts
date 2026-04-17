import NextAuth from "next-auth";
import Credentials from "next-auth/providers/credentials";
import Google from "next-auth/providers/google";
import GitHub from "next-auth/providers/github";
import { PrismaAdapter } from "@auth/prisma-adapter";
import bcrypt from "bcryptjs";
import { prisma } from "@/lib/prisma";

export const { handlers, auth, signIn, signOut } = NextAuth({
  adapter: PrismaAdapter(prisma),

  session: {
    strategy: "jwt", // Required when using Credentials provider
    maxAge: 30 * 24 * 60 * 60, // 30 days
  },

  pages: {
    signIn: "/login",
    newUser: "/feed",
  },

  providers: [
    // Email + Password
    Credentials({
      credentials: {
        email: { label: "Email", type: "email" },
        password: { label: "Password", type: "password" },
      },
      async authorize(credentials) {
        const email = credentials?.email as string | undefined;
        const password = credentials?.password as string | undefined;

        if (!email || !password) return null;

        const user = await prisma.user.findUnique({
          where: { email },
        });

        if (!user || !user.passwordHash) return null;

        const isValid = await bcrypt.compare(password, user.passwordHash);
        if (!isValid) return null;

        return {
          id: user.id,
          email: user.email,
          name: user.displayName || user.name || user.username,
          image: user.avatar || user.image,
        };
      },
    }),

    // OAuth providers — auto-configured via AUTH_GOOGLE_ID/SECRET and AUTH_GITHUB_ID/SECRET env vars
    Google,
    GitHub,
  ],

  callbacks: {
    async signIn({ user, account }) {
      // For OAuth sign-ins, ensure the user has a username
      if (account?.provider !== "credentials") {
        const existingUser = await prisma.user.findUnique({
          where: { id: user.id },
        });
        if (existingUser && !existingUser.username) {
          const base =
            user.email?.split("@")[0] ||
            user.name?.toLowerCase().replace(/\s+/g, "") ||
            "user";
          const username = `${base}_${Date.now().toString(36)}`;
          await prisma.user.update({
            where: { id: user.id },
            data: {
              username,
              displayName: existingUser.displayName || user.name || username,
              avatar: existingUser.avatar || user.image,
            },
          });
        }
      }
      return true;
    },

    async jwt({ token, user, trigger }) {
      if (trigger === "signIn" && user) {
        token.id = user.id;
      }

      // Fetch latest user data from DB for each token refresh
      if (token.id) {
        try {
          const dbUser = await prisma.user.findUnique({
            where: { id: token.id as string },
            select: {
              id: true,
              email: true,
              username: true,
              displayName: true,
              avatar: true,
              image: true,
              role: true,
            },
          });
          if (dbUser) {
            token.username = dbUser.username;
            token.displayName = dbUser.displayName || dbUser.username;
            token.avatar = dbUser.avatar || dbUser.image;
            token.role = dbUser.role;
          }
        } catch {
          // DB unavailable, use token as-is
        }
      }
      return token;
    },

    async session({ session, token }) {
      if (token && session.user) {
        session.user.id = token.id as string;
        session.user.username = token.username as string;
        session.user.displayName = token.displayName as string;
        session.user.avatar = token.avatar as string | null;
        session.user.role = token.role as string;
      }
      return session;
    },
  },

  trustHost: true,
});
