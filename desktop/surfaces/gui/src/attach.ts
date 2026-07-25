import type { Attachment } from "./types";

const MAX_BYTES = 10 * 1024 * 1024; // skip files larger than ~10MB
const TEXT_RE =
  /\.(txt|md|markdown|csv|tsv|json|ya?ml|log|ini|toml|py|js|ts|tsx|jsx|rs|go|java|c|h|cpp|sh|html?|css|sql|xml)$/i;

// Read a File into an Attachment (image/PDF → data URL, text → inline text). Returns null for
// unsupported types or oversized files. Shared by the composer and the session start panel.
export const isPdfFile = (file: File) =>
  file.type === "application/pdf" || /\.pdf$/i.test(file.name);

export function readFile(file: File): Promise<Attachment | null> {
  const isImage = file.type.startsWith("image/");
  const isPdf = isPdfFile(file);
  const isText = !isPdf && (file.type.startsWith("text/") || TEXT_RE.test(file.name));
  if ((!isImage && !isPdf && !isText) || file.size > MAX_BYTES) return Promise.resolve(null);
  return new Promise((resolve) => {
    const reader = new FileReader();
    reader.onerror = () => resolve(null);
    reader.onload = () =>
      resolve(
        isImage
          ? { kind: "image", name: file.name || "image", mime: file.type, data_url: String(reader.result) }
          : isPdf
            ? { kind: "pdf", name: file.name || "file.pdf", mime: "application/pdf", data_url: String(reader.result) }
            : { kind: "text", name: file.name || "file.txt", mime: file.type, text: String(reader.result) },
      );
    if (isImage || isPdf) reader.readAsDataURL(file);
    else reader.readAsText(file);
  });
}
