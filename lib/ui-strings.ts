import type { SupportedLocale } from "@/types/database";

/**
 * UI copy for the guest review flow, per locale. The store name / greeting come
 * from the DB (already localized); everything else — buttons, labels, guides —
 * lives here so the en/ja/ar language switcher actually localizes the whole flow.
 *
 * Templates use "{n}" / "{store}" placeholders, substituted at render time.
 */
export interface UiStrings {
  flow: {
    shareExperience: string;
  };
  rating: {
    rateExperience: string;
    /** Index by star count 0–5 (index 0 unused). */
    labels: string[];
    continue: string;
    /** aria per star button, "{n} star". */
    starAria: string;
  };
  keywords: {
    stepLabel: string;
    title: string;
    presetIntro: string;
    selectIntro: string;
    noOptionalTags: string;
    presetHighlights: string;
    noneSelected: string;
    /** "{n} selected" */
    selectedCount: string;
    generate: string;
  };
  generating: {
    stepLabel: string;
    title: string;
    subtitle: string;
  };
  result: {
    stepLabel: string;
    title: string;
    subtitle: string;
    reviewAria: string;
    whatsappOptional: string;
    /**
     * SMS variants of the capture block, used when the store's contact_channel
     * is 'sms'. WhatsApp is not the messaging app everywhere — a Japanese guest
     * shown a "WhatsApp" field just leaves it blank and the store loses the
     * lead. Separate keys (not a rename) so UAE stores keep today's wording.
     */
    smsOptional: string;
    smsPhoneAria: string;
    smsOptIn: string;
    smsSavedLive: string;
    previewBanner: string;
    namePlaceholder: string;
    phonePlaceholder: string;
    countryCodeAria: string;
    phoneAria: string;
    save: string;
    optIn: string;
    saveError: string;
    savedPreview: string;
    savedPreviewDetail: string;
    savedLive: string;
    copiedToast: string;
    tryAnotherWording: string;
    /** Label for the guest's review-language selector (English / العربية / 日本語). */
    reviewLanguage: string;
    copyReview: string;
    translate: string;
    postOnGoogle: string;
    howToTitle: string;
    /** Three ordered steps. */
    howToSteps: string[];
    startOver: string;
  };
  feedback: {
    title: string;
    /** "Help {store} improve." */
    help: string;
    quickTags: string[];
    placeholder: string;
    describeAria: string;
    send: string;
    sending: string;
    /** aria on the star summary, "{n} out of 5 stars". */
    ratingAria: string;
    /** shown when the feedback POST fails; keep the guest on the form to retry. */
    sendError: string;
    /**
     * Public-review option offered alongside the private one. A guest who rates
     * low must see the same Google path a happy guest sees — routing only happy
     * guests to Google is "selectively solicit positive reviews", which Google
     * prohibits. No draft is generated here: whatever the guest wrote is their
     * own words, copied so they can paste it.
     */
    postOnGoogle: string;
    eitherNote: string;
  };
  feedbackSent: {
    title: string;
    /** "The team at {store} will review…" */
    body: string;
    closing: string;
    backToStart: string;
    /** The public path stays open after sending privately — never a dead end. */
    alsoOnGoogle: string;
  };
}

