// Cliente Supabase compartido, como módulo ES nativo (sin bundler: los
// navegadores modernos cargan ESM directamente con <script type="module">).
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { LOCAL_SIMPLE_CONFIG } from "./config.js";

export const sb = createClient(
  LOCAL_SIMPLE_CONFIG.supabaseUrl,
  LOCAL_SIMPLE_CONFIG.supabaseAnonKey
);
