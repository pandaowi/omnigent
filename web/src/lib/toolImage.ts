/**
 * Helpers for recognizing and extracting image data from tool outputs.
 * Supports MCP image content blocks, browser data URLs, JSON envelopes,
 * and raw base64 image strings.
 */

import { isRecord } from "@/lib/toolValue";

export interface ExtractedImage {
  src: string;
  mimeType?: string;
  caption?: string;
}

export const BROWSER_SCREENSHOT_TOOL_NAMES = [
  "browser_screenshot",
  "mcp__omnigent__browser_screenshot",
] as const;

/** Check whether a tool name represents the embedded browser screenshot tool. */
export function isBrowserScreenshotTool(name: string): boolean {
  return (
    name === "browser_screenshot" ||
    name === "mcp__omnigent__browser_screenshot" ||
    name.endsWith("__browser_screenshot")
  );
}

/**
 * Extract renderable image data (data URL) from a tool's output string.
 * Returns null if no image data is detected.
 */
export function extractToolImage(output: string | null | undefined): ExtractedImage | null {
  if (!output) return null;
  const trimmed = output.trim();
  if (!trimmed) return null;

  // 1. Direct Data URL
  if (trimmed.startsWith("data:image/")) {
    const mimeMatch = /^data:(image\/[a-zA-Z0-9.+-]+);base64,/.exec(trimmed);
    return {
      src: trimmed,
      mimeType: mimeMatch ? mimeMatch[1] : undefined,
    };
  }

  // 2. Parse JSON containers
  if (trimmed.startsWith("{") || trimmed.startsWith("[")) {
    try {
      const json = JSON.parse(trimmed) as unknown;
      const fromJson = extractImageFromJson(json);
      if (fromJson) return fromJson;
    } catch {
      // Ignore JSON parse errors, continue to raw fallback
    }
  }

  // 3. Raw Base64 string fallback
  const clean = trimmed.replace(/\s+/g, "");
  if (clean.length > 50 && /^[A-Za-z0-9+/=]+$/.test(clean)) {
    const mime = detectMimeFromBase64(clean);
    if (mime || clean.length > 500) {
      return {
        src: `data:${mime || "image/png"};base64,${clean}`,
        mimeType: mime || "image/png",
      };
    }
  }

  return null;
}

function extractImageFromJson(value: unknown): ExtractedImage | null {
  if (!value) return null;

  // MCP Content block array: [{ type: "image", data: "...", mimeType: "..." }]
  if (Array.isArray(value)) {
    for (const block of value) {
      if (isRecord(block) && block.type === "image" && typeof block.data === "string") {
        const mime = typeof block.mimeType === "string" ? block.mimeType : "image/png";
        const src = block.data.startsWith("data:")
          ? block.data
          : `data:${mime};base64,${block.data}`;
        return { src, mimeType: mime };
      }
    }
    return null;
  }

  if (!isRecord(value)) return null;

  // Error responses should not be treated as images
  if (value.error || value.isError === true || value.ok === false) {
    return null;
  }

  // Omnigent MCP envelope or standard MCP tool result: { content: [...] }
  if (Array.isArray(value.content)) {
    const fromContent = extractImageFromJson(value.content);
    if (fromContent) return fromContent;
  }

  // Direct data_url or dataUrl (browser relay contract)
  if (typeof value.data_url === "string") {
    return extractToolImage(value.data_url);
  }
  if (typeof value.dataUrl === "string") {
    return extractToolImage(value.dataUrl);
  }

  // Generic { image: "..." }
  if (typeof value.image === "string") {
    return extractToolImage(value.image);
  }

  // Omnigent result wrapper: { result: "..." }
  if (typeof value.result === "string") {
    return extractToolImage(value.result);
  }

  return null;
}

/** Detect image MIME type from the first few base64 characters. */
function detectMimeFromBase64(b64: string): string | null {
  if (b64.startsWith("iVBORw0KGgo")) return "image/png";
  if (b64.startsWith("/9j/")) return "image/jpeg";
  if (b64.startsWith("R0lGOD")) return "image/gif";
  if (b64.startsWith("UklGR")) return "image/webp";
  return null;
}
