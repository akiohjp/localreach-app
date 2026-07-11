/** Register the "@/..." resolve hook (used via: node --import ./scripts/register-hook.mjs). */
import { register } from "node:module";
register("./at-resolve.mjs", import.meta.url);
