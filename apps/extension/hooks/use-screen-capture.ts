import { reportNonFatalError } from "@crikket/shared/lib/errors"
import { useCallback, useRef, useState } from "react"
import { readAndClearCaptureTabId } from "@/lib/capture-context"
import { requestTabCaptureStream } from "@/lib/display-media"

export interface UseScreenCaptureReturn {
  isRecording: boolean
  recordedBlob: Blob | null
  screenshotBlob: Blob | null
  error: string | null
  startRecording: () => Promise<boolean>
  startFullscreenRecording: () => Promise<boolean>
  stopRecording: () => Promise<Blob | null>
  takeScreenshot: () => Promise<Blob | null>
  reset: () => void
  setRecordedBlob: (blob: Blob | null) => void
  setScreenshotBlob: (blob: Blob | null) => void
}

export function useScreenCapture(): UseScreenCaptureReturn {
  const [isRecording, setIsRecording] = useState(false)
  const [recordedBlob, setRecordedBlob] = useState<Blob | null>(null)
  const [screenshotBlob, setScreenshotBlob] = useState<Blob | null>(null)
  const [error, setError] = useState<string | null>(null)

  const mediaRecorderRef = useRef<MediaRecorder | null>(null)
  const streamRef = useRef<MediaStream | null>(null)
  const chunksRef = useRef<Blob[]>([])

  const focusCapturedTab = useCallback(async (tabId: number): Promise<void> => {
    try {
      const tab = await chrome.tabs.get(tabId)
      if (typeof tab.windowId === "number") {
        await chrome.windows.update(tab.windowId, { focused: true })
      }
      await chrome.tabs.update(tabId, { active: true })
    } catch (error) {
      reportNonFatalError(
        `Failed to focus captured tab ${tabId} after recording started`,
        error
      )
    }
  }, [])

  const startRecordingWithStream = useCallback(
    async (stream: MediaStream): Promise<boolean> => {
      try {
        streamRef.current = stream

        const mediaRecorder = new MediaRecorder(stream, {
          mimeType: "video/webm;codecs=vp9",
        })

        mediaRecorderRef.current = mediaRecorder
        chunksRef.current = []

        mediaRecorder.ondataavailable = (event) => {
          if (event.data.size > 0) {
            chunksRef.current.push(event.data)
          }
        }

        mediaRecorder.onstop = () => {
          const blob = new Blob(chunksRef.current, { type: "video/webm" })
          setRecordedBlob(blob)
          setIsRecording(false)

          for (const track of stream.getTracks()) {
            track.stop()
          }
        }
        stream.getVideoTracks()[0].onended = () => {
          if (mediaRecorderRef.current?.state === "recording") {
            mediaRecorderRef.current.stop()
          }
        }

        mediaRecorder.start(1000)
        setIsRecording(true)
        return true
      } catch (err) {
        const message =
          err instanceof Error ? err.message : "Failed to start recording"
        setError(message)
        setIsRecording(false)
        return false
      }
    },
    []
  )

  const startRecording = useCallback(async (): Promise<boolean> => {
    try {
      setError(null)
      setRecordedBlob(null)

      const captureTabId = await readAndClearCaptureTabId()
      if (!captureTabId) {
        throw new Error(
          "Could not lock the source tab. Please start recording from the extension popup."
        )
      }

      const stream = await requestTabCaptureStream(captureTabId)
      const success = await startRecordingWithStream(stream)
      if (success) {
        void focusCapturedTab(captureTabId)
      }

      return success
    } catch (err) {
      const message =
        err instanceof Error ? err.message : "Failed to start recording"
      setError(message)
      setIsRecording(false)
      return false
    }
  }, [focusCapturedTab, startRecordingWithStream])

  const startFullscreenRecording = useCallback(async (): Promise<boolean> => {
    try {
      setError(null)
      setRecordedBlob(null)

      const stream = await navigator.mediaDevices.getDisplayMedia({
        audio: false,
        video: {
          displaySurface: "monitor",
        },
      })
      return await startRecordingWithStream(stream)
    } catch (err) {
      const message =
        err instanceof Error ? err.message : "Failed to start recording"
      setError(message)
      setIsRecording(false)
      return false
    }
  }, [startRecordingWithStream])

  const stopRecording = useCallback((): Promise<Blob | null> => {
    return new Promise((resolve) => {
      if (
        !mediaRecorderRef.current ||
        mediaRecorderRef.current.state !== "recording"
      ) {
        resolve(null)
        return
      }

      mediaRecorderRef.current.onstop = () => {
        const blob = new Blob(chunksRef.current, { type: "video/webm" })
        setRecordedBlob(blob)
        setIsRecording(false)

        if (streamRef.current) {
          for (const track of streamRef.current.getTracks()) {
            track.stop()
          }
        }

        resolve(blob)
      }

      mediaRecorderRef.current.stop()
    })
  }, [])

  const takeScreenshot = useCallback(async (): Promise<Blob | null> => {
    try {
      setError(null)
      setScreenshotBlob(null)

      const stream = await navigator.mediaDevices.getDisplayMedia({
        video: {
          displaySurface: "browser",
        },
        audio: false,
      })

      const videoTrack = stream.getVideoTracks()[0]
      const settings = videoTrack.getSettings()

      const video = document.createElement("video")
      video.srcObject = stream
      video.autoplay = true

      await new Promise<void>((resolve) => {
        video.onloadedmetadata = () => {
          video.play()
          resolve()
        }
      })

      await new Promise((resolve) => setTimeout(resolve, 100))

      const canvas = document.createElement("canvas")
      canvas.width = settings.width || video.videoWidth
      canvas.height = settings.height || video.videoHeight

      const ctx = canvas.getContext("2d")
      if (!ctx) {
        throw new Error("Could not get canvas context")
      }

      ctx.drawImage(video, 0, 0)

      for (const track of stream.getTracks()) {
        track.stop()
      }
      return new Promise((resolve) => {
        canvas.toBlob((blob) => {
          setScreenshotBlob(blob)
          resolve(blob)
        }, "image/png")
      })
    } catch (err) {
      const message =
        err instanceof Error ? err.message : "Failed to take screenshot"
      setError(message)
      return null
    }
  }, [])

  const reset = useCallback(() => {
    setRecordedBlob(null)
    setScreenshotBlob(null)
    setError(null)
    setIsRecording(false)

    if (mediaRecorderRef.current?.state === "recording") {
      mediaRecorderRef.current.stop()
    }
    if (streamRef.current) {
      for (const track of streamRef.current.getTracks()) {
        track.stop()
      }
    }
  }, [])

  return {
    isRecording,
    recordedBlob,
    screenshotBlob,
    error,
    startRecording,
    startFullscreenRecording,
    stopRecording,
    takeScreenshot,
    reset,
    setRecordedBlob,
    setScreenshotBlob,
  }
}
