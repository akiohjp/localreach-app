import type { Vertical } from "@/lib/review-pools";
import type { SupportedLocale } from "@/types/database";

/**
 * Starter keyword sets per business type.
 *
 * Why this exists: keywords ARE the local-SEO payload — they are the words a
 * guest's review will carry into Google and into AI answers. Until now every
 * new store started from an empty box, so a dental clinic and a car garage
 * shipped with whatever the owner happened to type (often nothing). A sweep of
 * all 18 verticals on 2026-07-29 confirmed the phrasing pools are vertical-aware
 * but the keywords were not vertical-aware at all.
 *
 * Rules every entry follows (see lib/review-engine.ts):
 *  - NOUN-SHAPED: each phrase must read naturally as an object — "Definitely try
 *    {kw}", "No notes on {kw}". Never attributes ("family friendly") or place
 *    names (those belong to the entity fields).
 *  - Lowercase unless a proper noun: the engine adds "the" only to lowercase
 *    phrases, so "invisalign treatment" → "the invisalign treatment".
 *  - Searchable: phrases a real customer would type into Google or ask an AI.
 *
 * These are a STARTING POINT the owner edits — dish and service names specific
 * to the business always beat generic category terms.
 */

type PresetSet = Partial<Record<SupportedLocale, string[]>>;

