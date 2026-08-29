/**
 * Talvyn Storage Abstraction Layer
 *
 * Provides a decoupled file storage interface supporting local filesystem storage
 * for development and ready for cloud providers (e.g. Supabase Storage / S3).
 */

import fs from 'fs'
import path from 'path'

export interface StoredFileResult {
  fileUrl: string
  storagePath: string
  fileName: string
  fileSize: number
  mimeType: string
}

export interface StorageProvider {
  name: string
  uploadFile(
    file: Express.Multer.File,
    folder: 'avatars' | 'resumes',
    customFilename?: string
  ): Promise<StoredFileResult>
  getFile(storagePath: string): Promise<{ stream: fs.ReadStream; mimeType: string; fileName: string } | null>
  deleteFile(storagePath: string): Promise<boolean>
}

export class LocalStorageProvider implements StorageProvider {
  name = 'LocalStorageProvider'
  private uploadsRoot: string

  constructor(uploadsDir = 'uploads') {
    this.uploadsRoot = path.resolve(process.cwd(), uploadsDir)
    this.ensureDirectoryExists(path.join(this.uploadsRoot, 'avatars'))
    this.ensureDirectoryExists(path.join(this.uploadsRoot, 'resumes'))
  }

  private ensureDirectoryExists(dir: string): void {
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true })
    }
  }

  async uploadFile(
    file: Express.Multer.File,
    folder: 'avatars' | 'resumes',
    customFilename?: string
  ): Promise<StoredFileResult> {
    const targetDir = path.join(this.uploadsRoot, folder)
    this.ensureDirectoryExists(targetDir)

    const ext = path.extname(file.originalname).toLowerCase()
    const uniqueName = customFilename || `${Date.now()}-${Math.random().toString(36).substring(2, 9)}${ext}`
    const fullPath = path.join(targetDir, uniqueName)

    // Write buffer to disk
    await fs.promises.writeFile(fullPath, file.buffer)

    const storagePath = `${folder}/${uniqueName}`
    const fileUrl = folder === 'avatars'
      ? `/uploads/avatars/${uniqueName}`
      : `/api/resumes/file/${uniqueName}`

    return {
      fileUrl,
      storagePath,
      fileName: file.originalname,
      fileSize: file.size || file.buffer.length,
      mimeType: file.mimetype,
    }
  }

  async getFile(storagePath: string): Promise<{ stream: fs.ReadStream; mimeType: string; fileName: string } | null> {
    const fullPath = path.join(this.uploadsRoot, storagePath)
    if (!fs.existsSync(fullPath)) {
      return null
    }

    const stream = fs.createReadStream(fullPath)
    const ext = path.extname(fullPath).toLowerCase()

    let mimeType = 'application/octet-stream'
    if (ext === '.pdf') mimeType = 'application/pdf'
    else if (ext === '.doc') mimeType = 'application/msword'
    else if (ext === '.docx') mimeType = 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
    else if (ext === '.png') mimeType = 'image/png'
    else if (ext === '.jpg' || ext === '.jpeg') mimeType = 'image/jpeg'
    else if (ext === '.webp') mimeType = 'image/webp'

    return {
      stream,
      mimeType,
      fileName: path.basename(fullPath),
    }
  }

  async deleteFile(storagePath: string): Promise<boolean> {
    try {
      const fullPath = path.join(this.uploadsRoot, storagePath)
      if (fs.existsSync(fullPath)) {
        await fs.promises.unlink(fullPath)
        return true
      }
      return false
    } catch (err) {
      console.warn('[LocalStorageProvider] Failed to delete file:', err)
      return false
    }
  }
}

export const storageService = new LocalStorageProvider()
