import type { AssistantInput, Message } from "../types/domain";

export type AssistantImage = { dataUrl: string; name: string };
export const MAX_UPLOAD_BYTES = 8 * 1024 * 1024;
export const MAX_IMAGE_BYTES = 1_572_864;
const attachments = new WeakMap<Message, AssistantImage>();

// Image bytes are deliberately outside BookingState/localStorage.
export function attachImage(message: Message, image: AssistantImage) {
  attachments.set(message, image);
  message.imageCount = 1;
}
export function messageImage(message: Message) {
  return attachments.get(message);
}

export function assistantHistory(history: Message[]): AssistantInput["messages"] {
  let imageCount = 0;
  const messages = history.filter((m) => m.text && !m.key && !m.failed).slice(-16)
    .map((m) => ({ message: m, role: m.role, content: m.text }));
  const result = messages.reverse().map(({ message, role, content }) => {
    const image = messageImage(message);
    if (image && imageCount < 3) {
      imageCount++;
      return { role, content, images: [image.dataUrl] };
    }
    return { role, content: content + (message.imageCount
      ? "\n[Earlier image unavailable. Do not claim to see it; request re-upload if needed.]" : "") };
  }).reverse();
  while (result.length > 1 && result.reduce((n, m) => n + m.content.length, 0) > 40000) result.shift();
  return result;
}

export async function prepareAssistantImage(file: File): Promise<AssistantImage> {
  if (!["image/jpeg", "image/png", "image/webp"].includes(file.type)) throw Error("agent.imageType");
  if (!file.size || file.size > MAX_UPLOAD_BYTES) throw Error("agent.imageSize");
  const url = URL.createObjectURL(file);
  try {
    const image = new Image();
    image.src = url;
    await image.decode();
    if (!image.naturalWidth || !image.naturalHeight || image.naturalWidth * image.naturalHeight > 40_000_000)
      throw Error("agent.imageSize");
    const scale = Math.min(1, 1600 / Math.max(image.naturalWidth, image.naturalHeight));
    const canvas = document.createElement("canvas");
    canvas.width = Math.max(1, Math.round(image.naturalWidth * scale));
    canvas.height = Math.max(1, Math.round(image.naturalHeight * scale));
    const ctx = canvas.getContext("2d");
    if (!ctx) throw Error("agent.imageRead");
    // Re-encoding strips EXIF/GPS metadata and flattens transparency on white.
    ctx.fillStyle = "#fff";
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.drawImage(image, 0, 0, canvas.width, canvas.height);
    let dataUrl = canvas.toDataURL("image/jpeg", 0.85);
    if (dataUrl.length > MAX_IMAGE_BYTES * 4 / 3) dataUrl = canvas.toDataURL("image/jpeg", 0.65);
    if (dataUrl.length > MAX_IMAGE_BYTES * 4 / 3) throw Error("agent.imageSize");
    return { dataUrl, name: file.name.slice(0, 200) };
  } finally {
    URL.revokeObjectURL(url);
  }
}
