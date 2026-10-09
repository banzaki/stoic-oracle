import type { Metadata } from "next";
import { ChatRoom } from "@/components/chat/ChatRoom";
import { getPhilosopher } from "@/lib/philosophers";

export const metadata: Metadata = {
  title: "Seneca · Stoic Oracle",
  description: "Converse with Seneca, grounded in the Moral Letters, the Dialogues, On Clemency and On Benefits.",
};

export default function SenecaPage() {
  return <ChatRoom philosopher={getPhilosopher("seneca")} />;
}
