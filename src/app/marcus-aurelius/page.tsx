import type { Metadata } from "next";
import { ChatRoom } from "@/components/chat/ChatRoom";
import { getPhilosopher } from "@/lib/philosophers";

export const metadata: Metadata = {
  title: "Marcus Aurelius · Stoic Oracle",
  description: "Converse with Marcus Aurelius, grounded in the Meditations.",
};

export default function MarcusAureliusPage() {
  return <ChatRoom philosopher={getPhilosopher("marcus-aurelius")} />;
}
