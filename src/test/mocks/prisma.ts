import { vi } from "vitest";

// Deep-mock every Prisma model method
const modelMethods = [
  "findUnique",
  "findFirst",
  "findMany",
  "create",
  "createMany",
  "update",
  "updateMany",
  "upsert",
  "delete",
  "deleteMany",
  "count",
  "aggregate",
  "groupBy",
] as const;

function createModelMock() {
  const mock: Record<string, ReturnType<typeof vi.fn>> = {};
  for (const m of modelMethods) {
    mock[m] = vi.fn();
  }
  return mock;
}

export const prismaMock = {
  user: createModelMock(),
  post: createModelMock(),
  comment: createModelMock(),
  like: createModelMock(),
  bookmark: createModelMock(),
  commentLike: createModelMock(),
  follow: createModelMock(),
  notification: createModelMock(),
  subject: createModelMock(),
  tag: createModelMock(),
  postTag: createModelMock(),
  postCitation: createModelMock(),
  paper: createModelMock(),
  room: createModelMock(),
  discussionRoom: createModelMock(),
  roomMember: createModelMock(),
  roomMessage: createModelMock(),
  roomJoinRequest: createModelMock(),
  $transaction: vi.fn((fn: (tx: unknown) => unknown) => fn(prismaMock)),
};

vi.mock("@/lib/prisma", () => ({
  prisma: prismaMock,
}));
