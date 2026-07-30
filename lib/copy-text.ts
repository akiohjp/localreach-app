/**
 * Clipboard copy with a legacy fallback.
 *
 * QR scans routinely open inside Instagram/Facebook/LINE in-app webviews and
 * older iOS Safari, where `navigator.clipboard.writeText` rejects. A hidden
 * textarea + execCommand('copy') still works there. Must run inside the user
 * gesture that triggered it.
 */

function execCommandCopy(value: string): boolean {
  try {
    const ta = document.createElement("textarea");
    ta.value = value;
    ta.setAttribute("readonly", "");
    ta.style.position = "fixed";
    ta.style.left = "-9999px";
    document.body.appendChild(ta);
    ta.select();
    ta.setSelectionRange(0, value.length);
    const ok = document.execCommand("copy");
    document.body.removeChild(ta);
    return ok;
  } catch {
    return false;
  }
}

export async function copyToClipboard(value: string): Promise<boolean> {
  try {
    await navigator.clipboard.writeText(value);
    return true;
  } catch {
    return execCommandCopy(value);
  }
}

/** A usable Google review target = absolute http(s) URL. */
export function isUsableReviewUrl(url: string | null | undefined): boolean {
  return /^https?:\/\/.+/i.test((url ?? "").trim());
}
