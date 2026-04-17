import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { PostActions } from "@/components/post/post-actions";

// Mock sonner toast
vi.mock("sonner", () => ({
  toast: {
    success: vi.fn(),
    error: vi.fn(),
  },
}));

describe("PostActions", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    global.fetch = vi.fn().mockResolvedValue({ ok: true });
  });

  it("renders like count and bookmark count", () => {
    render(
      <PostActions
        postId="post-1"
        initialLikeCount={10}
        initialBookmarkCount={5}
        commentCount={3}
      />
    );
    expect(screen.getByText("10")).toBeInTheDocument();
    expect(screen.getByText("5")).toBeInTheDocument();
    expect(screen.getByText("3")).toBeInTheDocument();
  });

  it("hides counts when they are zero", () => {
    render(
      <PostActions
        postId="post-1"
        initialLikeCount={0}
        initialBookmarkCount={0}
        commentCount={0}
      />
    );
    // Zero counts render as empty strings
    const spans = screen.getAllByText("");
    expect(spans.length).toBeGreaterThanOrEqual(3);
  });

  it("optimistically increments like count on click", async () => {
    const user = userEvent.setup();
    render(
      <PostActions
        postId="post-1"
        initialLikeCount={10}
        initialBookmarkCount={0}
        commentCount={0}
      />
    );

    expect(screen.getByText("10")).toBeInTheDocument();

    // Click the like button (first button)
    const buttons = screen.getAllByRole("button");
    await user.click(buttons[0]); // Like button

    expect(screen.getByText("11")).toBeInTheDocument();
    expect(global.fetch).toHaveBeenCalledWith("/api/posts/post-1/like", {
      method: "POST",
    });
  });

  it("optimistically decrements like count when already liked", async () => {
    const user = userEvent.setup();
    render(
      <PostActions
        postId="post-1"
        initialLikeCount={10}
        initialBookmarkCount={0}
        commentCount={0}
        isLiked={true}
      />
    );

    const buttons = screen.getAllByRole("button");
    await user.click(buttons[0]); // Like button

    expect(screen.getByText("9")).toBeInTheDocument();
  });

  it("optimistically toggles bookmark", async () => {
    const user = userEvent.setup();
    render(
      <PostActions
        postId="post-1"
        initialLikeCount={0}
        initialBookmarkCount={5}
        commentCount={0}
      />
    );

    expect(screen.getByText("5")).toBeInTheDocument();

    const buttons = screen.getAllByRole("button");
    await user.click(buttons[2]); // Bookmark button (3rd)

    expect(screen.getByText("6")).toBeInTheDocument();
    expect(global.fetch).toHaveBeenCalledWith("/api/posts/post-1/bookmark", {
      method: "POST",
    });
  });

  it("calls onCommentClick when comment button is clicked", async () => {
    const user = userEvent.setup();
    const onComment = vi.fn();

    render(
      <PostActions
        postId="post-1"
        initialLikeCount={0}
        initialBookmarkCount={0}
        commentCount={2}
        onCommentClick={onComment}
      />
    );

    const buttons = screen.getAllByRole("button");
    await user.click(buttons[1]); // Comment button (2nd)

    expect(onComment).toHaveBeenCalledOnce();
  });

  it("reverts like on fetch error", async () => {
    const user = userEvent.setup();
    global.fetch = vi.fn().mockRejectedValue(new Error("Network error"));

    render(
      <PostActions
        postId="post-1"
        initialLikeCount={10}
        initialBookmarkCount={0}
        commentCount={0}
      />
    );

    const buttons = screen.getAllByRole("button");
    await user.click(buttons[0]); // Like

    // After error, should revert to original count
    // Wait for the fetch to reject
    await vi.waitFor(() => {
      expect(screen.getByText("10")).toBeInTheDocument();
    });
  });
});
