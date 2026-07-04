import QRCode from "qrcode";

/**
 * Render a QR code to a self-contained PNG data URL, on the server.
 *
 * Replaces the previous api.qrserver.com dependency: the customer-facing store
 * URL (which embeds the store id) is no longer sent to a third party on every
 * dashboard/demo render, and the QR keeps working if that service is down.
 * Call this only from server components / server code — it uses the Node build
 * of `qrcode` and must not be bundled into the client.
 */
export async function qrPngDataUrl(text: string, size = 320): Promise<string> {
  return QRCode.toDataURL(text, {
    width: size,
    margin: 1,
    errorCorrectionLevel: "M",
    color: { dark: "#0f172a", light: "#ffffff" },
  });
}
