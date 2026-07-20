import { Button } from "@crikket/ui/components/ui/button"
import { Camera, Monitor, Video } from "lucide-react"
import { ShortcutKbd } from "@/components/shortcut-kbd"
import type { PopupCaptureType } from "@/hooks/use-popup-capture"
import { formatDuration } from "@/lib/utils"
import type { BugReportVisibility } from "@crikket/shared/constants/bug-report"

interface PopupCaptureActionsProps {
  isBusy: boolean
  isRecordingInProgress: boolean
  recordingCountdown: number | null
  recordingDurationMs: number
  activeCaptureType: PopupCaptureType | null
  pendingCaptureType: PopupCaptureType | null
  visibility: BugReportVisibility
  startRecordingShortcut: string | null
  startScreenshotShortcut: string | null
  stopRecordingShortcut: string | null
  onRequestCapture: (captureType: PopupCaptureType) => void
  onStopFromPopup: () => Promise<void>
  onStartCapture: (
    captureType: PopupCaptureType,
    visibility: BugReportVisibility
  ) => Promise<void>
  onClearPendingCapture: () => void
  onVisibilityChange: (visibility: BugReportVisibility) => void
}

export function PopupCaptureActions({
  isBusy,
  isRecordingInProgress,
  recordingCountdown,
  recordingDurationMs,
  activeCaptureType,
  pendingCaptureType,
  visibility,
  startRecordingShortcut,
  startScreenshotShortcut,
  stopRecordingShortcut,
  onRequestCapture,
  onStopFromPopup,
  onStartCapture,
  onClearPendingCapture,
  onVisibilityChange,
}: PopupCaptureActionsProps) {
  if (recordingCountdown) {
    return (
      <div className="rounded-md border bg-primary/5 p-3 text-center">
        <p className="font-medium text-sm">Recording starts in</p>
        <p className="font-bold text-2xl">{recordingCountdown}...</p>
      </div>
    )
  }

  return (
    <>
      {isRecordingInProgress ? (
        <div className="space-y-2">
          <div className="rounded-md border bg-destructive/5 p-3 text-center">
            <p className="font-medium text-destructive text-sm">
              Recording now
            </p>
            <p className="font-mono font-semibold text-destructive text-xl">
              {formatDuration(recordingDurationMs)}
            </p>
          </div>
          <Button
            className="w-full justify-start gap-3"
            disabled={isBusy}
            onClick={() => onStopFromPopup()}
            size="lg"
            variant="destructive"
          >
            <Video className="h-5 w-5" />
            <span>Stop Recording</span>
            <ShortcutKbd
              className="bg-destructive-foreground/15 text-destructive-foreground"
              shortcut={stopRecordingShortcut}
            />
          </Button>
        </div>
      ) : (
        <div className="space-y-2">
          <div className="rounded-md border bg-muted/30 p-2">
            <p className="mb-2 text-xs text-muted-foreground">Report visibility</p>
            <div className="grid grid-cols-2 gap-2">
              <Button
                className="justify-center"
                onClick={() => onVisibilityChange("private")}
                size="sm"
                variant={visibility === "private" ? "default" : "outline"}
              >
                Private
              </Button>
              <Button
                className="justify-center"
                onClick={() => onVisibilityChange("public")}
                size="sm"
                variant={visibility === "public" ? "default" : "outline"}
              >
                Public
              </Button>
            </div>
          </div>

          <Button
            className="w-full justify-start gap-3"
            disabled={isBusy}
            onClick={() => onRequestCapture("video")}
            size="lg"
            variant={activeCaptureType === "video" ? "default" : "outline"}
          >
            <Video className="h-5 w-5" />
            <span>Record Current Tab</span>
            <ShortcutKbd
              className={
                activeCaptureType === "video"
                  ? "bg-primary-foreground/15 text-primary-foreground"
                  : "bg-muted text-foreground"
              }
              shortcut={startRecordingShortcut}
            />
          </Button>

          <Button
            className="w-full justify-start gap-3"
            disabled={isBusy}
            onClick={() => onRequestCapture("fullscreen")}
            size="lg"
            variant={activeCaptureType === "fullscreen" ? "default" : "outline"}
          >
            <Monitor className="h-5 w-5" />
            <span>Record Full Screen or Window</span>
            <ShortcutKbd
              className={
                activeCaptureType === "fullscreen"
                  ? "bg-primary-foreground/15 text-primary-foreground"
                  : "bg-muted text-foreground"
              }
              shortcut={startRecordingShortcut}
            />
          </Button>

          <Button
            className="w-full justify-start gap-3"
            disabled={isBusy}
            onClick={() => onRequestCapture("screenshot")}
            size="lg"
            variant={activeCaptureType === "screenshot" ? "default" : "outline"}
          >
            <Camera className="h-5 w-5" />
            <span>Take Screenshot</span>
            <ShortcutKbd
              className={
                activeCaptureType === "screenshot"
                  ? "bg-primary-foreground/15 text-primary-foreground"
                  : "bg-muted text-foreground"
              }
              shortcut={startScreenshotShortcut}
            />
          </Button>
        </div>
      )}

      {pendingCaptureType ? (
        <div className="space-y-2 rounded-md border border-primary/20 bg-primary/5 p-3">
          <p className="text-sm">
            Allow Crikket to capture your current tab for{" "}
            {pendingCaptureType === "video"
              ? "tab recording"
              : pendingCaptureType === "fullscreen"
                ? "full screen or window recording"
                : "screenshot"}?
          </p>
          <div className="flex gap-2">
            <Button
              className="flex-1"
              disabled={isBusy}
              onClick={() => onStartCapture(pendingCaptureType, visibility)}
              size="sm"
              variant="outline"
            >
              Continue
            </Button>
            <Button
              className="flex-1"
              disabled={isBusy}
              onClick={onClearPendingCapture}
              size="sm"
              variant="outline"
            >
              Cancel
            </Button>
          </div>
        </div>
      ) : null}
    </>
  )
}
