import { Button } from "@crikket/ui/components/ui/button"
import { Paintbrush, RotateCcw, Square, Undo } from "lucide-react"
import { useCallback, useEffect, useRef, useState } from "react"

export type ToolMode = "draw" | "redact"

interface ScreenshotAnnotatorProps {
  previewUrl: string
  onSave?: (blob: Blob) => void
}

interface DrawPath {
  tool: ToolMode
  points: { x: number; y: number }[]
  color: string
  width: number
}

export function ScreenshotAnnotator({
  previewUrl,
  onSave,
}: ScreenshotAnnotatorProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const imageRef = useRef<HTMLImageElement | null>(null)

  const [tool, setTool] = useState<ToolMode>("draw")
  const [isDrawing, setIsDrawing] = useState(false)
  const [paths, setPaths] = useState<DrawPath[]>([])
  const [currentPath, setCurrentPath] = useState<DrawPath | null>(null)

  // Load image
  useEffect(() => {
    const img = new Image()
    img.src = previewUrl
    img.onload = () => {
      imageRef.current = img
      redraw()
    }
  }, [previewUrl])

  const redraw = useCallback(() => {
    const canvas = canvasRef.current
    const ctx = canvas?.getContext("2d")
    const img = imageRef.current
    if (!canvas || !ctx || !img) return

    // Only set canvas size on first load or resize, to keep it crisp
    if (canvas.width !== img.width || canvas.height !== img.height) {
      canvas.width = img.width
      canvas.height = img.height
    }

    // Draw base image
    ctx.clearRect(0, 0, canvas.width, canvas.height)
    ctx.drawImage(img, 0, 0, canvas.width, canvas.height)

    // Draw all completed paths
    const drawSinglePath = (path: DrawPath) => {
      ctx.beginPath()
      if (path.tool === "draw") {
        ctx.strokeStyle = path.color
        ctx.lineWidth = path.width
        ctx.lineJoin = "round"
        ctx.lineCap = "round"
        for (let i = 0; i < path.points.length; i++) {
          const p = path.points[i]
          if (i === 0) ctx.moveTo(p.x, p.y)
          else ctx.lineTo(p.x, p.y)
        }
        ctx.stroke()
      } else if (path.tool === "redact") {
        ctx.fillStyle = path.color
        const start = path.points[0]
        const end = path.points[path.points.length - 1]
        if (start && end) {
          ctx.fillRect(start.x, start.y, end.x - start.x, end.y - start.y)
        }
      }
    }

    paths.forEach(drawSinglePath)
    if (currentPath) {
      drawSinglePath(currentPath)
    }

    // Auto save whenever there are changes
    canvas.toBlob((blob) => {
      if (blob && onSave) onSave(blob)
    }, "image/png")
  }, [paths, currentPath, onSave])

  useEffect(() => {
    redraw()
  }, [redraw])

  const getCoordinates = (
    e:
      | React.MouseEvent<HTMLCanvasElement>
      | React.TouchEvent<HTMLCanvasElement>
  ) => {
    const canvas = canvasRef.current
    if (!canvas) return { x: 0, y: 0 }

    const rect = canvas.getBoundingClientRect()
    // Calculate scaling factor between displayed size and actual canvas size
    const scaleX = canvas.width / rect.width
    const scaleY = canvas.height / rect.height

    let clientX
    let clientY
    if ("touches" in e) {
      clientX = e.touches[0].clientX
      clientY = e.touches[0].clientY
    } else {
      clientX = e.clientX
      clientY = e.clientY
    }

    return {
      x: (clientX - rect.left) * scaleX,
      y: (clientY - rect.top) * scaleY,
    }
  }

  const handlePointerDown = (
    e:
      | React.MouseEvent<HTMLCanvasElement>
      | React.TouchEvent<HTMLCanvasElement>
  ) => {
    setIsDrawing(true)
    const pos = getCoordinates(e)
    setCurrentPath({
      tool,
      color: tool === "draw" ? "#ef4444" : "#000000",
      width: tool === "draw" ? Math.max(4, canvasRef.current!.width * 0.005) : 0, // dynamic width
      points: [pos],
    })
  }

  const handlePointerMove = (
    e:
      | React.MouseEvent<HTMLCanvasElement>
      | React.TouchEvent<HTMLCanvasElement>
  ) => {
    if (!isDrawing || !currentPath) return
    const pos = getCoordinates(e)
    setCurrentPath({
      ...currentPath,
      points: [...currentPath.points, pos],
    })
  }

  const handlePointerUp = () => {
    if (!isDrawing || !currentPath) return
    setIsDrawing(false)
    setPaths([...paths, currentPath])
    setCurrentPath(null)
  }

  const handleUndo = () => {
    setPaths(paths.slice(0, -1))
  }

  const handleReset = () => {
    setPaths([])
  }

  return (
    <div className="flex flex-col gap-3">
      <div className="flex items-center gap-2 rounded-lg bg-muted p-2">
        <Button
          onClick={() => setTool("draw")}
          size="sm"
          type="button"
          variant={tool === "draw" ? "default" : "ghost"}
        >
          <Paintbrush className="mr-2 h-4 w-4" />
          Draw
        </Button>
        <Button
          onClick={() => setTool("redact")}
          size="sm"
          type="button"
          variant={tool === "redact" ? "default" : "ghost"}
        >
          <Square className="mr-2 h-4 w-4" />
          Redact
        </Button>
        <div className="flex-1" />
        <Button
          disabled={paths.length === 0}
          onClick={handleUndo}
          size="sm"
          type="button"
          variant="ghost"
        >
          <Undo className="h-4 w-4" />
        </Button>
        <Button
          disabled={paths.length === 0}
          onClick={handleReset}
          size="sm"
          type="button"
          variant="ghost"
        >
          <RotateCcw className="h-4 w-4" />
        </Button>
      </div>
      <div className="relative flex touch-none items-center justify-center overflow-hidden rounded-xl border bg-black shadow-sm">
        <canvas
          className="max-h-[400px] w-full cursor-crosshair object-contain"
          onMouseDown={handlePointerDown}
          onMouseLeave={handlePointerUp}
          onMouseMove={handlePointerMove}
          onMouseUp={handlePointerUp}
          onTouchEnd={handlePointerUp}
          onTouchMove={handlePointerMove}
          onTouchStart={handlePointerDown}
          ref={canvasRef}
        />
      </div>
    </div>
  )
}
