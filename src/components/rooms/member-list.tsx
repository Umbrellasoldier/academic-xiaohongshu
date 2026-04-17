"use client";

import { Users, Wifi } from "lucide-react";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import type { RoomDetail } from "@/types";

interface MemberListProps {
  members: RoomDetail["members"];
  onlineCount: number;
}

export function MemberList({ members, onlineCount }: MemberListProps) {
  const roleLabel: Record<string, string> = {
    OWNER: "创建者",
    ADMIN: "管理员",
    MEMBER: "成员",
  };

  const roleColor: Record<string, string> = {
    OWNER: "text-amber-600 dark:text-amber-400",
    ADMIN: "text-blue-600 dark:text-blue-400",
    MEMBER: "text-muted-foreground",
  };

  return (
    <div className="space-y-3">
      {/* Online count */}
      <div className="flex items-center gap-2 text-xs text-muted-foreground">
        <Wifi className="h-3.5 w-3.5 text-green-500" />
        <span>{onlineCount} 人在线</span>
        <span>·</span>
        <Users className="h-3.5 w-3.5" />
        <span>{members.length} 位成员</span>
      </div>

      {/* Member list */}
      <div className="space-y-1">
        {members.map((member) => (
          <div
            key={member.id}
            className="flex items-center gap-2 rounded-lg px-2 py-1.5 hover:bg-muted/50"
          >
            <div className="relative">
              <Avatar className="h-7 w-7">
                <AvatarImage src={member.avatar || undefined} />
                <AvatarFallback className="text-[10px]">
                  {member.displayName.charAt(0)}
                </AvatarFallback>
              </Avatar>
              {/* Online dot (randomly show as online for mock) */}
              {Math.random() > 0.5 && (
                <span className="absolute -bottom-0.5 -right-0.5 h-2.5 w-2.5 rounded-full border-2 border-background bg-green-500" />
              )}
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-xs font-medium truncate">
                {member.displayName}
              </p>
              <p className={`text-[10px] ${roleColor[member.role]}`}>
                {roleLabel[member.role]}
              </p>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
