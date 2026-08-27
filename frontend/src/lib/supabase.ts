import { createClient, SupabaseClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '';
export const SUPABASE_BUCKET =
  process.env.NEXT_PUBLIC_SUPABASE_BUCKET || 'invoices';

let supabaseClient: SupabaseClient | null = null;

export const isSupabaseConfigured = () => {
  return (
    Boolean(supabaseUrl) &&
    Boolean(supabaseAnonKey) &&
    !supabaseUrl.includes('your-project') &&
    !supabaseAnonKey.includes('your-supabase')
  );
};

export const getSupabase = (): SupabaseClient | null => {
  if (!supabaseClient && isSupabaseConfigured()) {
    supabaseClient = createClient(supabaseUrl, supabaseAnonKey);
  }
  return supabaseClient;
};

export interface UploadResult {
  fileName: string;
  storagePath: string;
  mimeType: string;
  fileSize: number;
  previewUrl?: string;
}

/**
 * Uploads a file directly to Supabase Storage or generates a safe client reference.
 */
export async function uploadInvoiceFile(file: File): Promise<UploadResult> {
  const fileExt = file.name.split('.').pop() || 'pdf';
  const uniqueId =
    typeof crypto !== 'undefined' && crypto.randomUUID
      ? crypto.randomUUID()
      : Math.random().toString(36).substring(2, 10);
  const cleanName = file.name.replace(/[^a-zA-Z0-9._-]/g, '_');
  const storagePath = `invoices/${uniqueId}_${cleanName}`;

  const client = getSupabase();

  if (client) {
    const { data, error } = await client.storage
      .from(SUPABASE_BUCKET)
      .upload(storagePath, file, {
        contentType: file.type || 'application/octet-stream',
        upsert: true,
      });

    if (error) {
      console.error('Supabase upload error:', error);
      throw new Error(`Failed to upload to Supabase: ${error.message}`);
    }

    return {
      fileName: file.name,
      storagePath: data.path,
      mimeType: file.type || (fileExt === 'pdf' ? 'application/pdf' : 'image/jpeg'),
      fileSize: file.size,
    };
  }

  // Fallback if Supabase is in placeholder/mock mode
  console.warn(
    'Supabase credentials not configured in browser. Simulating direct storage upload.',
  );
  return {
    fileName: file.name,
    storagePath: storagePath,
    mimeType: file.type || (fileExt === 'pdf' ? 'application/pdf' : 'image/jpeg'),
    fileSize: file.size,
  };
}
