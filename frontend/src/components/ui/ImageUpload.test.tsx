import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { useState } from "react";
import { ImageUpload } from "./ImageUpload";

const error = vi.fn();
vi.mock("@/contexts/ToastContext", () => ({ useToast: () => ({ error }) }));

function Draft({ initial = "/images/old.jpg" }: { initial?: string }) {
  const [file, setFile] = useState<File | null>(null);
  const [value, setValue] = useState(initial);
  return <ImageUpload value={value} file={file} onFileChange={setFile} onChange={setValue} />;
}

beforeEach(() => {
  Object.defineProperty(URL, "createObjectURL", { configurable: true, value: vi.fn(() => "blob:local-preview") });
  Object.defineProperty(URL, "revokeObjectURL", { configurable: true, value: vi.fn() });
  error.mockClear();
});
afterEach(cleanup);

describe("ImageUpload", () => {
  it("previews a controlled file locally, offers visible replace/remove, and revokes its URL on removal", async () => {
    render(<Draft />);
    const input = document.querySelector<HTMLInputElement>('input[type="file"]')!;
    expect(screen.getByRole("img", { name: "Preview" })).toHaveAttribute("src", expect.stringContaining("old.jpg"));
    fireEvent.change(input, { target: { files: [new File(["photo"], "new.png", { type: "image/png" })] } });
    await waitFor(() => expect(screen.getByRole("img", { name: "Preview" })).toHaveAttribute("src", "blob:local-preview"));
    expect(screen.getByRole("button", { name: "Cambiar" })).toBeVisible();
    expect(screen.getByRole("button", { name: "Eliminar" })).toBeVisible();
    fireEvent.click(screen.getByRole("button", { name: "Eliminar" }));
    expect(screen.queryByRole("img", { name: "Preview" })).not.toBeInTheDocument();
    expect(URL.revokeObjectURL).toHaveBeenCalledWith("blob:local-preview");
  });

  it("rejects invalid controlled selections without replacing the existing image", () => {
    render(<Draft />);
    const input = document.querySelector<HTMLInputElement>('input[type="file"]')!;
    fireEvent.change(input, { target: { files: [new File(["text"], "note.txt", { type: "text/plain" })] } });
    expect(error).toHaveBeenCalledOnce();
    expect(screen.getByRole("img", { name: "Preview" })).toHaveAttribute("src", expect.stringContaining("old.jpg"));
    expect(URL.createObjectURL).not.toHaveBeenCalled();
  });

  it("preserves the immediate upload callback for expense receipts", async () => {
    const upload = vi.fn().mockResolvedValue("/receipts/new.jpg");
    const change = vi.fn();
    render(<ImageUpload value="/receipts/old.jpg" onChange={change} onUpload={upload} />);
    const file = new File(["photo"], "receipt.png", { type: "image/png" });
    fireEvent.change(document.querySelector<HTMLInputElement>('input[type="file"]')!, { target: { files: [file] } });
    await waitFor(() => expect(change).toHaveBeenCalledWith("/receipts/new.jpg"));
    expect(upload).toHaveBeenCalledWith(file);
    expect(screen.getByRole("button", { name: "Cambiar" })).toBeInTheDocument();
  });
});
