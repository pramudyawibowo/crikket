"use client"

import { cn } from "@crikket/ui/lib/utils"
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@crikket/ui/components/ui/tooltip"
import {
  Maximize,
  Minimize,
  Pause,
  Play,
  Volume2,
  VolumeX,
} from "lucide-react"
import React, { useCallback, useEffect, useRef, useState } from "react"

export interface VideoMarker {
  id: string
  offset: number
  label: string
  type?: "error" | "info"
}

interface CustomVideoPlayerProps {
  src?: string
  durationMs?: number | null
  markers?: VideoMarker[]
  className?: string
  videoClassName?: string
  onTimeUpdate?: (currentTimeMs: number) => void
  onLoadedMetadata?: (event: React.SyntheticEvent<HTMLVideoElement>) => void
}

function formatTime(ms: number) {
  if (!Number.isFinite(ms) || ms < 0) return "0:00"
  const totalSeconds = Math.floor(ms / 1000)
  const minutes = Math.floor(totalSeconds / 60)
  const seconds = totalSeconds % 60
  return `${minutes}:${seconds.toString().padStart(2, "0")}`
}

export const CustomVideoPlayer = React.forwardRef<HTMLVideoElement, CustomVideoPlayerProps>(
  (
    {
      src,
      durationMs,
      markers = [],
      className,
      videoClassName,
      onTimeUpdate,
      onLoadedMetadata,
    },
    forwardedRef
  ) => {
    const internalRef = useRef<HTMLVideoElement>(null)
    const containerRef = useRef<HTMLDivElement>(null)
    const seekbarRef = useRef<HTMLDivElement>(null)

    const [isPlaying, setIsPlaying] = useState(false)
    const [currentTime, setCurrentTime] = useState(0)
    const [duration, setDuration] = useState(durationMs ? durationMs / 1000 : 0)
    const [isMuted, setIsMuted] = useState(false)
    const [isFullscreen, setIsFullscreen] = useState(false)
    const [showControls, setShowControls] = useState(true)
    
    // Sync forwardedRef
    useEffect(() => {
      if (typeof forwardedRef === "function") {
        forwardedRef(internalRef.current)
      } else if (forwardedRef) {
        forwardedRef.current = internalRef.current
      }
    }, [forwardedRef])

    const player = internalRef.current

    useEffect(() => {
      let hideTimeout: NodeJS.Timeout
      const handleMouseMove = () => {
        setShowControls(true)
        clearTimeout(hideTimeout)
        if (isPlaying) {
          hideTimeout = setTimeout(() => setShowControls(false), 2000)
        }
      }
      
      const handleMouseLeave = () => {
        if (isPlaying) setShowControls(false)
      }

      const container = containerRef.current
      if (container) {
        container.addEventListener("mousemove", handleMouseMove)
        container.addEventListener("mouseleave", handleMouseLeave)
      }
      return () => {
        if (container) {
          container.removeEventListener("mousemove", handleMouseMove)
          container.removeEventListener("mouseleave", handleMouseLeave)
        }
        clearTimeout(hideTimeout)
      }
    }, [isPlaying])

    const togglePlay = (e?: React.MouseEvent) => {
      e?.stopPropagation()
      if (!player) return
      if (player.paused) {
        player.play().catch(() => {})
      } else {
        player.pause()
      }
    }

    const toggleMute = (e?: React.MouseEvent) => {
      e?.stopPropagation()
      if (!player) return
      player.muted = !player.muted
      setIsMuted(player.muted)
    }

    const toggleFullscreen = async (e?: React.MouseEvent) => {
      e?.stopPropagation()
      if (!containerRef.current) return
      
      if (!document.fullscreenElement) {
        await containerRef.current.requestFullscreen().catch(() => {})
        setIsFullscreen(true)
      } else {
        await document.exitFullscreen().catch(() => {})
        setIsFullscreen(false)
      }
    }

    useEffect(() => {
      const handleFullscreenChange = () => {
        setIsFullscreen(!!document.fullscreenElement)
      }
      document.addEventListener("fullscreenchange", handleFullscreenChange)
      return () => document.removeEventListener("fullscreenchange", handleFullscreenChange)
    }, [])

    const handleSeek = (e: React.MouseEvent<HTMLDivElement>) => {
      e.stopPropagation()
      if (!player || !seekbarRef.current || duration === 0) return
      const rect = seekbarRef.current.getBoundingClientRect()
      const pos = (e.clientX - rect.left) / rect.width
      const targetTime = Math.max(0, Math.min(pos * duration, duration))
      player.currentTime = targetTime
      setCurrentTime(targetTime)
    }

    const handleTimeUpdate = (e: React.SyntheticEvent<HTMLVideoElement>) => {
      setCurrentTime(e.currentTarget.currentTime)
      onTimeUpdate?.(e.currentTarget.currentTime * 1000)
    }

    const handleLoadedMetadata = (e: React.SyntheticEvent<HTMLVideoElement>) => {
      if (durationMs) {
        setDuration(durationMs / 1000)
      } else if (Number.isFinite(e.currentTarget.duration)) {
        setDuration(e.currentTarget.duration)
      }
      onLoadedMetadata?.(e)
    }

    const progressPercent = duration > 0 ? (currentTime / duration) * 100 : 0

    return (
      <div 
        ref={containerRef} 
        className={cn("group relative flex flex-col items-center justify-center overflow-hidden rounded-lg bg-black", className)}
      >
        {/* Video Element */}
        {/* biome-ignore lint/a11y/useMediaCaption: uploaded bug recordings do not have caption tracks yet */}
        <video
          ref={internalRef}
          src={src}
          className={cn("w-full h-full object-contain outline-none", videoClassName)}
          onClick={togglePlay}
          onTimeUpdate={handleTimeUpdate}
          onLoadedMetadata={handleLoadedMetadata}
          onPlay={() => setIsPlaying(true)}
          onPause={() => setIsPlaying(false)}
          onEnded={() => setIsPlaying(false)}
          preload="metadata"
          playsInline
        />

        {/* Play Overlay (when paused) */}
        {!isPlaying && (
          <div 
            className="pointer-events-none absolute inset-0 flex items-center justify-center bg-black/20 transition-opacity"
          >
            <div className="flex h-16 w-16 items-center justify-center rounded-full bg-background/50 backdrop-blur-md">
              <Play className="h-8 w-8 text-foreground ml-1" />
            </div>
          </div>
        )}

        {/* Controls Bar */}
        <div 
          className={cn(
            "absolute bottom-0 left-0 right-0 flex flex-col justify-end bg-gradient-to-t from-black/80 via-black/40 to-transparent p-4 transition-opacity duration-300",
            showControls ? "opacity-100" : "opacity-0"
          )}
        >
          {/* Seekbar */}
          <div 
            ref={seekbarRef}
            className="group/seekbar relative mb-4 h-1.5 w-full cursor-pointer rounded-full bg-white/20 transition-all hover:h-2"
            onClick={handleSeek}
            onPointerDown={(e) => {
               // Prevent default to avoid selection during drag
               e.preventDefault()
               const handlePointerMove = (ev: PointerEvent) => {
                 if (!player || !seekbarRef.current || duration === 0) return
                 const rect = seekbarRef.current.getBoundingClientRect()
                 const pos = (ev.clientX - rect.left) / rect.width
                 const targetTime = Math.max(0, Math.min(pos * duration, duration))
                 player.currentTime = targetTime
                 setCurrentTime(targetTime)
               }
               const handlePointerUp = () => {
                 document.removeEventListener("pointermove", handlePointerMove)
                 document.removeEventListener("pointerup", handlePointerUp)
               }
               document.addEventListener("pointermove", handlePointerMove)
               document.addEventListener("pointerup", handlePointerUp)
            }}
          >
            <div 
              className="absolute bottom-0 left-0 top-0 rounded-full bg-primary"
              style={{ width: `${progressPercent}%` }}
            />
            
            {/* Markers */}
            <TooltipProvider delay={100}>
              {markers.map((marker) => {
                const markerPercent = durationMs 
                  ? (marker.offset / durationMs) * 100 
                  : duration > 0 ? (marker.offset / (duration * 1000)) * 100 : -1
                  
                if (markerPercent < 0 || markerPercent > 100) return null
                
                return (
                  <Tooltip key={marker.id}>
                    <TooltipTrigger
                      render={
                        <div 
                          className={cn(
                            "absolute top-1/2 h-2.5 w-2.5 -translate-x-1/2 -translate-y-1/2 rounded-full border border-black transition-transform hover:scale-150",
                            marker.type === "error" ? "bg-red-500" : "bg-blue-400"
                          )}
                          style={{ left: `${markerPercent}%` }}
                          onClick={(e) => {
                            e.stopPropagation()
                            if (player) {
                              player.currentTime = marker.offset / 1000
                            }
                          }}
                        />
                      }
                    />
                    <TooltipContent side="top" className="text-xs">
                      {marker.label}
                    </TooltipContent>
                  </Tooltip>
                )
              })}
            </TooltipProvider>
          </div>

          {/* Bottom Row Controls */}
          <div className="flex items-center justify-between text-white">
            <div className="flex items-center gap-4">
              <button 
                onClick={togglePlay}
                className="transition-transform hover:scale-110 focus:outline-none"
              >
                {isPlaying ? <Pause className="h-5 w-5" /> : <Play className="h-5 w-5" />}
              </button>
              
              <button 
                onClick={toggleMute}
                className="transition-transform hover:scale-110 focus:outline-none"
              >
                {isMuted ? <VolumeX className="h-5 w-5" /> : <Volume2 className="h-5 w-5" />}
              </button>
              
              <span className="text-xs font-medium tabular-nums opacity-90">
                {formatTime(currentTime * 1000)} / {formatTime(duration * 1000)}
              </span>
            </div>

            <button 
              onClick={toggleFullscreen}
              className="transition-transform hover:scale-110 focus:outline-none"
            >
              {isFullscreen ? <Minimize className="h-5 w-5" /> : <Maximize className="h-5 w-5" />}
            </button>
          </div>
        </div>
      </div>
    )
  }
)

CustomVideoPlayer.displayName = "CustomVideoPlayer"
