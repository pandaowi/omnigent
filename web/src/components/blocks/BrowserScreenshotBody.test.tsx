import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { BrowserScreenshotBody } from "./BrowserScreenshotBody";

afterEach(cleanup);

describe("BrowserScreenshotBody", () => {
  it("renders an image when output is a data URL", () => {
    const dataUrl =
      "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=";
    render(
      <BrowserScreenshotBody
        call={{
          name: "browser_screenshot",
          args: {},
          output: dataUrl,
          state: "output-available",
        }}
      />,
    );

    const img = screen.getByRole("img", { name: "Browser screenshot" });
    expect(img).toBeInTheDocument();
    expect(img).toHaveAttribute("src", dataUrl);
    expect(screen.getByText("Click image to zoom")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Download screenshot" })).toBeInTheDocument();
  });

  it("renders an image from MCP envelope JSON", () => {
    const b64 =
      "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=";
    const json = JSON.stringify({
      __omnigent_mcp_image_result__: 1,
      isError: false,
      content: [
        { type: "text", text: '{"ok": true}' },
        { type: "image", mimeType: "image/png", data: b64 },
      ],
    });

    render(
      <BrowserScreenshotBody
        call={{
          name: "browser_screenshot",
          args: {},
          output: json,
          state: "output-available",
        }}
      />,
    );

    const img = screen.getByRole("img", { name: "Browser screenshot" });
    expect(img).toHaveAttribute("src", `data:image/png;base64,${b64}`);
  });

  it("renders an error message when output is an error", () => {
    render(
      <BrowserScreenshotBody
        call={{
          name: "browser_screenshot",
          args: {},
          output: JSON.stringify({ error: "Failed to capture window" }),
          state: "output-available",
        }}
      />,
    );

    expect(screen.getByTestId("tool-error-box")).toHaveTextContent("Failed to capture window");
  });

  it("triggers download when clicking download button", () => {
    const dataUrl =
      "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=";
    render(
      <BrowserScreenshotBody
        call={{
          name: "browser_screenshot",
          args: {},
          output: dataUrl,
          state: "output-available",
        }}
      />,
    );

    const clickSpy = vi.spyOn(HTMLAnchorElement.prototype, "click").mockImplementation(() => {});
    const downloadBtn = screen.getByRole("button", { name: "Download screenshot" });
    fireEvent.click(downloadBtn);
    expect(clickSpy).toHaveBeenCalled();
    clickSpy.mockRestore();
  });

  it("returns null when output is null and call is pending", () => {
    const { container } = render(
      <BrowserScreenshotBody
        call={{
          name: "browser_screenshot",
          args: {},
          output: null,
          state: "input-available",
        }}
      />,
    );

    expect(container.firstChild).toBeNull();
  });
});