const en: UiStrings = {
  flow: { shareExperience: "Share your experience" },
  rating: {
    rateExperience: "Rate your experience",
    labels: ["", "Poor", "Fair", "Good", "Great", "Excellent"],
    continue: "Continue",
    starAria: "{n} star",
  },
  keywords: {
    stepLabel: "Step 2 — Keywords",
    title: "What stood out?",
    presetIntro:
      "Keywords for your review are preset. Tap continue — you can still edit the generated text before posting.",
    selectIntro: "Select all that apply. We'll craft your review automatically.",
    noOptionalTags:
      "No optional tags — your review will use the venue's preset phrases.",
    presetHighlights: "Preset highlights",
    noneSelected: "none selected",
    selectedCount: "{n} selected",
    generate: "Generate Review",
  },
  generating: {
    stepLabel: "Step 3 — Generating",
    title: "Crafting your review",
    subtitle: "Assembling a unique review from your keywords.",
  },
  result: {
    stepLabel: "Step 4 — Your Review",
    title: "Ready to post",
    subtitle: "Edit freely before submitting.",
    reviewAria: "Your review text",
    whatsappOptional: "WhatsApp (Optional)",
    smsOptional: "Phone number (optional)",
    smsPhoneAria: "Phone number",
    smsOptIn: "I agree to receive offers and news from this business by SMS.",
    smsSavedLive: "Number registered. Thank you!",
    previewBanner:
      "Preview mode. The form below matches your live review page. Save here is a demo — use your venue's link from the dashboard to capture contacts in the database.",
    namePlaceholder: "Your name (optional)",
    phonePlaceholder: "50 123 4567",
    countryCodeAria: "Country calling code",
    phoneAria: "WhatsApp number",
    save: "Save",
    optIn:
      "I agree to receive exclusive offers and campaign info via WhatsApp.",
    saveError: "Couldn't save your number. Please try again in a moment.",
    savedPreview: "Thanks — this is how save looks on the live page.",
    savedPreviewDetail:
      "Preview only: your number was not stored. On your store's real review link (QR from the dashboard), the same button saves to the owner's list.",
    savedLive: "WhatsApp registered. Thank you!",
    copiedToast: "Copied to clipboard",
    tryAnotherWording: "Try another wording",
    reviewLanguage: "Review language",
    copyReview: "Copy Review",
    translate: "Translate via Google",
    postOnGoogle: "Post on Google",
    howToTitle: "How to post",
    howToSteps: [
      "Tap Copy Review",
      "Tap Post on Google — Maps opens",
      "Paste and hit Post",
    ],
    startOver: "Start over",
  },
  feedback: {
    title: "We're sorry to hear that.",
    help: "Help {store} improve.",
    quickTags: [
      "Food quality",
      "Service",
      "Wait time",
      "Pricing",
      "Cleanliness",
      "Other",
    ],
    placeholder: "Describe your experience...",
    describeAria: "Describe your experience",
    send: "Send privately to the team",
    sending: "Sending…",
    ratingAria: "{n} out of 5 stars",
    sendError: "Couldn't send. Please check your connection and try again.",
    postOnGoogle: "Post on Google",
    eitherNote:
      "Either one is fine — or both. If you post on Google, what you wrote above is copied so you can paste it in your own words.",
  },
  feedbackSent: {
    title: "Thank you for your feedback.",
    body: "The team at {store} will review your comments and work to improve.",
    closing: "We hope to welcome you back and give you a better experience.",
    backToStart: "Back to start",
    alsoOnGoogle: "You're also welcome to post your review publicly on Google.",
  },
};

