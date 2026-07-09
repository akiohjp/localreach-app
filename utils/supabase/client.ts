import { createBrowserClient } from "@supabase/ssr";
import type { Database } from "@/types/database";

export function createClient() {
  return createBrowserClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      auth: {
        // /auth/callback exchanges the ?code= explicitly; leaving auto-detection
        // on makes the client consume the PKCE verifier first and the explicit
        // exchange then fails with "code verifier not found".
        detectSessionInUrl: false,
      },
    }
  );
}
