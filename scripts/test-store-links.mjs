/**
 * Unit checks for the guest link builder and the short-host routing helpers
 * (lib/store-links.ts). No network, no keys. Runs inside `npm run audit:all`.
 *
 * Usage: npx tsx scripts/test-store-links.mjs
 */
import assert from "node:assert/strict";

const { SLUG_RE, SLUG_PATH_RE, qrHost, isQrHost, guestReviewUrl } = await import("../lib/store-links.ts");

let passed = 0;
function t(name, fn) {
  fn();
  passed++;
  console.log(`  ok  ${name}`);
}

const APP = "https://localreach.miraireach.marketing";
const STORE = { id: "c0fc7e45-4d1e-430c-8976-71b5016551ae", slug: "x7kp2m" };

t("slug: six characters from the unambiguous alphabet only", () => {
  assert.ok(SLUG_RE.test("x7kp2m"));
  assert.ok(!SLUG_RE.test("x7kp2"));
  assert.ok(!SLUG_RE.test("x7kp2M"));
  assert.ok(!SLUG_RE.test("0oil1a"));
  assert.equal(SLUG_PATH_RE.exec("/x7kp2m")?.[1], "x7kp2m");
  assert.equal(SLUG_PATH_RE.exec("/x7kp2m/")?.[1], "x7kp2m");
  assert.equal(SLUG_PATH_RE.exec("/store/x7kp2m"), null);
  assert.equal(SLUG_PATH_RE.exec("/admin"), null);
});

t("qrHost: normalised from the env, null when unset", () => {
  assert.equal(qrHost({}), null);
  assert.equal(qrHost({ NEXT_PUBLIC_QR_HOST: "" }), null);
  assert.equal(qrHost({ NEXT_PUBLIC_QR_HOST: "qr.miraireach.ae" }), "qr.miraireach.ae");
  assert.equal(qrHost({ NEXT_PUBLIC_QR_HOST: " https://QR.miraireach.ae/ " }), "qr.miraireach.ae");
  assert.equal(isQrHost("qr.miraireach.ae", { NEXT_PUBLIC_QR_HOST: "qr.miraireach.ae" }), true);
  assert.equal(isQrHost("QR.miraireach.ae:443", { NEXT_PUBLIC_QR_HOST: "qr.miraireach.ae" }), true);
  assert.equal(isQrHost("localreach.miraireach.marketing", { NEXT_PUBLIC_QR_HOST: "qr.miraireach.ae" }), false);
  assert.equal(isQrHost("qr.miraireach.ae", {}), false);
});

t("guestReviewUrl: short when host and slug exist, long otherwise", () => {
  assert.equal(guestReviewUrl(STORE, APP, { NEXT_PUBLIC_QR_HOST: "qr.miraireach.ae" }), "https://qr.miraireach.ae/x7kp2m");
  assert.equal(guestReviewUrl(STORE, APP, {}), `${APP}/store/${STORE.id}`);
  assert.equal(guestReviewUrl({ id: STORE.id, slug: null }, APP, { NEXT_PUBLIC_QR_HOST: "qr.miraireach.ae" }), `${APP}/store/${STORE.id}`);
  assert.equal(guestReviewUrl({ id: STORE.id, slug: "BAD" }, `${APP}/`, { NEXT_PUBLIC_QR_HOST: "qr.miraireach.ae" }), `${APP}/store/${STORE.id}`);
});

console.log(`\nstore links: ${passed} checks passed`);
