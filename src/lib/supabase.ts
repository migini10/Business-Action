import { createClient } from '@supabase/supabase-js';

let supabaseInstance: ReturnType<typeof createClient> | null = null;

export function getSupabase() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '';
  
  if (!supabaseInstance && url && key) {
    supabaseInstance = createClient(url, key);
  }
  
  if (!supabaseInstance) {
    throw new Error('Supabase URL or Key is missing');
  }
  
  return supabaseInstance;
}

// No fallback to a literal bucket name on purpose: a silent default would risk
// a dev/preview environment reading or deleting Production Storage files.
export function getDossierDocumentsBucket(): string {
  const bucket = process.env.SUPABASE_STORAGE_BUCKET;
  if (!bucket) {
    throw new Error('SUPABASE_STORAGE_BUCKET is not set. Refusing to fall back to a default bucket name.');
  }
  return bucket;
}
