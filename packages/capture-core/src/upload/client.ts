import type { BugReportDebuggerPayload } from "../debugger/types"

export interface DirectUploadTarget {
  headers: Record<string, string>
  method: "PUT"
  url: string
}

export async function uploadArtifactToStorage(
  target: DirectUploadTarget,
  blob: Blob,
  options?: {
    contentEncoding?: string
    fallback?: () => Promise<void>
  }
): Promise<void> {
  let response: Response | null = null

  try {
    response = await fetch(target.url, {
      method: target.method,
      headers: {
        ...target.headers,
        ...(options?.contentEncoding
          ? { "content-encoding": options.contentEncoding }
          : undefined),
      },
      body: blob,
      mode: "cors",
    })
  } catch (error) {
    if (options?.fallback) {
      await options.fallback()
      return
    }
    throw new Error(
      "Direct upload to storage failed before the server responded. Check storage CORS and network access, then retry.",
      {
        cause: error,
      }
    )
  }

  if (!response.ok) {
    if (options?.fallback) {
      await options.fallback()
      return
    }
    throw new Error(`Artifact upload failed with status ${response.status}.`)
  }
}

export async function buildDebuggerArtifactForUpload(
  payload: BugReportDebuggerPayload | undefined
): Promise<{ blob: Blob; contentEncoding?: string } | null> {
  if (!payload) {
    return null
  }

  const uncompressedBlob = new Blob([JSON.stringify(payload)], {
    type: "application/json",
  })

  if (typeof CompressionStream !== "function") {
    return {
      blob: uncompressedBlob,
      contentEncoding: undefined,
    }
  }

  const compressedStream = uncompressedBlob
    .stream()
    .pipeThrough(new CompressionStream("gzip"))
  const compressedBlob = await new Response(compressedStream).blob()

  return {
    blob: compressedBlob,
    contentEncoding: "gzip",
  }
}
