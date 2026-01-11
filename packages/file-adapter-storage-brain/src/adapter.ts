import type {
  FileStorageAdapter,
  FileUploadOptions,
  UploadedFile,
  FileMetadata,
} from '@marlinjai/data-table-core';
import {
  StorageBrain,
  type StorageBrainConfig,
  type ProcessingContext,
  type FileInfo,
} from '@marlinjai/storage-brain-sdk';

/**
 * Configuration for the Storage Brain file adapter
 */
export interface StorageBrainFileAdapterConfig {
  /**
   * Storage Brain API key
   */
  apiKey: string;

  /**
   * Base URL for the Storage Brain API (optional)
   */
  baseUrl?: string;

  /**
   * Default processing context for uploads (default: 'default')
   * - 'invoice' - Enables OCR text extraction
   * - 'framer-site' - Enables thumbnail generation
   * - 'newsletter' - Image validation and EXIF extraction
   * - 'default' - Basic validation only
   */
  defaultContext?: ProcessingContext;

  /**
   * Request timeout in milliseconds (default: 30000)
   */
  timeout?: number;

  /**
   * Number of retry attempts (default: 3)
   */
  maxRetries?: number;
}

/**
 * File storage adapter implementation using Storage Brain.
 *
 * Storage Brain is an edge-native file storage service that provides:
 * - File uploads with progress tracking
 * - OCR text extraction (via Google Cloud Vision)
 * - Automatic thumbnail generation
 * - Image validation and EXIF extraction
 *
 * @example
 * ```typescript
 * const fileAdapter = new StorageBrainFileAdapter({
 *   apiKey: process.env.STORAGE_BRAIN_API_KEY,
 *   defaultContext: 'invoice', // Enable OCR for receipts
 * });
 *
 * // Use with DataTableProvider
 * <DataTableProvider
 *   dbAdapter={dbAdapter}
 *   fileAdapter={fileAdapter}
 *   workspaceId="my-workspace"
 * >
 *   ...
 * </DataTableProvider>
 * ```
 */
export class StorageBrainFileAdapter implements FileStorageAdapter {
  private client: StorageBrain;
  private defaultContext: ProcessingContext;

  constructor(config: StorageBrainFileAdapterConfig) {
    const sdkConfig: StorageBrainConfig = {
      apiKey: config.apiKey,
      baseUrl: config.baseUrl,
      timeout: config.timeout,
      maxRetries: config.maxRetries,
    };

    this.client = new StorageBrain(sdkConfig);
    this.defaultContext = config.defaultContext ?? 'default';
  }

  /**
   * Upload a file to Storage Brain
   */
  async upload(
    file: File | Blob,
    options?: FileUploadOptions
  ): Promise<UploadedFile> {
    // Determine the context - allow override via options
    const context = (options?.context as ProcessingContext) ?? this.defaultContext;

    // Upload to Storage Brain
    const result = await this.client.upload(file, {
      context,
      onProgress: options?.onProgress,
      signal: options?.signal,
      tags: options?.metadata,
    });

    // Convert to UploadedFile format
    return this.convertToUploadedFile(result);
  }

  /**
   * Delete a file from Storage Brain
   */
  async delete(fileId: string): Promise<void> {
    await this.client.deleteFile(fileId);
  }

  /**
   * Get a URL for accessing the file
   * For Storage Brain, the URL is already public and doesn't expire
   */
  async getUrl(fileId: string): Promise<string> {
    const file = await this.client.getFile(fileId);
    return file.url;
  }

  /**
   * Get file metadata including OCR results
   */
  async getMetadata(fileId: string): Promise<FileMetadata> {
    const file = await this.client.getFile(fileId);

    return {
      id: file.id,
      mimeType: file.fileType,
      sizeBytes: file.sizeBytes,
      createdAt: new Date(file.createdAt),
      processingStatus: this.mapProcessingStatus(file.processingStatus),
      custom: {
        context: file.context,
        tags: file.tags,
        thumbnailUrls: file.metadata?.thumbnailUrls,
        ocrData: file.metadata?.ocrData,
        imageInfo: file.metadata?.imageInfo,
      },
    };
  }

  /**
   * Get the underlying Storage Brain client for advanced operations
   */
  getClient(): StorageBrain {
    return this.client;
  }

  /**
   * Convert Storage Brain FileInfo to UploadedFile format
   */
  private convertToUploadedFile(file: FileInfo): UploadedFile {
    return {
      id: file.id,
      url: file.url,
      originalName: file.originalName,
      mimeType: file.fileType,
      sizeBytes: file.sizeBytes,
      metadata: {
        context: file.context,
        processingStatus: file.processingStatus,
        tags: file.tags,
        thumbnailUrls: file.metadata?.thumbnailUrls,
        ocrData: file.metadata?.ocrData,
        imageInfo: file.metadata?.imageInfo,
      },
    };
  }

  /**
   * Map Storage Brain processing status to adapter format
   */
  private mapProcessingStatus(
    status: string
  ): 'pending' | 'processing' | 'completed' | 'failed' {
    switch (status) {
      case 'pending':
        return 'pending';
      case 'processing':
        return 'processing';
      case 'completed':
        return 'completed';
      case 'failed':
        return 'failed';
      default:
        return 'pending';
    }
  }
}
