import type { Metadata } from "next";
import { CouncilRoom } from "@/components/council/CouncilRoom";

export const metadata: Metadata = {
  title: "The Council of the Stoa · Stoic Oracle",
  description: "Put one question to Epictetus, Seneca and Marcus Aurelius together, and hear where they agree and disagree.",
};

export default function CouncilPage() {
  return <CouncilRoom />;
}
