import { ChatMedia } from "@/types/collab";

const SAFE_TAGS = new Set([
  "b",
  "strong",
  "i",
  "em",
  "u",
  "s",
  "strike",
  "span",
  "div",
  "p",
  "br",
  "ul",
  "ol",
  "li",
  "code",
  "pre",
  "a",
]);

const SAFE_STYLE_PROPERTIES = new Set([
  "color",
  "background-color",
  "font-weight",
  "font-style",
  "text-decoration",
  "text-decoration-line",
  "font-family",
  "font-size",
]);

export const getMediaKind = (mimeType: string): ChatMedia["kind"] => {
  if (mimeType.startsWith("image/")) return "image";
  if (mimeType.startsWith("video/")) return "video";
  if (mimeType.startsWith("audio/")) return "audio";
  return "file";
};

export const fileToMedia = (file: File): Promise<ChatMedia> =>
  new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(new Error(`Failed to read ${file.name}`));
    reader.onload = () => {
      resolve({
        id: crypto.randomUUID(),
        name: file.name,
        type: file.type || "application/octet-stream",
        size: file.size,
        url: typeof reader.result === "string" ? reader.result : "",
        kind: getMediaKind(file.type || "application/octet-stream"),
      });
    };
    reader.readAsDataURL(file);
  });

export const filesToMedia = async (files: File[]) => Promise.all(files.map(fileToMedia));

const sanitizeStyleValue = (value: string) => {
  const trimmed = value.trim();
  if (!trimmed) return "";
  if (/url\s*\(/i.test(trimmed) || /expression\s*\(/i.test(trimmed)) return "";
  return trimmed;
};

export const sanitizeRichTextHtml = (html: string) => {
  if (typeof window === "undefined") return html;

  const parser = new DOMParser();
  const doc = parser.parseFromString(html, "text/html");

  const walk = (root: ParentNode) => {
    const elements = Array.from(root.querySelectorAll("*"));
    elements.forEach((element) => {
      const tag = element.tagName.toLowerCase();
      if (!SAFE_TAGS.has(tag)) {
        const replacement = document.createTextNode(element.textContent ?? "");
        element.replaceWith(replacement);
        return;
      }

      Array.from(element.attributes).forEach((attribute) => {
        const name = attribute.name.toLowerCase();
        if (name.startsWith("on")) {
          element.removeAttribute(attribute.name);
          return;
        }

        if (name === "style") {
          const styleParts = attribute.value
            .split(";")
            .map((part) => part.trim())
            .filter(Boolean)
            .map((part) => part.split(":"))
            .filter(([property, value]) => property && value)
            .map(([property, value]) => [property.trim().toLowerCase(), sanitizeStyleValue(value.join(":"))] as const)
            .filter(([property, value]) => SAFE_STYLE_PROPERTIES.has(property) && value);

          if (styleParts.length === 0) {
            element.removeAttribute(attribute.name);
          } else {
            element.setAttribute(
              "style",
              styleParts.map(([property, value]) => `${property}: ${value}`).join("; ")
            );
          }
          return;
        }

        if (name === "href") {
          const value = attribute.value.trim();
          if (/^javascript:/i.test(value)) {
            element.removeAttribute(attribute.name);
          }
          return;
        }

        if (name !== "href" && name !== "target" && name !== "rel") {
          element.removeAttribute(attribute.name);
        }
      });

      if (tag === "a") {
        const href = element.getAttribute("href") ?? "";
        if (href) {
          element.setAttribute("target", "_blank");
          element.setAttribute("rel", "noreferrer noopener");
        }
      }
    });
  };

  walk(doc.body);
  return doc.body.innerHTML;
};

export const htmlToPlainText = (html: string) => {
  if (typeof window === "undefined") return html;
  const parser = new DOMParser();
  const doc = parser.parseFromString(html, "text/html");
  return (doc.body.textContent ?? "").replace(/\s+\n/g, "\n").trim();
};
