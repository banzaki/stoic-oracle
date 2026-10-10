/**
 * Draws one reply as a portrait-format image card (1080 × 1350) entirely in the browser,
 * in the site's colours and fonts, labelled as an AI portrayal. No server or model call.
 */

const W = 1080;
const H = 1350;
const MARGIN = 96;
const COLORS = { night: "#0d0b09", umber: "#17130f", parchment: "#ece4d4", stone: "#b2a792", dust: "#8c8273", gold: "#c9a96e" };

/** The font families next/font registered for the page, read from the CSS variables. */
function family(variable: string, fallback: string): string {
  const value = getComputedStyle(document.documentElement).getPropertyValue(variable).trim();
  return value || fallback;
}

function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const image = new Image();
    image.onload = () => resolve(image);
    image.onerror = reject;
    image.src = src;
  });
}

/** Breaks `text` into lines no wider than `width`, keeping paragraph breaks as empty lines. */
function wrap(ctx: CanvasRenderingContext2D, text: string, width: number): string[] {
  const lines: string[] = [];
  text.split(/\n{2,}/).forEach((paragraph, i) => {
    if (i > 0) lines.push("");
    let line = "";
    for (const word of paragraph.split(/\s+/).filter(Boolean)) {
      const next = line ? `${line} ${word}` : word;
      if (ctx.measureText(next).width > width && line) {
        lines.push(line);
        line = word;
      } else {
        line = next;
      }
    }
    if (line) lines.push(line);
  });
  return lines;
}

export async function renderReplyCard(options: {
  name: string;
  subtitle: string;
  portrait: string;
  text: string;
}): Promise<Blob> {
  await document.fonts.ready;
  const canvas = document.createElement("canvas");
  canvas.width = W;
  canvas.height = H;
  const ctx = canvas.getContext("2d")!;
  const display = family("--font-cormorant", "Georgia");
  const serif = family("--font-garamond", "Georgia");
  const sans = family("--font-geist-sans", "system-ui");

  // Background: night with a soft gold glow from the top, and a thin gold frame.
  ctx.fillStyle = COLORS.night;
  ctx.fillRect(0, 0, W, H);
  const glow = ctx.createRadialGradient(W / 2, -100, 50, W / 2, -100, 900);
  glow.addColorStop(0, "rgba(201,169,110,0.20)");
  glow.addColorStop(1, "rgba(201,169,110,0)");
  ctx.fillStyle = glow;
  ctx.fillRect(0, 0, W, H);
  ctx.strokeStyle = "rgba(201,169,110,0.35)";
  ctx.lineWidth = 2;
  ctx.strokeRect(36, 36, W - 72, H - 72);

  // Portrait in a gold ring.
  const image = await loadImage(options.portrait);
  const r = 84;
  const cx = W / 2;
  const cy = 96 + r;
  ctx.save();
  ctx.beginPath();
  ctx.arc(cx, cy, r, 0, Math.PI * 2);
  ctx.clip();
  ctx.drawImage(image, cx - r, cy - r, r * 2, r * 2);
  ctx.restore();
  ctx.beginPath();
  ctx.arc(cx, cy, r + 3, 0, Math.PI * 2);
  ctx.strokeStyle = "rgba(201,169,110,0.7)";
  ctx.lineWidth = 3;
  ctx.stroke();

  ctx.textAlign = "center";
  ctx.fillStyle = COLORS.gold;
  ctx.font = `500 64px ${display}`;
  ctx.fillText(options.name.toUpperCase(), cx, cy + r + 84);
  ctx.fillStyle = COLORS.stone;
  ctx.font = `400 22px ${sans}`;
  ctx.fillText(options.subtitle.toUpperCase().split("").join(String.fromCharCode(8202)), cx, cy + r + 124);

  // Divider.
  const dividerY = cy + r + 168;
  const line = ctx.createLinearGradient(MARGIN, 0, W - MARGIN, 0);
  line.addColorStop(0, "rgba(201,169,110,0)");
  line.addColorStop(0.5, "rgba(201,169,110,0.6)");
  line.addColorStop(1, "rgba(201,169,110,0)");
  ctx.fillStyle = line;
  ctx.fillRect(MARGIN, dividerY, W - MARGIN * 2, 1);

  // Body text: the largest size that fits; past the smallest, cut with an ellipsis.
  const top = dividerY + 64;
  const bottom = H - 150;
  ctx.textAlign = "left";
  let size = 40;
  let lines: string[] = [];
  for (; size >= 28; size -= 2) {
    ctx.font = `400 ${size}px ${serif}`;
    lines = wrap(ctx, options.text, W - MARGIN * 2);
    if (lines.length * size * 1.45 <= bottom - top) break;
  }
  const lineHeight = size * 1.45;
  const maxLines = Math.floor((bottom - top) / lineHeight);
  if (lines.length > maxLines) {
    lines = lines.slice(0, maxLines);
    while (lines.at(-1) === "") lines.pop();
    lines[lines.length - 1] = `${lines[lines.length - 1].replace(/[\s,;:.—-]*\S*$/, "")} …`;
  }
  ctx.fillStyle = COLORS.parchment;
  lines.forEach((text, i) => ctx.fillText(text, MARGIN, top + i * lineHeight + size));

  // Footer.
  ctx.textAlign = "center";
  ctx.fillStyle = COLORS.gold;
  ctx.font = `500 30px ${display}`;
  ctx.fillText("Stoic Oracle", cx, H - 92);
  ctx.fillStyle = COLORS.dust;
  ctx.font = `400 20px ${sans}`;
  ctx.fillText("AI portrayal grounded in the philosopher's own writings", cx, H - 60);

  return new Promise((resolve, reject) =>
    canvas.toBlob((blob) => (blob ? resolve(blob) : reject(new Error("Could not draw the card."))), "image/png"),
  );
}

/** Shares the card with the system share sheet where files can be shared (phones), else downloads it. */
export async function shareOrDownload(blob: Blob, fileName: string, title: string) {
  const file = new File([blob], fileName, { type: "image/png" });
  if (typeof navigator.canShare === "function" && navigator.canShare({ files: [file] })) {
    try {
      await navigator.share({ files: [file], title });
      return;
    } catch (error) {
      if ((error as Error).name === "AbortError") return; // the visitor closed the share sheet
    }
  }
  const { downloadFile } = await import("./export");
  downloadFile(fileName, blob);
}
