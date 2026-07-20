import type { BugReportDebuggerPayload } from "@crikket/capture-core/debugger/types"
import {
  buildDebuggerArtifactForUpload,
  uploadArtifactToStorage,
} from "@crikket/capture-core/upload/client"
import type { Priority } from "@crikket/shared/constants/priorities"
import type { BugReportVisibility } from "@crikket/shared/constants/bug-report"
import { client } from "./orpc"

async function blobToBase64(blob: Blob): Promise<string> {
  const buffer = await blob.arrayBuffer()
  const bytes = new Uint8Array(buffer)
  let binary = ""
  for (let i = 0; i < bytes.byteLength; i++) {
    binary += String.fromCharCode(bytes[i])
  }
  return btoa(binary)
}

async function uploadProxyArtifactWithChunking(input: {
  bugReportId: string
  artifactKind: "capture" | "debugger"
  blob: Blob
  contentType?: string
  contentEncoding?: string
  chunkSizeMB?: number
}): Promise<void> {
  const chunkSizeMB = input.chunkSizeMB ?? 50
  const chunkSizeBytes = chunkSizeMB * 1024 * 1024

  if (input.blob.size <= chunkSizeBytes) {
    const base64Data = await blobToBase64(input.blob)
    await client.bugReport.uploadProxy({
      id: input.bugReportId,
      artifactKind: input.artifactKind,
      base64Data,
      contentType: input.contentType,
      contentEncoding: input.contentEncoding,
    })
    return
  }

  const totalParts = Math.ceil(input.blob.size / chunkSizeBytes)

  for (let i = 0; i < totalParts; i++) {
    const start = i * chunkSizeBytes
    const end = Math.min((i + 1) * chunkSizeBytes, input.blob.size)
    const chunkBlob = input.blob.slice(start, end)
    const base64Chunk = await blobToBase64(chunkBlob)

    await client.bugReport.uploadProxyChunk({
      id: input.bugReportId,
      artifactKind: input.artifactKind,
      partIndex: i,
      totalParts,
      base64Chunk,
      contentType: input.contentType,
      contentEncoding: input.contentEncoding,
    })
  }
}

export async function submitBugReportWithUploads(input: {
  attachment: Blob
  attachmentType: "video" | "screenshot"
  debuggerPayload?: BugReportDebuggerPayload
  debuggerSummary: {
    actions: number
    logs: number
    networkRequests: number
  }
  description?: string
  deviceInfo?: {
    browser?: string
    os?: string
    viewport?: string
  }
  metadata?: {
    duration?: string
    durationMs?: number
    pageTitle?: string
  }
  priority: Priority
  title?: string
  url?: string
  visibility: BugReportVisibility
}): Promise<Awaited<ReturnType<typeof client.bugReport.finalizeUpload>>> {
  const uploadSession = await client.bugReport.createUpload({
    attachmentType: input.attachmentType,
    captureContentType: input.attachment.type || undefined,
    description: input.description,
    deviceInfo: input.deviceInfo,
    hasDebuggerPayload: Boolean(input.debuggerPayload),
    debuggerSummary: input.debuggerSummary,
    metadata: input.metadata,
    priority: input.priority,
    title: input.title,
    url: input.url,
    visibility: input.visibility,
  })

  const debuggerArtifact = await buildDebuggerArtifactForUpload(
    input.debuggerPayload
  )
  const uploadMode = uploadSession.uploadMode ?? "auto"
  const chunkSizeMB = uploadSession.uploadChunkSizeMB ?? 50

  const performCaptureUpload = async () => {
    if (uploadMode === "proxy") {
      await uploadProxyArtifactWithChunking({
        bugReportId: uploadSession.bugReportId,
        artifactKind: "capture",
        blob: input.attachment,
        contentType: input.attachment.type || undefined,
        chunkSizeMB,
      })
      return
    }

    const fallback =
      uploadMode === "auto"
        ? async () => {
            await uploadProxyArtifactWithChunking({
              bugReportId: uploadSession.bugReportId,
              artifactKind: "capture",
              blob: input.attachment,
              contentType: input.attachment.type || undefined,
              chunkSizeMB,
            })
          }
        : undefined

    await uploadArtifactToStorage(
      uploadSession.captureUpload,
      input.attachment,
      {
        fallback,
      }
    )
  }

  const performDebuggerUpload = async () => {
    if (!uploadSession.debuggerUpload || !debuggerArtifact) {
      return
    }

    if (uploadMode === "proxy") {
      await uploadProxyArtifactWithChunking({
        bugReportId: uploadSession.bugReportId,
        artifactKind: "debugger",
        blob: debuggerArtifact.blob,
        contentType: "application/json",
        contentEncoding: debuggerArtifact.contentEncoding,
        chunkSizeMB,
      })
      return
    }

    const fallback =
      uploadMode === "auto"
        ? async () => {
            await uploadProxyArtifactWithChunking({
              bugReportId: uploadSession.bugReportId,
              artifactKind: "debugger",
              blob: debuggerArtifact.blob,
              contentType: "application/json",
              contentEncoding: debuggerArtifact.contentEncoding,
              chunkSizeMB,
            })
          }
        : undefined

    await uploadArtifactToStorage(
      uploadSession.debuggerUpload,
      debuggerArtifact.blob,
      {
        contentEncoding: debuggerArtifact.contentEncoding,
        fallback,
      }
    )
  }

  await Promise.all([performCaptureUpload(), performDebuggerUpload()])

  return client.bugReport.finalizeUpload({
    id: uploadSession.bugReportId,
    captureContentType: input.attachment.type || undefined,
    captureSizeBytes: input.attachment.size,
    debuggerContentEncoding: debuggerArtifact?.contentEncoding,
    debuggerSizeBytes: debuggerArtifact?.blob.size,
  })
}
