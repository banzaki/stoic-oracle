import type { Metadata } from "next";
import { ChatRoom } from "@/components/chat/ChatRoom";
import { getPhilosopher } from "@/lib/philosophers";

export const metadata: Metadata = {
  title: "Epictetus · Stoic Oracle",
  description: "Converse with Epictetus, grounded in the Discourses, the Enchiridion and the Golden Sayings.",
};

export default function EpictetusPage() {
  return <ChatRoom philosopher={getPhilosopher("epictetus")} />;
}
