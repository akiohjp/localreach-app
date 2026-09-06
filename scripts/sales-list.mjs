/**
 * LocalReach sales list: every store in the database with its short link, a
 * QR image, contract and AI-draft state, and a ready-to-send message. One
 * self-contained HTML file for Akio to send demos from.
 *
 * Why a generator and not a hand-kept page: the list drifted the moment the
 * links changed (long → short on 2026-09-06). Regenerate instead of editing.
 *
 * Env: NEXT_PUBLIC_SUPABASE_URL + SUPABASE_SERVICE_ROLE_KEY (.env.local).
 *      NEXT_PUBLIC_QR_HOST (default qr.miraireach.ae), NEXT_PUBLIC_APP_URL.
 * Usage: npx tsx scripts/sales-list.mjs [--out=sales-list.html]
 *        then: ~/serve/pin.sh sales-list.html localreach
 */
import fs from "node:fs";
import path from "node:path";
import QRCode from "qrcode";

const arg = (k, d) =>
  (process.argv.find((a) => a.startsWith(`--${k}=`)) ?? "").split("=").slice(1).join("=") || d;

for (const p of [path.resolve(process.cwd(), ".env.local")]) {
  if (!fs.existsSync(p)) continue;
  for (const line of fs.readFileSync(p, "utf8").split(/\r?\n/)) {
    const m = /^([A-Z_]+)=(.*)$/.exec(line);
    if (m) process.env[m[1]] ??= m[2].replace(/^"|"$/g, "");
  }
}
const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!url || !key) {
  console.error("NEXT_PUBLIC_SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY missing (.env.local)");
  process.exit(1);
}
const QR_HOST = (process.env.NEXT_PUBLIC_QR_HOST || "qr.miraireach.ae").trim();
const APP = (process.env.NEXT_PUBLIC_APP_URL || "https://localreach.miraireach.marketing").replace(/\/$/, "");
const OUT = arg("out", "sales-list.html");

/**
 * What the database cannot tell: who the store belongs to on the sales side.
 * Keyed by the English store name. Anything not listed is a demo unless its
 * name says test/QA/demo.
 */
const NOTES = {
  "Let It Dough!": { kind: "client", note: "WAFI Mall。契約中" },
  "Cinar Rugs Dubai": { kind: "client", note: "Cinar 3 店の 1 つ。産地語は絶対禁止、carpet は検索フレーズ内のみ" },
  "Cinar Rugs Istanbul": { kind: "client", note: "Cinar 3 店の 1 つ" },
  "Cinar Rugs Cappadocia": { kind: "client", note: "Cinar 3 店の 1 つ" },
  "mirAIreach": { kind: "own", note: "自社。オーナー返信のデモ用" },
  "RMK Perfumes": { kind: "demo", note: "提案書は送付済み（2026-09-05）。Google の店舗登録なし、投稿先は商品ページ" },
  "YUi": { kind: "demo", owner: "Peter Ahn", note: "FRAME と同オーナー。d3 Building 7" },
  "Selectshop FRAME": { kind: "demo", owner: "Peter Ahn", note: "YUi と同オーナー。FRAME Café（La Cabra）も含む" },
  "Rowley's": { kind: "demo", owner: "Daniel Petermann", note: "DIFC Central Park Towers。Daniel は友人" },
  "Pitfire Pizza": { kind: "demo", note: "JVC" },
  "Maru Udon": { kind: "demo", note: "Business Bay" },
  "Kotobuki Clinic": { kind: "demo", note: "Trade Centre" },
  "1004 Gourmet": { kind: "demo", note: "Deira、Al Ghurair Centre" },
  "Ocha Cafe Sakura": { kind: "demo", note: "Abu Dhabi、The Galleria" },
  "Sushidokoro Tsukasa": { kind: "demo", note: "熊本。日本語店（AI は英語のみ検証済み）" },
  "Sengawa Golf": { kind: "demo", note: "東京。日本語店（AI は英語のみ検証済み）" },
};
const KIND_LABEL = { client: "クライアント", demo: "デモ（見込み客）", own: "自社", test: "テスト" };

const res = await fetch(
  `${url}/rest/v1/stores?select=id,slug,store_name,business_category,entity_area,entity_city,default_language,is_active,subscription_expires_at,ai_review_enabled,google_place_id,google_review_url,keywords,forced_keywords,logo_url,created_at&order=created_at`,
  { headers: { apikey: key, Authorization: `Bearer ${key}` } },
);
if (!res.ok) {
  console.error(`stores: HTTP ${res.status} ${await res.text()}`);
  process.exit(1);
}
const rows = await res.json();

