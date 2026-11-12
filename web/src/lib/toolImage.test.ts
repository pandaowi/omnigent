import { describe, expect, it } from "vitest";
import { extractToolImage, isBrowserScreenshotTool } from "./toolImage";

describe("toolImage", () => {
  describe("isBrowserScreenshotTool", () => {
    it("identifies browser screenshot tool names", () => {
      expect(isBrowserScreenshotTool("browser_screenshot")).toBe(true);
      expect(isBrowserScreenshotTool("mcp__omnigent__browser_screenshot")).toBe(true);
      expect(isBrowserScreenshotTool("something__browser_screenshot")).toBe(true);
      expect(isBrowserScreenshotTool("browser_click")).toBe(false);
      expect(isBrowserScreenshotTool("browser_navigate")).toBe(false);
    });
  });

  describe("extractToolImage", () => {
    it("returns null for null, empty, or non-image strings", () => {
      expect(extractToolImage(null)).toBeNull();
      expect(extractToolImage("")).toBeNull();
      expect(extractToolImage("   ")).toBeNull();
      expect(extractToolImage("hello world")).toBeNull();
      expect(extractToolImage('{"error": "Failed to screenshot"}')).toBeNull();
    });

    it("extracts direct data URL strings", () => {
      const dataUrl = "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=";
      const res = extractToolImage(dataUrl);
      expect(res).not.toBeNull();
      expect(res?.src).toBe(dataUrl);
      expect(res?.mimeType).toBe("image/png");
    });

    it("extracts from JSON with data_url field", () => {
      const dataUrl = "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=";
      const json = JSON.stringify({ ok: true, data_url: dataUrl });
      const res = extractToolImage(json);
      expect(res?.src).toBe(dataUrl);
    });

    it("extracts from MCP envelope (__omnigent_mcp_image_result__)", () => {
      const b64 = "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=";
      const json = JSON.stringify({
        __omnigent_mcp_image_result__: 1,
        isError: false,
        content: [
          { type: "text", text: '{"ok": true}' },
          { type: "image", mimeType: "image/png", data: b64 },
        ],
      });
      const res = extractToolImage(json);
      expect(res?.src).toBe(`data:image/png;base64,${b64}`);
      expect(res?.mimeType).toBe("image/png");
    });

    it("extracts from MCP content block array", () => {
      const b64 = "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=";
      const json = JSON.stringify([
        { type: "image", mimeType: "image/jpeg", data: b64 },
      ]);
      const res = extractToolImage(json);
      expect(res?.src).toBe(`data:image/jpeg;base64,${b64}`);
      expect(res?.mimeType).toBe("image/jpeg");
    });

    it("extracts from Omnigent result wrapper with base64 string", () => {
      const b64 = "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=";
      const json = JSON.stringify({ result: b64 });
      const res = extractToolImage(json);
      expect(res?.src).toBe(`data:image/png;base64,${b64}`);
    });

    it("extracts raw base64 string", () => {
      const b64 = "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=";
      const res = extractToolImage(b64);
      expect(res?.src).toBe(`data:image/png;base64,${b64}`);
    });

    it("rejects error results even if other fields are present", () => {
      const json = JSON.stringify({
        ok: false,
        error: "Tab closed",
        data_url: "data:image/png;base64,invalid",
      });
      expect(extractToolImage(json)).toBeNull();
    });
  });
});
