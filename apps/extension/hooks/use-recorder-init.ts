import { BUG_REPORT_VISIBILITY_OPTIONS, type BugReportVisibility } from "@crikket/shared/constants/bug-report"
import { useEffect, useRef } from "react"
import { BUG_REPORT_VISIBILITY_STORAGE_KEY } from "@/lib/capture-context"

export type CaptureType = "video" | "screenshot"
export type VideoCaptureSource = "tab" | "fullscreen"

interface UseRecorderInitProps {
  onCaptureTypeChange: (type: CaptureType) => void
  onVideoCaptureSourceLoaded: (source: VideoCaptureSource) => void
  onScreenshotLoaded: (blob: Blob) => void
  onStartRecording: () => void
  onStartFullscreenRecording: () => void
  onVisibilityLoaded: (visibility: BugReportVisibility) => void
  onError: (error: string) => void
}

export function useRecorderInit({
  onCaptureTypeChange,
  onVideoCaptureSourceLoaded,
  onScreenshotLoaded,
  onStartRecording,
  onStartFullscreenRecording,
  onVisibilityLoaded,
  onError,
}: UseRecorderInitProps) {
  const autoStartChecked = useRef(false)

  useEffect(() => {
    const params = new URLSearchParams(window.location.search)
    const type = (params.get("captureType") as CaptureType) || "video"
    onCaptureTypeChange(type)
    const source =
      (params.get("captureSource") as VideoCaptureSource) || "tab"
    onVideoCaptureSourceLoaded(source)

    chrome.storage.local.get([BUG_REPORT_VISIBILITY_STORAGE_KEY], (result) => {
      const storedVisibility = result[BUG_REPORT_VISIBILITY_STORAGE_KEY]
      onVisibilityLoaded(
        storedVisibility === BUG_REPORT_VISIBILITY_OPTIONS.public
          ? BUG_REPORT_VISIBILITY_OPTIONS.public
          : BUG_REPORT_VISIBILITY_OPTIONS.private
      )
      chrome.storage.local.remove([BUG_REPORT_VISIBILITY_STORAGE_KEY])
    })

    if (type === "screenshot") {
      chrome.storage.local.get(["pendingScreenshot"], (result) => {
        if (result.pendingScreenshot) {
          fetch(result.pendingScreenshot as string)
            .then((res) => res.blob())
            .then((blob) => {
              onScreenshotLoaded(blob)
              chrome.storage.local.remove(["pendingScreenshot"])
            })
            .catch((err) => {
              console.error("Failed to load screenshot:", err)
              onError("Failed to load screenshot")
            })
        }
      })
    } else if (type === "video") {
      if (autoStartChecked.current) return
      autoStartChecked.current = true

      chrome.storage.local.get(["startRecordingImmediately"], (result) => {
        if (result.startRecordingImmediately) {
          chrome.storage.local.remove(["startRecordingImmediately"])
          if (source === "fullscreen") {
            onStartFullscreenRecording()
          } else {
            onStartRecording()
          }
        }
      })
    }
  }, [
    onCaptureTypeChange,
    onVideoCaptureSourceLoaded,
    onScreenshotLoaded,
    onStartRecording,
    onStartFullscreenRecording,
    onError,
  ])
}
