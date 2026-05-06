export const STORE_CONFIG = {
  storeName: "Dubai Marina Sushi",
  greetingText:
    "Thank you for dining with us! Your feedback means the world to us.",
  keywords: [
    "Omakase",
    "Fresh Seafood",
    "Premium Wagyu",
    "Chef's Table",
    "Tasting Menu",
    "Expert Sushi Chef",
    "Friendly Staff",
    "Cozy Atmosphere",
    "Waterfront View",
    "Dubai Marina",
    "Hidden Gem",
    "Date Night Spot",
    "Business Lunch",
    "Outstanding Value",
    "Michelin Quality",
    "Sake Pairing",
    "Innovative Rolls",
    "Authentic Japanese",
    "Fast Service",
    "Must-Try Experience",
  ] as const,
  gbpReviewUrl: "https://maps.google.com/?cid=MOCK_GBP_ID",
  accentColor: "#f59e0b", // amber-400 — overridden per client in production
} as const;

export type Step =
  | "rating"
  | "keywords"
  | "generating"
  | "result"
  | "feedback"
  | "feedback_sent";
