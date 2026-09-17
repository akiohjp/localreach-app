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
  "YUi": { kind: "demo", friend: true, owner: "Peter Ahn", note: "FRAME と同オーナー。d3 Building 7" },
  "Selectshop FRAME": { kind: "demo", friend: true, owner: "Peter Ahn", note: "YUi と同オーナー。FRAME Café（La Cabra）も含む" },
  "Rowley's": { kind: "demo", friend: true, owner: "Daniel Petermann", note: "DIFC Central Park Towers。Daniel は友人" },
  "Pitfire Pizza": { kind: "demo", pitchedBefore: true, note: "JVC" },
  "Maru Udon": { kind: "demo", pitchedBefore: true, lang: "ja", message: "お世話になっております。ご無沙汰しております。\n\n以前ご紹介させていただいたシステムとは別に、Google レビューに絞った機能を単体でリリースいたしました。\n\nBusiness Bay 店でセットアップまで済ませてありますので、お試しでお使いいただけたら幸いです。\n\nお客様がスマホで QR を読み取り、星とよかった点をいくつかタップすると、30 秒ほどでご本人の言葉のレビューが出来上がります。文章はその場で直していただけますし、投稿されるのはお客様ご自身です。見返りは何もお渡ししないので、Google のルールの中に収まっています。\n\nやることはそれだけです。よかったと思ってくださった方が、思っただけで終わらずに実際に残してくださる。その部分だけを担当します。\n\n料金は月々 AED 298、3 ヶ月分を先にお預かりする形で、これ以外の費用はございません。以前のご提案とは別物で、あの中の 1 機能だけを切り出したものになります。\n\n一度お手元で触っていただいて、率直なところをお聞かせいただけたら嬉しいです。\n{link}", note: "Business Bay" },
  "Kotobuki Clinic": { kind: "demo", note: "Trade Centre" },
  "1004 Gourmet": { kind: "demo", pitchedBefore: true, note: "Deira、Al Ghurair Centre" },
  "Ocha Cafe Sakura": { kind: "demo", note: "Abu Dhabi、The Galleria" },
  "Sushidokoro Tsukasa": { kind: "demo", noPrice: true, note: "熊本。日本語店（AI は英語のみ検証済み）" },
  "Sengawa Golf": { kind: "demo", noPrice: true, note: "東京。日本語店（AI は英語のみ検証済み）" },
  "tashas Aljada": { kind: "demo", note: "Aljada, Sharjah。Google ボタンは本物のリスティングに向けてある。本番として営業する（Akio 2026-09-14）" },
  "Real Choice Real Estate Brokers": { kind: "demo", note: "Trade Center First。AI Visibility Scorecard 送付済み（2026-09-11）" },
  "The Char'd Club": { kind: "demo", note: "Aljada, Sharjah。デモキット＋ピッチノート済み（2026-09-12）。place_id は契約まで入れない" },
  "Kimura-ya Al Jaddaf": { kind: "demo", note: "Al Jaddaf。デモキット＋ピッチノート済み（2026-09-12）" },
  "Koi Water Barn Dubai": { kind: "demo", note: "Sheikh Zayed Road。デモキット済み、送る文面は serve の koi-water-barn-message.html（2026-09-13）" },
  "Trifid Media": { kind: "demo", friend: true, free: true, owner: "Mahdi", note: "Al Quoz。AED 1,000 前払い済みのため LocalReach は無償。文面は serve の trifid-media-message.html（2026-09-13）" },
  "Marina Estates": { kind: "test", note: "不動産向けの汎用デモ（架空店）。実在の listing には投稿されない" },
  "Demo — Marina Table": { kind: "test", note: "飲食向けの汎用デモ（架空店）。実在の listing には投稿されない" },
  "Prime Gourmet Dubai Creek Harbour": { kind: "demo", friend: true, owner: "Maria（GM）", shortName: "Prime Gourmet", message: "Hi Maria, how have you been?\n\nThis is my own business, and I have already set it up for the new Creek Harbour store, so I am just sending it over.\n\nA customer scans the QR on their phone, taps a rating and a few things they liked (the Japanese A5 Wagyu, the Black Angus, the dry aged beef), and about thirty seconds later a full review is written in their own words. They post it themselves on Google. Nothing is offered in exchange, so it stays inside Google's rules.\n\nCreek Harbour has one review on it right now, so it seemed like the right store to try this on. Have a go on your phone:\n{link}\n\nNothing to sign and no rush. Just tell me if it is any good.", note: "UAE 15 店舗。Creek Harbour は新店で星 5.0 / レビュー 1 件。1 店決まれば横展開できる（2026-09-14）" },
  "Summit Hinomaru Shokudo": { kind: "demo", friend: true, lang: "ja", owner: "松村", shortName: "日の丸食堂", message: "お世話になっております。ご無沙汰しております。\n\nこのたび、Google レビューに絞った仕組みを単体でリリースいたしました。\n\n日の丸食堂さんの内容を入れてセットアップまで済ませてありますので、お試しでお使いいただけたら幸いです。QR を印刷してレジや卓上に置いていただくだけで動きます。\n\nお客様がスマホで QR を読み取り、星とよかった点をいくつかタップすると、30 秒ほどでご本人の言葉のレビューが出来上がります。文章はその場で直していただけますし、投稿されるのはお客様ご自身です。見返りは何もお渡ししないので、Google のルールの中に収まっています。\n\nやることはそれだけです。よかったと思ってくださった方が、思っただけで終わらずに実際に残してくださる。その部分だけを担当します。\n\n料金は月々 AED 298、3 ヶ月分を先にお預かりする形で、これ以外の費用はございません。\n\n一度お手元で触っていただいて、率直なところをお聞かせいただけたら嬉しいです。\n{link}", note: "Summit Trading グループの実店舗。アブダビ担当の松村さんに直接連絡（元 Summit の担当者なので話が早い）。Electra Street, Al Markaziya、星 4.7 / 67 件（2026-09-14）" },
  "Summit Trading": { kind: "demo", friend: true, lang: "ja", owner: "松崎", message: "お世話になっております。ご無沙汰しております。\n\nこのたび、Google レビューに絞った仕組みを単体でリリースいたしました。\n\nサミット・トレーディング様の内容を入れてセットアップまで済ませてありますので、お試しでお使いいただけたら幸いです。\n\nお取引先の方にリンクをお送りいただくと、スマホで星とよかった点をいくつかタップするだけで、30 秒ほどでご本人の言葉のレビューが出来上がります。文章はその場で直していただけますし、投稿されるのはご本人です。見返りは何もお渡ししないので、Google のルールの中に収まっています。\n\nやることはそれだけです。よかったと思ってくださった取引先の方が、思っただけで終わらずに実際に残してくださる。その部分だけを担当します。\n\n料金は月々 AED 298、3 ヶ月分を先にお預かりする形で、これ以外の費用はございません。\n\n一度お手元で触っていただいて、率直なところをお聞かせいただけたら嬉しいです。\n{link}", tapsJa: ["冷凍まぐろ", "鮮魚", "寿司米"], note: "日本食材の卸。Akio の元取引先で、松崎さんが窓口。Dubai Investment Park 2、星 4.2 / 9 件（2026-09-14）" },
  "Cooper Health Clinic": { kind: "demo", repOwned: "Rima", note: "J3 Mall, Al Wasl Rd, Al Manara。17 診療科、4.7 / 200 件。Rima の営業用に作成（2026-09-15）" },
  "Bentoya Kitchen": { kind: "demo", friend: true, owner: "マナー", shortName: "Bentoya", message: "Hi Mana, Akio here.\n\nThis is my own business. The review system I have been building is working now, and I have set up both Bentoya branches in it.\n\nA guest scans the QR on their phone, taps a rating and a few things they liked (the Bentoya Special Bento, the chirashi sushi, bento boxes), and about thirty seconds later there is a full review written in their own words. They can change any of it, and they post it on Google themselves. Nothing is given in exchange, so it stays inside Google's rules.\n\nThat is all it does. The guests who already liked you actually leave the review, instead of meaning to and forgetting.\n\nSheikh Zayed Road: {link}\nMotor City: https://qr.miraireach.ae/9d58ur\n\nEach branch has its own code so the reviews land on the right listing. Motor City is on 431 reviews and Sheikh Zayed Road is on 1,291, same food and same name, so Motor City has the most to gain.\n\nIt is AED 298 a month per branch, three months up front, and that is the whole cost. Or 498 a month if you also want a reply drafted for every review that comes in.\n\nHave a go on your phone and tell me straight what you think.", note: "Al Kawakeb Block D, Sheikh Zayed Rd。1997 年創業、ドバイ最初の日本食。星 4.5 / 1,291 件。オーナー知り合い。全 5 店（SZR・Motor City・JAFZA・JAFZA One・JLT）（2026-09-15）" },
  "Bentoya Motor City": { kind: "demo", friend: true, owner: "マナー", shortName: "Bentoya", coveredBy: "Bentoya Kitchen", note: "Foxhill 3, Uptown Motor City。星 4.6 / 431 件。SZR と同じオーナー（2026-09-15）" },
  "Noren": { kind: "demo", owner: "Pawel Kazanowski（共同創業者・エグゼクティブシェフ）", friend: true, note: "Pullman Dubai JLT, Cluster T。2026-08 開店、星 4.8 / 26 件。オーナー知り合い（2026-09-14）" },
};