const PRESETS: Record<Vertical, PresetSet> = {
  generic: {
    en: ["friendly team", "quick service", "fair prices", "helpful advice", "easy booking", "clear communication", "quality work", "great experience"],
    ja: ["丁寧な対応", "スピーディーな仕事", "適正な価格", "わかりやすい説明", "予約のしやすさ", "仕上がりの良さ"],
    ar: ["فريق ودود", "خدمة سريعة", "أسعار عادلة", "نصائح مفيدة", "حجز سهل", "جودة العمل"],
  },
  restaurant: {
    en: ["signature dish", "fresh ingredients", "generous portions", "quick lunch menu", "attentive service", "dinner with friends", "value for money", "the desserts"],
    ja: ["看板メニュー", "新鮮な食材", "ボリューム", "ランチセット", "丁寧な接客", "デザート", "コスパの良さ"],
    ar: ["الطبق المميز", "مكونات طازجة", "كميات سخية", "قائمة الغداء", "خدمة مهتمة", "الحلويات"],
  },
  cafe: {
    en: ["flat white", "specialty coffee beans", "fresh pastries", "breakfast plate", "matcha latte", "workspace with wifi", "friendly baristas", "iced drinks"],
    ja: ["自家焙煎コーヒー", "焼きたてのパン", "モーニング", "抹茶ラテ", "作業しやすい席", "バリスタの技術"],
    ar: ["قهوة مختصة", "معجنات طازجة", "فطور", "لاتيه", "مساحة للعمل", "مشروبات باردة"],
  },
  beauty: {
    en: ["balayage colour", "keratin treatment", "gel manicure", "hair styling", "relaxing head spa", "skilled stylists", "bridal package", "eyelash extensions"],
    ja: ["カラーリング", "縮毛矯正", "ジェルネイル", "ヘッドスパ", "スタイリストの技術", "ブライダルメニュー", "まつげエクステ"],
    ar: ["صبغة الشعر", "علاج الكيراتين", "مانيكير جل", "تصفيف الشعر", "جلسة استرخاء", "باقة العروس"],
  },
  aesthetic: {
    en: ["laser hair removal", "hydrafacial treatment", "skin consultation", "acne treatment", "results after one session", "experienced doctors", "aftercare advice"],
    ja: ["医療脱毛", "ハイドラフェイシャル", "肌診断", "ニキビ治療", "施術後の経過", "医師の説明", "アフターケア"],
    ar: ["إزالة الشعر بالليزر", "تنظيف البشرة", "استشارة الجلدية", "علاج حب الشباب", "نتائج واضحة", "متابعة بعد الجلسة"],
  },
  dental: {
    en: ["teeth whitening", "invisalign treatment", "root canal treatment", "dental implants", "painless cleaning", "clear treatment plan", "gentle dentist", "emergency appointment"],
    ja: ["ホワイトニング", "インビザライン", "根管治療", "インプラント", "痛くない治療", "治療計画の説明", "急患対応"],
    ar: ["تبييض الأسنان", "تقويم شفاف", "علاج العصب", "زراعة الأسنان", "تنظيف بدون ألم", "خطة علاج واضحة"],
  },
  clinic: {
    en: ["same-day appointment", "thorough examination", "clear diagnosis", "physiotherapy sessions", "vaccination visit", "short waiting time", "English-speaking doctor", "follow-up care"],
    ja: ["当日予約", "丁寧な診察", "わかりやすい説明", "リハビリ", "予防接種", "待ち時間の短さ", "経過観察"],
    ar: ["موعد في نفس اليوم", "فحص شامل", "تشخيص واضح", "جلسات علاج طبيعي", "التطعيم", "وقت انتظار قصير"],
  },
  realestate: {
    en: ["honest market advice", "property viewings", "handover support", "rental listings", "smooth paperwork", "quick responses", "negotiation on price", "handover inspection"],
    ja: ["物件のご提案", "内見の対応", "引き渡しサポート", "契約手続き", "レスポンスの早さ", "価格交渉"],
    ar: ["نصائح صادقة عن السوق", "معاينة العقارات", "دعم التسليم", "قوائم الإيجار", "إجراءات سلسة", "سرعة الرد"],
  },
  legal: {
    en: ["company setup", "visa processing", "contract review", "clear fee structure", "practical advice", "fast turnaround", "document drafting", "regular updates"],
    ja: ["会社設立", "ビザ手続き", "契約書レビュー", "明確な料金体系", "実務的なアドバイス", "対応の早さ", "書類作成"],
    ar: ["تأسيس الشركات", "إجراءات التأشيرة", "مراجعة العقود", "رسوم واضحة", "نصائح عملية", "إنجاز سريع"],
  },
  home: {
    en: ["kitchen fit-out", "joinery work", "painting job", "AC maintenance", "clean finish", "on-time completion", "detailed quotation", "tidy workmanship"],
    ja: ["キッチンリフォーム", "造作工事", "塗装", "エアコン工事", "仕上がりの丁寧さ", "工期どおりの完了", "見積もりの明確さ"],
    ar: ["تجهيز المطبخ", "أعمال النجارة", "أعمال الدهان", "صيانة التكييف", "إنهاء نظيف", "الالتزام بالموعد", "عرض سعر مفصل"],
  },
  education: {
    en: ["small class sizes", "IELTS preparation", "patient teachers", "progress reports", "trial lesson", "flexible schedule", "exam results", "beginner course"],
    ja: ["少人数クラス", "受験対策", "先生の教え方", "進捗report", "体験レッスン", "時間の融通", "成績の伸び"],
    ar: ["صفوف صغيرة", "تحضير الآيلتس", "معلمون صبورون", "تقارير التقدم", "حصة تجريبية", "جدول مرن"],
  },
  pet: {
    en: ["dog grooming", "vaccination visit", "dental cleaning for pets", "gentle handling", "clear treatment advice", "boarding stay", "emergency care", "cat-friendly clinic"],
    ja: ["トリミング", "ワクチン接種", "歯石除去", "優しい対応", "治療方針の説明", "ペットホテル", "急患対応"],
    ar: ["تنظيف وتزيين الكلاب", "التطعيم", "تنظيف أسنان الحيوانات", "تعامل لطيف", "شرح واضح للعلاج", "إقامة الحيوانات"],
  },
  retail: {
    en: ["wide selection", "gift wrapping", "helpful staff advice", "new arrivals", "quality materials", "easy exchanges", "personal shopping help", "fair prices"],
    ja: ["品揃えの豊富さ", "ギフト包装", "スタッフの提案", "新入荷", "素材の良さ", "交換対応", "価格の手頃さ"],
    ar: ["تشكيلة واسعة", "تغليف الهدايا", "نصائح الموظفين", "وصل حديثاً", "خامات ممتازة", "سهولة الاستبدال"],
  },
  fitness: {
    en: ["personal training", "reformer pilates", "group classes", "clean equipment", "knowledgeable trainers", "beginner-friendly sessions", "flexible membership", "shower facilities"],
    ja: ["パーソナルトレーニング", "ピラティス", "グループレッスン", "設備の清潔さ", "トレーナーの知識", "初心者向けメニュー", "通いやすさ"],
    ar: ["تدريب شخصي", "بيلاتس", "حصص جماعية", "أجهزة نظيفة", "مدربون محترفون", "برامج للمبتدئين"],
  },
  hotel: {
    en: ["sea view room", "breakfast buffet", "comfortable beds", "spotless rooms", "helpful concierge", "early check-in", "spa facilities", "quiet location"],
    ja: ["オーシャンビューの部屋", "朝食ビュッフェ", "ベッドの寝心地", "客室の清潔さ", "コンシェルジュの対応", "アーリーチェックイン", "スパ施設"],
    ar: ["غرفة بإطلالة بحرية", "بوفيه الإفطار", "أسرّة مريحة", "غرف نظيفة", "خدمة الكونسيرج", "تسجيل دخول مبكر", "مرافق السبا"],
  },
  auto: {
    en: ["oil change service", "brake replacement", "honest diagnosis", "detailed quotation", "same-day repair", "genuine parts", "car detailing", "AC servicing"],
    ja: ["オイル交換", "ブレーキ交換", "正直な診断", "見積もりの明確さ", "即日修理", "純正部品", "洗車・コーティング"],
    ar: ["تغيير الزيت", "تبديل الفرامل", "تشخيص صادق", "عرض سعر مفصل", "إصلاح في نفس اليوم", "قطع أصلية", "تلميع السيارة"],
  },
  agency: {
    en: ["monthly reporting", "clear flat pricing", "Google Maps ranking", "AI visibility report", "website design", "Google Business Profile setup", "fast WhatsApp support", "measurable results"],
    ja: ["月次レポート", "明確な料金", "Googleマップ順位", "AI可視性レポート", "ホームページ制作", "Googleビジネスプロフィール設定", "レスポンスの早さ"],
    ar: ["تقارير شهرية", "أسعار واضحة", "ترتيب خرائط جوجل", "تقرير الظهور في الذكاء الاصطناعي", "تصميم المواقع", "إعداد ملف النشاط التجاري"],
  },
  services: {
    en: ["same-day booking", "thorough job", "reliable timing", "clear pricing", "professional team", "easy rescheduling", "attention to detail", "follow-up check"],
    ja: ["即日予約", "作業の丁寧さ", "時間どおりの対応", "明確な料金", "プロの仕事", "日程変更の柔軟さ", "細かい配慮"],
    ar: ["حجز في نفس اليوم", "عمل متقن", "التزام بالمواعيد", "تسعير واضح", "فريق محترف", "مرونة في تغيير الموعد"],
  },
};

/**
 * Starter keywords for a vertical in the store's language. Falls back to the
 * English set, then to the generic set, so every category always returns
 * something usable. Returns a copy — callers mutate their own array.
 */
export function keywordPresetsFor(vertical: Vertical, locale: SupportedLocale): string[] {
  const set = PRESETS[vertical] ?? PRESETS.generic;
  const list = set[locale] ?? set.en ?? PRESETS.generic.en ?? [];
  return [...list];
}
