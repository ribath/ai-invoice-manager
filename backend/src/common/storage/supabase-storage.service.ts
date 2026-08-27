import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { createClient, SupabaseClient } from '@supabase/supabase-js';

if (typeof (globalThis as any).WebSocket === 'undefined') {
  (globalThis as any).WebSocket = class WebSocket {};
}

@Injectable()
export class SupabaseStorageService {
  private readonly logger = new Logger(SupabaseStorageService.name);
  private supabase: SupabaseClient | null = null;
  private readonly bucket: string;

  constructor(private readonly configService: ConfigService) {
    const supabaseUrl = this.configService.get<string>('SUPABASE_URL');
    const serviceRoleKey = this.configService.get<string>(
      'SUPABASE_SERVICE_ROLE_KEY',
    );
    this.bucket = this.configService.get<string>('SUPABASE_BUCKET', 'invoices');

    if (
      supabaseUrl &&
      serviceRoleKey &&
      !supabaseUrl.includes('your-project') &&
      !serviceRoleKey.includes('your-supabase')
    ) {
      try {
        this.supabase = createClient(supabaseUrl, serviceRoleKey, {
          auth: {
            persistSession: false,
            autoRefreshToken: false,
          },
        });
        this.logger.log('Supabase client initialized successfully.');
      } catch (err) {
        this.logger.error('Failed to initialize Supabase client:', err);
      }
    } else {
      this.logger.warn(
        'Supabase credentials not configured or set to placeholder. Storage calls will use fallback URLs.',
      );
    }
  }

  /**
   * Generates a temporary signed URL for viewing/fetching private bucket assets.
   */
  async getSignedUrl(
    storagePath: string,
    expiresInSeconds: number = 3600,
  ): Promise<string> {
    if (!this.supabase) {
      this.logger.warn(
        `Supabase not configured. Returning fallback for: ${storagePath}`,
      );
      return '';
    }

    try {
      const { data, error } = await this.supabase.storage
        .from(this.bucket)
        .createSignedUrl(storagePath, expiresInSeconds);

      if (data?.signedUrl) {
        return data.signedUrl;
      }
    } catch (e) {
      // Fall through to public URL
    }

    // Fallback to public URL if bucket is public or signed URL fails
    const { data: pubData } = this.supabase.storage
      .from(this.bucket)
      .getPublicUrl(storagePath);

    return pubData?.publicUrl || '';
  }

  /**
   * Uploads a file buffer directly to Supabase storage bucket.
   */
  async uploadFile(
    storagePath: string,
    fileBuffer: Buffer,
    mimeType: string,
  ): Promise<string> {
    if (!this.supabase) {
      this.logger.warn(
        `Supabase not configured. Mocking upload for: ${storagePath}`,
      );
      return storagePath;
    }

    const { data, error } = await this.supabase.storage
      .from(this.bucket)
      .upload(storagePath, fileBuffer, {
        contentType: mimeType,
        upsert: true,
      });

    if (error) {
      this.logger.error(
        `Failed to upload file to path "${storagePath}": ${error.message}`,
      );
      throw new Error(`Supabase upload failed: ${error.message}`);
    }

    return data.path;
  }

  /**
   * Downloads a file as a Buffer.
   */
  async downloadFile(storagePath: string): Promise<Buffer | null> {
    if (!this.supabase) {
      return null;
    }

    const { data, error } = await this.supabase.storage
      .from(this.bucket)
      .download(storagePath);

    if (error || !data) {
      this.logger.error(
        `Failed to download file "${storagePath}": ${error?.message}`,
      );
      return null;
    }

    const arrayBuffer = await data.arrayBuffer();
    return Buffer.from(arrayBuffer);
  }
}