const esc = (s) =>
  String(s ?? "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
const now = Date.now();
const DAY = 86400000;

function kindOf(name) {
  if (NOTES[name]?.kind) return NOTES[name].kind;
  return /test|qa |demo cafe|dubai bar/i.test(name) ? "test" : "demo";
}

function contractCell(s) {
  if (!s.is_active) return `<span class="flag red">停止中（is_active OFF）</span>`;
  if (!s.subscription_expires_at) return `<span class="muted">期限なし</span>`;
  const t = Date.parse(s.subscription_expires_at);
  const d = new Date(t).toLocaleDateString("en-CA", { timeZone: "Asia/Dubai" });
  if (t <= now) return `<span class="flag red">${d} 期限切れ → マスター管理で延長</span>`;
  if (t - now < 30 * DAY) return `<span class="flag amber">${d}（30 日以内）</span>`;
  return `<span>${d}</span>`;
}

function messageFor(s, name) {
  const owner = NOTES[name]?.owner;
  const first = owner ? owner.split(" ")[0] : null;
  const short = `https://${QR_HOST}/${s.slug}`;
  if (s.default_language === "ja") {
    return `${name} 様\nmirAIreach の Akio です。${name} 用に LocalReach のデモを用意しました。\n${short}\nスマホで開いて、星と気に入った点をいくつかタップすると、30 秒ほどで Google レビューの下書きができます。率直な感想を聞かせてください。`;
  }
  return `Hi${first ? ` ${first}` : ""}, Akio here from mirAIreach. I set up a live LocalReach demo for ${name}:\n${short}\nOpen it on your phone, tap a rating and a couple of phrases about the place, and it drafts a Google review in your own words in about 30 seconds. I would love your honest take.`;
}

const groups = { client: [], demo: [], own: [], test: [] };
for (const s of rows) {
  const name = s.store_name?.en ?? Object.values(s.store_name ?? {})[0] ?? "(unnamed)";
  const kind = kindOf(name);
  const live = s.is_active && (!s.subscription_expires_at || Date.parse(s.subscription_expires_at) > now);
  const short = s.slug ? `https://${QR_HOST}/${s.slug}` : null;
  const long = `${APP}/store/${s.id}`;
  const qr = short ? await QRCode.toDataURL(short, { width: 180, margin: 1, errorCorrectionLevel: "M", color: { dark: "#0f172a", light: "#ffffff" } }) : null;
  const msg = short ? messageFor(s, name) : "";
  groups[kind].push({ s, name, kind, live, short, long, qr, msg });
}

function row(r) {
  const { s, name, live, short, long, qr, msg } = r;
  const n = NOTES[name] ?? {};
  const area = [s.entity_area, s.entity_city].filter(Boolean).join(", ");
  const ai = s.ai_review_enabled
    ? `<span class="flag green">ON</span>`
    : `<span class="flag grey">OFF</span><div class="tiny">送る前にマスター管理で ON</div>`;
  const google = s.google_place_id
    ? `<span class="tiny muted">Google 投稿リンクあり</span>`
    : `<span class="tiny amber">Google 投稿リンク未設定</span>`;
  const sendBlock = short
    ? `<div class="msgbox"><textarea readonly rows="4">${esc(msg)}</textarea>
         <div class="btns">
           <a class="btn" target="_blank" rel="noopener" href="https://wa.me/?text=${encodeURIComponent(msg)}">WhatsApp で送る</a>
           <button class="btn ghost" data-copy="${esc(msg)}">文面をコピー</button>
         </div></div>`
    : `<span class="muted">slug なし</span>`;
  return `<tr data-id="${s.id}" class="${live ? "" : "dim"}">
    <td class="name"><strong>${esc(name)}</strong><div class="tiny muted">${esc(s.business_category ?? "")}${area ? " · " + esc(area) : ""}</div>${n.owner ? `<div class="tiny">👤 ${esc(n.owner)}</div>` : ""}${n.note ? `<div class="tiny muted">${esc(n.note)}</div>` : ""}</td>
    <td>${contractCell(s)}<div class="tiny muted">${s.keywords?.length ?? 0} pills / ${s.forced_keywords?.length ?? 0} core${s.logo_url ? " / ロゴあり" : ""}</div>${google}</td>
    <td class="center">${ai}</td>
    <td class="link">${short ? `<a href="${short}" target="_blank" rel="noopener">${esc(QR_HOST)}/${esc(s.slug)}</a>
        <div class="btns"><button class="btn ghost" data-copy="${short}">リンクをコピー</button>
        <a class="btn ghost" download="qr-${esc(s.slug)}.png" href="${qr}">QR を保存</a></div>` : ""}
        <div class="tiny muted">旧リンク: <a href="${long}" target="_blank" rel="noopener">…/store/${s.id.slice(0, 8)}…</a></div></td>
    <td class="qr">${qr ? `<img src="${qr}" width="90" height="90" alt="QR ${esc(name)}">` : ""}</td>
    <td class="send">${sendBlock}</td>
    <td class="track"><label><input type="checkbox" data-sent="${s.id}"> 送信済み</label><input type="text" class="memo" data-memo="${s.id}" placeholder="メモ（この端末に保存）"></td>
  </tr>`;
}

function section(title, list, open = true) {
  if (!list.length) return "";
  return `<details ${open ? "open" : ""}><summary>${title} <span class="count">${list.length}</span></summary>
  <div class="scroll"><table><thead><tr><th>店</th><th>契約 / 設定</th><th>AI Draft</th><th>短縮リンク</th><th>QR</th><th>送信文</th><th>進捗</th></tr></thead>
  <tbody>${list.map(row).join("\n")}</tbody></table></div></details>`;
}

const generated = new Date().toLocaleString("ja-JP", { timeZone: "Asia/Dubai" });
const liveDemos = groups.demo.filter((r) => r.live);
const deadDemos = groups.demo.filter((r) => !r.live);

const html = `<!doctype html>
<html lang="ja">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<meta name="robots" content="noindex">
<title>LocalReach 営業リスト</title>
<style>
  :root { --ink:#0f172a; --muted:#64748b; --line:#e2e8f0; --bg:#f8fafc; --accent:#0f172a; }
  body { margin:0; font-family: -apple-system, "Segoe UI", "Hiragino Sans", "Noto Sans JP", sans-serif; color:var(--ink); background:#fff; }
  header { padding:24px 28px 12px; border-bottom:1px solid var(--line); }
  header h1 { margin:0 0 6px; font-size:20px; }
  header p { margin:4px 0; color:var(--muted); font-size:13px; }
  .rules { display:grid; gap:6px; margin:10px 0 0; padding:12px 16px; background:var(--bg); border:1px solid var(--line); border-radius:12px; font-size:13px; }
  main { padding:12px 28px 48px; }
  details { margin:18px 0; border:1px solid var(--line); border-radius:12px; overflow:hidden; }
  summary { cursor:pointer; padding:12px 16px; font-weight:700; background:var(--bg); }
  .count { display:inline-block; margin-left:6px; padding:0 8px; border-radius:999px; background:#0f172a; color:#fff; font-size:12px; }
  .scroll { overflow-x:auto; }
  table { border-collapse:collapse; width:100%; min-width:1100px; font-size:13px; }
  th { text-align:left; font-size:11px; letter-spacing:.08em; text-transform:uppercase; color:var(--muted); padding:10px 12px; border-bottom:1px solid var(--line); position:sticky; top:0; background:#fff; }
  td { padding:12px; border-bottom:1px solid var(--line); vertical-align:top; }
  tr.dim td { opacity:.6; }
  td.name { min-width:200px; }
  td.center { text-align:center; }
  td.link a { font-family: ui-monospace, Menlo, Consolas, monospace; font-size:13px; }
  td.qr img { display:block; border:1px solid var(--line); border-radius:6px; }
  td.send { min-width:320px; }
  textarea { width:100%; box-sizing:border-box; font:12px/1.5 inherit; border:1px solid var(--line); border-radius:8px; padding:8px; resize:vertical; background:var(--bg); }
  .btns { display:flex; gap:6px; flex-wrap:wrap; margin-top:6px; }
  .btn { display:inline-block; padding:5px 10px; border-radius:8px; background:var(--accent); color:#fff; font-size:12px; font-weight:600; text-decoration:none; border:1px solid var(--accent); cursor:pointer; }
  .btn.ghost { background:#fff; color:var(--ink); border-color:#cbd5e1; }
  .btn.ghost:hover { border-color:#64748b; }
  .flag { display:inline-block; padding:2px 8px; border-radius:999px; font-size:12px; font-weight:600; }
  .flag.green { background:#dcfce7; color:#166534; } .flag.grey { background:#f1f5f9; color:#475569; }
  .flag.red { background:#fee2e2; color:#991b1b; } .flag.amber { background:#fef3c7; color:#92400e; }
  .amber { color:#92400e; } .muted { color:var(--muted); } .tiny { font-size:11px; margin-top:3px; }
  td.track { min-width:170px; } td.track label { display:block; font-size:12px; margin-bottom:6px; }
  input.memo { width:100%; box-sizing:border-box; font:12px inherit; border:1px solid var(--line); border-radius:8px; padding:6px; }
  .toast { position:fixed; bottom:20px; left:50%; transform:translateX(-50%); background:#0f172a; color:#fff; padding:8px 14px; border-radius:999px; font-size:13px; opacity:0; transition:opacity .2s; pointer-events:none; }
  .toast.show { opacity:1; }
</style>
</head>
<body>
<header>
  <h1>LocalReach 営業リスト</h1>
  <p>生成: ${esc(generated)}（Dubai）・短縮リンクは <strong>${esc(QR_HOST)}</strong>・旧リンク <code>/store/&lt;id&gt;</code> も永久に有効</p>
  <div class="rules">
    <div><strong>送る前に</strong>: その店の <strong>AI Draft が ON</strong> か（OFF なら <a href="${APP}/master-admin" target="_blank" rel="noopener">マスター管理</a> で ON）、<strong>契約終了日</strong>が切れていないか（切れていると QR は Service Inactive に飛ぶ）。</div>
    <div><strong>文面</strong>は 1 店ずつ違う内容にしてあります。WhatsApp ボタンで送る相手を選ぶだけです。相手の名前が分かっている店は入っています。</div>
    <div><strong>更新</strong>: クローンで <code>npm run sales:list</code> → <code>~/serve/pin.sh sales-list.html localreach</code>。「送信済み」とメモはこの端末のブラウザにだけ保存されます。</div>
  </div>
</header>
<main>
${section("デモ（見込み客・稼働中）", liveDemos)}
${section("クライアント", groups.client)}
${section("デモ（期限切れ・停止中）", deadDemos, false)}
${section("自社", groups.own, false)}
${section("テスト用", groups.test, false)}
</main>
<div class="toast" id="toast">コピーしました</div>
<script>
(function () {
  var toast = document.getElementById('toast'); var timer;
  function say(t) { toast.textContent = t; toast.classList.add('show'); clearTimeout(timer); timer = setTimeout(function(){ toast.classList.remove('show'); }, 1400); }
  document.addEventListener('click', function (e) {
    var b = e.target.closest('[data-copy]'); if (!b) return;
    var text = b.getAttribute('data-copy');
    (navigator.clipboard ? navigator.clipboard.writeText(text) : Promise.reject()).then(function(){ say('コピーしました'); }, function(){ window.prompt('コピーしてください', text); });
  });
  var KEY = 'localreach-sales-list';
  var state = {}; try { state = JSON.parse(localStorage.getItem(KEY) || '{}'); } catch (e) {}
  document.querySelectorAll('[data-sent]').forEach(function (cb) {
    var id = cb.getAttribute('data-sent'); cb.checked = !!(state[id] && state[id].sent);
    cb.addEventListener('change', function () { state[id] = state[id] || {}; state[id].sent = cb.checked; try { localStorage.setItem(KEY, JSON.stringify(state)); } catch (e) {} });
  });
  document.querySelectorAll('[data-memo]').forEach(function (inp) {
    var id = inp.getAttribute('data-memo'); inp.value = (state[id] && state[id].memo) || '';
    inp.addEventListener('change', function () { state[id] = state[id] || {}; state[id].memo = inp.value; try { localStorage.setItem(KEY, JSON.stringify(state)); } catch (e) {} });
  });
})();
</script>
</body>
</html>
`;

fs.writeFileSync(OUT, html);
console.log(`wrote ${OUT}: ${rows.length} stores (demo live ${liveDemos.length}, client ${groups.client.length}, demo expired ${deadDemos.length}, own ${groups.own.length}, test ${groups.test.length})`);