const ja: UiStrings = {
  flow: { shareExperience: "ご感想をお聞かせください" },
  rating: {
    rateExperience: "評価してください",
    labels: ["", "不満", "まあまあ", "良い", "とても良い", "最高"],
    continue: "次へ",
    starAria: "星{n}つ",
  },
  keywords: {
    stepLabel: "ステップ 2 — キーワード",
    title: "印象に残った点は？",
    presetIntro:
      "レビューのキーワードは設定済みです。「次へ」をタップしてください。投稿前に文章を編集できます。",
    selectIntro:
      "当てはまるものをすべて選んでください。自動でレビューを作成します。",
    noOptionalTags:
      "任意のタグはありません — お店の設定フレーズでレビューを作成します。",
    presetHighlights: "設定済みの特徴",
    noneSelected: "未選択",
    selectedCount: "{n}件選択",
    generate: "レビューを作成",
  },
  generating: {
    stepLabel: "ステップ 3 — 作成中",
    title: "レビューを作成しています",
    subtitle: "キーワードから独自のレビューを組み立てています。",
  },
  result: {
    stepLabel: "ステップ 4 — レビュー",
    title: "投稿の準備ができました",
    subtitle: "投稿前に自由に編集できます。",
    reviewAria: "レビュー本文",
    whatsappOptional: "WhatsApp（任意）",
    smsOptional: "電話番号（任意）",
    smsPhoneAria: "電話番号",
    smsOptIn: "お店からのお得な情報・お知らせをSMSで受け取ることに同意します。",
    smsSavedLive: "登録しました。ありがとうございます！",
    previewBanner:
      "プレビューモード。下のフォームは実際のレビューページと同じです。ここでの保存はデモです — 連絡先をデータベースに保存するには、ダッシュボードのお店のリンクをご利用ください。",
    namePlaceholder: "お名前（任意）",
    phonePlaceholder: "50 123 4567",
    countryCodeAria: "国番号",
    phoneAria: "WhatsApp番号",
    save: "保存",
    optIn:
      "WhatsAppで特別オファーやキャンペーン情報を受け取ることに同意します。",
    saveError:
      "番号を保存できませんでした。しばらくしてからもう一度お試しください。",
    savedPreview: "ありがとうございます — 実際のページではこのように保存されます。",
    savedPreviewDetail:
      "プレビューのみ: 番号は保存されていません。お店の実際のレビューリンク（ダッシュボードのQR）では、同じボタンでオーナーのリストに保存されます。",
    savedLive: "WhatsAppを登録しました。ありがとうございます！",
    copiedToast: "クリップボードにコピーしました",
    tryAnotherWording: "別の文面を試す",
    reviewLanguage: "レビューの言語",
    copyReview: "レビューをコピー",
    translate: "Googleで翻訳",
    postOnGoogle: "Googleに投稿",
    howToTitle: "投稿方法",
    howToSteps: [
      "「レビューをコピー」をタップ",
      "「Googleに投稿」をタップ — マップが開きます",
      "貼り付けて「投稿」を押す",
    ],
    startOver: "最初からやり直す",
  },
  feedback: {
    title: "申し訳ございません。",
    help: "{store}の改善にご協力ください。",
    quickTags: ["料理の質", "接客", "待ち時間", "価格", "清潔さ", "その他"],
    placeholder: "ご体験の内容をお書きください…",
    describeAria: "ご体験の内容",
    send: "お店に直接送る（非公開）",
    sending: "送信中…",
    ratingAria: "5つ星中{n}つ",
    sendError: "送信できませんでした。接続を確認してもう一度お試しください。",
    postOnGoogle: "Googleに投稿する",
    eitherNote:
      "どちらでも、両方でも構いません。Googleに投稿する場合は、上にお書きの内容をコピーしますので、ご自身の言葉で貼り付けてください。",
  },
  feedbackSent: {
    title: "フィードバックをありがとうございます。",
    body: "{store}のスタッフがコメントを確認し、改善に努めます。",
    closing:
      "またのご来店を心よりお待ちしております。次回はより良い体験をお約束します。",
    backToStart: "最初に戻る",
    alsoOnGoogle: "Googleに公開のクチコミとして投稿していただくこともできます。",
  },
};