const res = await fetch(
  `${url}/rest/v1/stores?select=*&order=created_at`,
  { headers: { apikey: key, Authorization: `Bearer ${key}` } },
);
if (!res.ok) {
  console.error(`stores: HTTP ${res.status} ${await res.text()}`);
  process.exit(1);
}
const rows = await res.json();

/**
 * 反応: ページを開いた回数（store_views、2026-09-17 以降）とレビュー生成の回数
 * （ai_review_drafts）。開封だけあって生成が 0 の店が「開いたけど押さなかった」で、
 * そこが送り直す相手。store_views がまだ無いデータベースでも一覧は出す。
 */
async function loadActivity() {
  const byStore = new Map();
  const pull = async (table, timeCol, extra) => {
    const q = `select=store_id,${timeCol}${extra}&order=${timeCol}.desc&limit=5000`;
    const r = await fetch(`${url}/rest/v1/${table}?${q}`, {
      headers: { apikey: key, Authorization: `Bearer ${key}` },
    });
    if (!r.ok) return [];
    return r.json();
  };
  const [views, drafts] = await Promise.all([
    pull("store_views", "opened_at", ",ip_hash"),
    pull("ai_review_drafts", "created_at", ""),
  ]);
  const seat = (id) => {
    if (!byStore.has(id)) byStore.set(id, { opens: 0, devices: new Set(), lastOpen: null, taps: 0, lastTap: null });
    return byStore.get(id);
  };
  for (const v of views) {
    const a = seat(v.store_id);
    a.opens++;
    if (v.ip_hash) a.devices.add(v.ip_hash);
    if (!a.lastOpen) a.lastOpen = v.opened_at;
  }
  for (const d of drafts) {
    const a = seat(d.store_id);
    a.taps++;
    if (!a.lastTap) a.lastTap = d.created_at;
  }
  return byStore;
}
const activity = await loadActivity();

