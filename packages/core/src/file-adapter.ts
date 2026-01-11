/**
 * File Storage Adapter Interface
 *
 * This interface defines the contract for file storage adapters.
 * Implementations can target different storage providers (Storage Brain, S3, Cloudinary, etc.)
 */

export interface FileStorageAdapter {
  /**
   * Upload a file and return a reference
   */
  upload(file: File | Blob, options?: FileUploadOptions): Promise<UploadedFile>;

  /**
   * Delete a file by its ID
   */
  delete(fileId: string): Promise<void>;

  /**
   * Get a URL for accessing the file (may be signed/temporary)
   */
  getUrl(fileId: string): Promise<string>;

  /**
   * Get file metadata (optional - not all providers support this)
   */
  getMetadata?(fileId: string): Promise<FileMetadata>;
}

export interface FileUploadOptions {
  /**
   * Override the filename
   */
  fileName?: string;

  /**
   * Context for processing (e.g., 'invoice' for OCR)
   */
  context?: string;

  /**
   * Progress callback (0-100)
   */
  onProgress?: (percent: number) => void;

  /**
   * Abort signal for cancellation
   */
  signal?: AbortSignal;

  /**
   * Custom metadata to attach
   */
  metadata?: Record<string, string>;
}

export interface UploadedFile {
  /**
   * Provider's file ID
   */
  id: string;

  /**
   * Access URL
   */
  url: string;

  /**
   * Original filename
   */
  originalName: string;

  /**
   * MIME type
   */
  mimeType: string;

  /**
   * File size in bytes
   */
  sizeBytes: number;

  /**
   * Additional metadata (OCR data, thumbnails, etc.)
   */
  metadata?: Record<string, unknown>;
}

export interface FileMetadata {
  /**
   * File ID
   */
  id: string;

  /**
   * MIME type
   */
  mimeType: string;

  /**
   * File size in bytes
   */
  sizeBytes: number;

  /**
   * Creation timestamp
   */
  createdAt: Date;

  /**
   * Last modified timestamp
   */
  updatedAt?: Date;

  /**
   * Processing status (for async processing like OCR)
   */
  processingStatus?: 'pending' | 'processing' | 'completed' | 'failed';

  /**
   * Custom metadata
   */
  custom?: Record<string, unknown>;
}

/**
 * No-op file adapter for when file columns are not needed
 */
export class NoopFileAdapter implements FileStorageAdapter {
  async upload(): Promise<UploadedFile> {
    throw new Error('File adapter not configured. Please provide a FileStorageAdapter to use file columns.');
  }

  async delete(): Promise<void> {
    throw new Error('File adapter not configured.');
  }

  async getUrl(): Promise<string> {
    throw new Error('File adapter not configured.');
  }
}
