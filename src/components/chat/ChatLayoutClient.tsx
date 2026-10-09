"use client";

import dynamic from "next/dynamic";

const ChatLayout = dynamic(() => import("./ChatLayout"), { ssr: false });

export default function ChatLayoutClient() {
  return <ChatLayout />;
}
