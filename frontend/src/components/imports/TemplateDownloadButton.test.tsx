import { describe, it, expect, vi } from "vitest";
import { fireEvent, render, screen } from "@testing-library/react";
import { TemplateDownloadButton } from "./TemplateDownloadButton";

describe("TemplateDownloadButton", () => {
  it("renders a plantilla download button", () => {
    render(<TemplateDownloadButton onDownload={vi.fn()} />);

    expect(screen.getByRole("button", { name: /Plantilla/i })).toBeInTheDocument();
  });

  it("calls onDownload when clicked", () => {
    const onDownload = vi.fn();
    render(<TemplateDownloadButton onDownload={onDownload} />);

    fireEvent.click(screen.getByRole("button", { name: /Plantilla/i }));
    expect(onDownload).toHaveBeenCalledOnce();
  });

  it("disables the button while download is loading", () => {
    render(<TemplateDownloadButton onDownload={vi.fn()} loading />);

    expect(screen.getByRole("button", { name: /Plantilla/i })).toBeDisabled();
  });
});