const stamp = (iso) =>
  new Date(iso).toLocaleString("ja-JP", {
    timeZone: "Asia/Dubai",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  });

function activityCell(s) {
  const a = activity.get(s.id);
  if (!a) return `<span class="muted tiny">まだなし</span>`;
  const out = [];
  if (a.opens) {
    out.push(`<div><strong>${a.opens}</strong> 回開封 / ${a.devices.size} 台</div>`);
    out.push(`<div class="tiny muted">最終 ${stamp(a.lastOpen)}</div>`);
  }
  if (a.taps) out.push(`<div class="tiny">レビュー生成 ${a.taps} 回</div>`);
  if (a.opens && !a.taps) out.push(`<div class="tiny"><span class="flag amber">開いたが押していない</span></div>`);
  if (!a.opens && a.taps) out.push(`<div class="tiny muted">開封は 09-17 から記録</div>`);
  return out.join("");
}

const esc = (s) =>
  String(s ?? "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
const now = Date.now();
const DAY = 86400000;

function kindOf(name, s) {
  // stores.paid (2026-09-08) is the source of truth once it exists; the notes
  // table only fills in what the database cannot say.
  if (typeof s?.paid === "boolean" && NOTES[name]?.kind !== "own" && NOTES[name]?.kind !== "test") {
    if (s.paid) return "client";
    if (NOTES[name]?.kind === "client") return "demo";
  }
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

/**
 * 送信文（Akio 2026-09-14）。ほぼ全員が知り合いなので、会社名を名乗る営業文にしない。
 * Koi Water Barn と Trifid Media に実際に送った文面と同じ声にしてある:
 *   Akio here → その店の実物を 3 つ → 仕組み 1 文 → Google のルール 1 文 →
 *   「やることはそれだけ」→ 率直な感想を頼む。
 * 相手の名前が NOTES にない店は {name} を残す。送る前に入れ替える。
 */
const GUEST_WORD = [
  [/agency|broker|real estate|media/i, { en: "client", ja: "お客さん" }],
  [/clinic/i, { en: "patient", ja: "患者さん" }],
  [/fitness|golf|gym/i, { en: "member", ja: "お客さん" }],
  [/restaurant|cafe|café|tea house|steakhouse|bar|grill|pizza|ramen|sushi|udon|bistro/i, { en: "guest", ja: "お客さん" }],
  [/store|shop|boutique|retail|grocery|perfume|rug|market/i, { en: "customer", ja: "お客さん" }],
];
/** 店頭に QR を置ける業態か。卸や代理店は客が来ないのでリンクを送る。 */
function scansQr(cat) {
  return !/agency|broker|real estate|wholesaler|supplier|media/i.test(cat ?? "");
}

function guestWord(cat, ja) {
  for (const [re, w] of GUEST_WORD) if (re.test(cat ?? "")) return ja ? w.ja : w.en;
  return ja ? "お客さん" : "guest";
}

/** その店の実物を 3 つ。keyword_types の item を優先する。 */
function tapExamples(s) {
  const types = s.keyword_types ?? {};
  const kws = Array.isArray(s.keywords) ? s.keywords : [];
  const items = kws.filter((k) => types[k] === "item");
  return (items.length >= 3 ? items : kws).slice(0, 3);
}

function messageFor(s, name) {
  const short0 = `https://${QR_HOST}/${s.slug}`;
  // A店ごとの書き下ろしが最優先。共通テンプレートが営業文に寄りすぎる相手に使う
  // （Akio 2026-09-14: 知り合いには挨拶から入り、売り込みを最初に出さない）。
  if (NOTES[name]?.message) return NOTES[name].message.replace(/\{link\}/g, short0);
  const owner = NOTES[name]?.owner;
  const first = owner ? owner.split(/[\s（(]/)[0] : null;
  const friend = !!NOTES[name]?.friend;
  const short = `https://${QR_HOST}/${s.slug}`;
  const ja = NOTES[name]?.lang === "ja" || s.default_language === "ja";
  const who = guestWord(s.business_category, ja);
  const label = NOTES[name]?.shortName ?? name;
  const taps = (ja && NOTES[name]?.tapsJa) || tapExamples(s);

  if (ja) {
    const jaName = s.store_name?.ja ?? name;
    const ex = taps.length ? `（${taps.join("、")}）` : "";
    const open = first
      ? `${first}さん、Akio です。`
      : `${jaName}様\n\nAkio です。`;
    return [
      open,
      "",
      `これは私が自分でやっている事業です。ずっと作っていたレビューの仕組みが動く形になったので、${jaName}の中身を入れて用意しました。`,
      "",
      `${who}が${scansQr(s.business_category) ? "スマホで QR を読んで" : "スマホでリンクを開いて"}、星とよかったところをいくつかタップすると${ex}、30 秒ほどで本人の言葉のレビューが出来上がります。文章はその場で直せて、投稿するのは${who}本人です。見返りは何も渡さないので、Google のルールの中に収まっています。`,
      "",
      `やることはそれだけです。よかったと思ってくれた人が、思っただけで終わらずに実際に残してくれる。`,
      "",
      NOTES[name]?.free
        ? "前払いをいただいているので、これは私からのぶんです。使っている間、料金はかかりません。"
        : NOTES[name]?.noPrice
        ? null
        : "入れる場合は 1 拠点あたり月 AED 298、3 ヶ月分を先にいただく形で、それで全部です。届いたレビューへの返信まで下書きするなら月 498 です。",
      "",
      "一度触ってみて、率直なところを聞かせてください。",
      short,
    ].filter((x) => x !== null).join("\n").replace(/\n{3,}/g, "\n\n");
  }

  const ex = taps.length ? ` (${taps.join(", ")})` : "";
  const hello = `Hi ${first ?? "{name}"}, Akio here.`;
  // 「誰の事業なのか」を先に言う。作っているものの話だけだと、相手は趣味なのか
  // 勤め先の商品なのか判断がつかない（Akio 2026-09-14: 「誰のビジネス?」ってなる）。
  const lead = NOTES[name]?.pitchedBefore
    ? `Not the whole system I showed you before. Forget that one for now.\n\nWe have just released the review part of it on its own, and this is only that. It is already set up for ${label}, so there is nothing to prepare and nothing to configure.`
    : friend
    ? `This is my own business. The review system I have been building is working now, and I have put ${label} into it.`
    : `This is my own business, and it is easier to show it than to describe it. ${label} is already in it.`;
  return [
    hello,
    "",
    lead,
    "",
    `A ${who} ${scansQr(s.business_category) ? "scans the QR on their phone" : "opens the link on their phone"}, taps a rating and a few things they liked${ex}, and about thirty seconds later there is a full review written in their own words. They can change any of it, and they post it on Google themselves. Nothing is given in exchange, so it stays inside Google's rules.`,
    "",
    `That is all it does. The ${who}s who already liked you actually leave the review, instead of meaning to and forgetting.`,
    "",
    NOTES[name]?.free
      ? "You already paid me up front, so this one is on me. No charge for it, for as long as you use it."
      : NOTES[name]?.noPrice
      ? null
      : NOTES[name]?.pitchedBefore
      ? `It is AED 298 a month, three months up front, and that is the whole cost. Nothing like the old proposal, because this is one piece of it rather than the lot.`
      : `If you want it running at ${label}, it is AED 298 a month, three months up front, and that is the whole cost. Or 498 a month if you also want a reply drafted for every review that comes in.`,
    "",
    "Have a go on your phone and tell me straight what you think:",
    short,
  ].filter((x) => x !== null).join("\n").replace(/\n{3,}/g, "\n\n");
}

const groups = { client: [], demo: [], own: [], test: [] };
for (const s of rows) {
  const name = s.store_name?.en ?? Object.values(s.store_name ?? {})[0] ?? "(unnamed)";
  const kind = kindOf(name, s);
  const live = s.is_active && (!s.subscription_expires_at || Date.parse(s.subscription_expires_at) > now);
  const short = s.slug ? `https://${QR_HOST}/${s.slug}` : null;
  const long = `${APP}/store/${s.id}`;
  const qr = short ? await QRCode.toDataURL(short, { width: 180, margin: 1, errorCorrectionLevel: "M", color: { dark: "#0f172a", light: "#ffffff" } }) : null;
  const msg = short ? messageFor(s, name) : "";
  groups[kind].push({ s, name, kind, live, short, long, qr, msg });
}

function row(r) {
  const { s, name, kind, live, short, long, qr, msg } = r;
  const n = NOTES[name] ?? {};
  const area = [s.entity_area, s.entity_city].filter(Boolean).join(", ");
  const ai = s.ai_review_enabled
    ? `<span class="flag green">ON</span>`
    : `<span class="flag grey">OFF</span><div class="tiny">送る前にマスター管理で ON</div>`;
  // 投稿先は place_id でも maps.app.goo.gl の共有リンクでも成立する。
  // place_id だけを見ていたので、リンクが入っている店まで「未設定」と出ていた。
  const google = s.google_place_id || (s.google_review_url ?? "").trim()
    ? `<span class="tiny muted">Google 投稿リンクあり</span>`
    : `<span class="tiny amber">Google 投稿リンク未設定</span>`;
  // 営業が連れてきた案件は、その営業のもの。Akio の送信リストに文面を出さない。
  const noSend = NOTES[name]?.repOwned
    ? `${NOTES[name].repOwned} の案件。Akio からは送りません`
    : NOTES[name]?.coveredBy
    ? `同じオーナー。${NOTES[name].coveredBy} の文面に両方のリンクを入れてあります`
    : {
        client: "契約中。デモの売り込み文は出していません",
        own: "自社。送る相手なし",
        test: "テスト用。送る相手なし",
      }[kind];
  const sendBlock = noSend
    ? `<span class="muted tiny">${noSend}</span>`
    : short
    ? `<div class="msgbox"><textarea readonly rows="4">${esc(msg)}</textarea>
         <div class="btns">
           <a class="btn" target="_blank" rel="noopener" href="https://wa.me/?text=${encodeURIComponent(msg)}">WhatsApp で送る</a>
           <button class="btn ghost" data-copy="${esc(msg)}">文面をコピー</button>
         </div></div>`
    : `<span class="muted">slug なし</span>`;
  return `<tr data-id="${s.id}" class="${live ? "" : "dim"}">
    <td class="name"><strong>${esc(name)}</strong><div class="tiny muted">${esc(s.business_category ?? "")}${area ? " · " + esc(area) : ""}</div>${n.friend ? `<div class="tiny"><span class="flag green">知り合い</span></div>` : ""}${n.owner ? `<div class="tiny">👤 ${esc(n.owner)}</div>` : ""}${n.note ? `<div class="tiny muted">${esc(n.note)}</div>` : ""}</td>
    <td>${contractCell(s)}<div class="tiny muted">${s.keywords?.length ?? 0} pills / ${s.forced_keywords?.length ?? 0} core${s.logo_url ? " / ロゴあり" : ""}</div>${google}</td>
    <td class="center">${ai}</td>
    <td class="act">${activityCell(s)}</td>
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
  <div class="scroll"><table><thead><tr><th>店</th><th>契約 / 設定</th><th>AI Draft</th><th>反応</th><th>短縮リンク</th><th>QR</th><th>送信文</th><th>進捗</th></tr></thead>
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
    <div><strong>文面</strong>は知り合いに送る前提で書いてあります（Koi と Trifid に送ったものと同じ声、2026-09-14 改訂）。その店の実物が 3 つ入っているので、1 店ずつ中身が違います。相手の名前が分からない店は <code>{name}</code> のままなので、送る前に入れ替えてください。</div>
    <div><strong>反応</strong>: 相手がページを<strong>開いた</strong>回数と台数、レビューを<strong>生成した</strong>回数。開封の記録は 2026-09-17 開始なので、それ以前に送った分は生成の回数だけです。開封があって生成 0 は「見たが押さなかった」で、送り直す相手はそこ。</div>
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
