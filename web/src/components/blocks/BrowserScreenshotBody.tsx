import { useCallback, useMemo } from "react";
import { DownloadIcon, ImageIcon, ZoomInIcon } from "lucide-react";

import { ZoomableImage } from "@/components/ImageLightbox";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { extractToolImage } from "@/lib/toolImage";
import type { ToolCall } from "@/lib/toolResultSummary";
import { parseToolOutput, toolErrorMessage } from "@/lib/toolValue";
import { cn } from "@/lib/utils";
import { OutputSection, ToolErrorBox } from "./ToolCodePanel";

export function BrowserScreenshotBody({ call }: { call: ToolCall }) {
  const { output, state } = call;

  const error = useMemo(() => {
    if (output === null) {
      return state === "output-error" ? "Screenshot failed with no output." : null;
    }
    const parsed = parseToolOutput(output);
    return toolErrorMessage(parsed);
  }, [output, state]);

  const image = useMemo(() => {
    if (error !== null || output === null) return null;
    return extractToolImage(output);
  }, [error, output]);

  const handleDownload = useCallback(() => {
    if (!image?.src) return;
    const link = document.createElement("a");
    link.href = image.src;
    link.download = `browser-screenshot-${new Date().toISOString().slice(0, 19).replace(/[:T]/g, "-")}.png`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  }, [image?.src]);

  if (output === null && state !== "output-available") {
    // When still pending, ToolCard's parent tabs content handles pending state
    return null;
  }

  if (error !== null) {
    return <ToolErrorBox>{error}</ToolErrorBox>;
  }

  if (image !== null) {
    return (
      <div className="space-y-2" data-testid="browser-screenshot-body">
        <div
          className={cn(
            "group relative flex max-w-full items-center justify-center overflow-hidden rounded-md border border-border",
            "bg-muted/10 p-2 sm:p-3",
          )}
        >
          <ZoomableImage
            src={image.src}
            alt="Browser screenshot"
            className="max-h-[32rem] w-auto max-w-full rounded border border-border/50 object-contain shadow-sm transition-transform duration-200 hover:scale-[1.005]"
          />
        </div>

        <div className="flex flex-wrap items-center justify-between gap-2 rounded-md border border-border/40 bg-muted/20 px-3 py-1.5 text-xs text-muted-foreground">
          <div className="flex items-center gap-1.5">
            <Badge variant="outline" className="h-5 gap-1 border-border/50 px-1.5 text-[10px] font-normal">
              <ImageIcon className="size-3" />
              <span>{image.mimeType?.replace("image/", "").toUpperCase() || "PNG"}</span>
            </Badge>
            <span className="flex items-center gap-1 text-muted-foreground/80">
              <ZoomInIcon className="size-3" />
              <span>Click image to zoom</span>
            </span>
          </div>

          <Button
            type="button"
            size="xs"
            variant="ghost"
            onClick={handleDownload}
            className="h-6 gap-1 px-2 text-xs"
            aria-label="Download screenshot"
          >
            <DownloadIcon className="size-3" />
            <span>Download</span>
          </Button>
        </div>
      </div>
    );
  }

  // Fallback for non-image, non-error output text
  if (output !== null && output.trim() !== "") {
    return <OutputSection output={output} language="text" />;
  }

  return <p className="text-sm text-muted-foreground">No screenshot data recorded.</p>;
}
