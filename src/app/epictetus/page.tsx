import type { Metadata } from "next";
import { ChatRoom } from "@/components/chat/ChatRoom";
import { getPhilosopher } from "@/lib/philosophers";

export const metadata: Metadata = {
  title: "Epictetus · Stoic Oracle",
  description: "Converse with Epictetus, grounded in the Discourses, the Enchiridion and the Golden Sayings.",
};

const SUGGESTIONS = [
  "I keep worrying about losing my job.",
  "Someone insulted me today and I can't let it go.",
  "How can a slave be freer than an emperor?",
  "My father is dying. How do I bear it?",
];

export default function EpictetusPage() {
  return (
    <ChatRoom
      philosopher={getPhilosopher("epictetus")}
      // Verified verbatim against the Enchiridion (Long) in library/.
      opening={{ text: "Of things some are in our power, and others are not.", ref: "Enchiridion 1 · tr. George Long" }}
      suggestions={SUGGESTIONS}
    />
  );
}