const ar: UiStrings = {
  flow: { shareExperience: "شاركنا تجربتك" },
  rating: {
    rateExperience: "قيّم تجربتك",
    labels: ["", "ضعيف", "مقبول", "جيد", "جيد جدًا", "ممتاز"],
    continue: "متابعة",
    starAria: "{n} نجمة",
  },
  keywords: {
    stepLabel: "الخطوة 2 — الكلمات المفتاحية",
    title: "ما الذي أعجبك؟",
    presetIntro:
      "الكلمات المفتاحية لمراجعتك مُعدّة مسبقًا. اضغط متابعة — يمكنك تعديل النص قبل النشر.",
    selectIntro: "اختر كل ما ينطبق. سننشئ مراجعتك تلقائيًا.",
    noOptionalTags:
      "لا توجد وسوم اختيارية — ستستخدم مراجعتك العبارات المُعدّة للمتجر.",
    presetHighlights: "أبرز النقاط المُعدّة",
    noneSelected: "لم يتم التحديد",
    selectedCount: "{n} محدد",
    generate: "إنشاء المراجعة",
  },
  generating: {
    stepLabel: "الخطوة 3 — الإنشاء",
    title: "جارٍ إعداد مراجعتك",
    subtitle: "نُجمّع مراجعة فريدة من كلماتك المفتاحية.",
  },
  result: {
    stepLabel: "الخطوة 4 — مراجعتك",
    title: "جاهزة للنشر",
    subtitle: "عدّلها بحرية قبل الإرسال.",
    reviewAria: "نص مراجعتك",
    whatsappOptional: "واتساب (اختياري)",
    smsOptional: "رقم الهاتف (اختياري)",
    smsPhoneAria: "رقم الهاتف",
    smsOptIn: "أوافق على تلقّي العروض والأخبار من هذا المتجر عبر الرسائل النصية.",
    smsSavedLive: "تم تسجيل الرقم. شكرًا لك!",
    previewBanner:
      "وضع المعاينة. النموذج أدناه مطابق لصفحة مراجعتك المباشرة. الحفظ هنا تجريبي — استخدم رابط متجرك من لوحة التحكم لحفظ جهات الاتصال في قاعدة البيانات.",
    namePlaceholder: "اسمك (اختياري)",
    phonePlaceholder: "50 123 4567",
    countryCodeAria: "رمز الاتصال الدولي",
    phoneAria: "رقم واتساب",
    save: "حفظ",
    optIn: "أوافق على تلقّي العروض الحصرية وأخبار الحملات عبر واتساب.",
    saveError: "تعذّر حفظ رقمك. يرجى المحاولة مرة أخرى بعد قليل.",
    savedPreview: "شكرًا — هكذا يظهر الحفظ في الصفحة المباشرة.",
    savedPreviewDetail:
      "معاينة فقط: لم يُحفظ رقمك. في رابط المراجعة الحقيقي لمتجرك (رمز QR من لوحة التحكم)، يحفظ الزر نفسه إلى قائمة المالك.",
    savedLive: "تم تسجيل واتساب. شكرًا لك!",
    copiedToast: "تم النسخ إلى الحافظة",
    tryAnotherWording: "جرّب صياغة أخرى",
    reviewLanguage: "لغة المراجعة",
    copyReview: "نسخ المراجعة",
    translate: "ترجم عبر Google",
    postOnGoogle: "انشر على Google",
    howToTitle: "طريقة النشر",
    howToSteps: [
      "اضغط «نسخ المراجعة»",
      "اضغط «انشر على Google» — تفتح الخرائط",
      "الصق واضغط «نشر»",
    ],
    startOver: "البدء من جديد",
  },
  feedback: {
    title: "نأسف لسماع ذلك.",
    help: "ساعد {store} على التحسّن.",
    quickTags: [
      "جودة الطعام",
      "الخدمة",
      "وقت الانتظار",
      "الأسعار",
      "النظافة",
      "أخرى",
    ],
    placeholder: "صف تجربتك…",
    describeAria: "صف تجربتك",
    send: "إرسال إلى الفريق (خاص)",
    sending: "جارٍ الإرسال…",
    ratingAria: "{n} من 5 نجوم",
    sendError: "تعذّر الإرسال. يرجى التحقق من اتصالك والمحاولة مرة أخرى.",
    postOnGoogle: "النشر على Google",
    eitherNote:
      "أيهما شئت، أو كلاهما. إن اخترت النشر على Google فسنسخ ما كتبته أعلاه لتلصقه بكلماتك أنت.",
  },
  feedbackSent: {
    title: "شكرًا على ملاحظاتك.",
    body: "سيراجع فريق {store} تعليقاتك ويعمل على التحسين.",
    closing: "نتطلّع إلى الترحيب بك مجددًا وتقديم تجربة أفضل.",
    backToStart: "العودة إلى البداية",
    alsoOnGoogle: "يمكنك أيضًا نشر مراجعتك علنًا على Google.",
  },
};

const UI_STRINGS: Record<SupportedLocale, UiStrings> = { en, ja, ar };

/** Resolved UI copy for a locale (falls back to English). */
export function getUiStrings(locale: SupportedLocale): UiStrings {
  return UI_STRINGS[locale] ?? en;
}
