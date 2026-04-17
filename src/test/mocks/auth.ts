import { vi } from "vitest";

type MockSession = {
  user: {
    id: string;
    username: string;
    displayName: string;
    email: string;
    avatar: string | null;
    role: string;
  };
  expires: string;
} | null;

export const authMock = vi.fn<() => Promise<MockSession>>();

export function setMockSession(session: MockSession) {
  authMock.mockResolvedValue(session);
}

export function setAuthenticatedUser(overrides?: Partial<NonNullable<MockSession>["user"]>) {
  setMockSession({
    user: {
      id: "user-1",
      username: "testuser",
      displayName: "Test User",
      email: "test@example.com",
      avatar: null,
      role: "USER",
      ...overrides,
    },
    expires: new Date(Date.now() + 86400000).toISOString(),
  });
}

export function clearMockSession() {
  setMockSession(null);
}

vi.mock("@/lib/auth", () => ({
  auth: authMock,
}));
