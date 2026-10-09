import type { PhilosopherId } from "../philosophers";
import { EPICTETUS_SYSTEM_PROMPT } from "./epictetus";
import { MARCUS_AURELIUS_SYSTEM_PROMPT } from "./marcus-aurelius";
import { SENECA_SYSTEM_PROMPT } from "./seneca";

export const SYSTEM_PROMPTS: Record<PhilosopherId, string> = {
  epictetus: EPICTETUS_SYSTEM_PROMPT,
  "marcus-aurelius": MARCUS_AURELIUS_SYSTEM_PROMPT,
  seneca: SENECA_SYSTEM_PROMPT,
};
