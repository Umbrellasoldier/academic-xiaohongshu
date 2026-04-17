// Shared types for the application

export interface PostCardData {
  id: string;
  title: string;
  summary: string | null;
  coverImage: string | null;
  createdAt: string;
  subject: {
    name: string;
    nameZh: string;
    slug: string;
    color: string;
  };
  author: {
    username: string;
    displayName: string;
    avatar: string | null;
  };
  likeCount: number;
  commentCount: number;
  isLiked?: boolean;
  isBookmarked?: boolean;
}

export interface PostDetail extends PostCardData {
  content: unknown; // TipTap JSON
  images: string[];
  viewCount: number;
  bookmarkCount: number;
  tags: { id: string; name: string }[];
  citations: CitationData[];
  aiSummary: string | null;
  aiTranslation: Record<string, unknown> | null;
}

export interface CitationData {
  id: string;
  context: string | null;
  order: number;
  paper: PaperMetadata;
}

export interface PaperMetadata {
  id: string;
  doi: string | null;
  arxivId: string | null;
  title: string;
  authors: PaperAuthor[];
  abstract: string | null;
  journal: string | null;
  year: number | null;
  url: string | null;
  citationCount: number | null;
}

export interface PaperAuthor {
  name: string;
  affiliation?: string;
  orcid?: string;
}

export interface UserProfile {
  id: string;
  username: string;
  displayName: string;
  avatar: string | null;
  bio: string | null;
  institution: string | null;
  orcid: string | null;
  postCount: number;
  followerCount: number;
  followingCount: number;
  isFollowing?: boolean;
}

export interface SubjectData {
  id: string;
  name: string;
  nameZh: string;
  slug: string;
  color: string;
  icon: string | null;
  children?: SubjectData[];
}

export interface RoomData {
  id: string;
  name: string;
  description: string | null;
  avatarUrl?: string | null;
  subject: SubjectData | null;
  memberCount: number;
  isPublic: boolean;
  isMember?: boolean;
  lastMessage?: {
    content: string;
    author: string;
    createdAt: string;
  } | null;
  createdAt: string;
  creator: {
    username: string;
    displayName: string;
    avatar: string | null;
  };
}

export interface RoomMessageData {
  id: string;
  content: string;
  type: "TEXT" | "PAPER_SHARE" | "IMAGE" | "SYSTEM";
  createdAt: string;
  author: {
    id: string;
    username: string;
    displayName: string;
    avatar: string | null;
  };
  replyTo?: {
    id: string;
    content: string;
    author: { displayName: string };
  } | null;
  /** For PAPER_SHARE type — parsed paper metadata */
  paperData?: {
    title: string;
    authors: string;
    doi?: string;
    year?: number;
  } | null;
}

export interface NotificationData {
  id: string;
  type: "COMMENT" | "LIKE" | "FOLLOW" | "ROOM_MESSAGE" | "SYSTEM";
  title: string;
  body: string;
  isRead: boolean;
  createdAt: string;
  /** The user who triggered the notification */
  actor: {
    username: string;
    displayName: string;
    avatar: string | null;
  } | null;
  /** Link to navigate to when clicked */
  link: string | null;
}

export interface RoomDetail extends RoomData {
  members: {
    id: string;
    username: string;
    displayName: string;
    avatar: string | null;
    role: "OWNER" | "ADMIN" | "MEMBER";
    joinedAt: string;
  }[];
  onlineCount: number;
}

export interface CommentData {
  id: string;
  content: string;
  createdAt: string;
  author: {
    username: string;
    displayName: string;
    avatar: string | null;
  };
  likeCount: number;
  isLiked?: boolean;
  parentId: string | null;
  replies?: CommentData[];
}
