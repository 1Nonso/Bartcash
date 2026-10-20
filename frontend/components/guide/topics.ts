/**
 * In-app guide copy (approved Oct 20). Info sheets are opened by an ⓘ
 * button or the Scout badge; tours and the welcome card point to them.
 */

export type TopicId = "listing" | "valuation" | "trading" | "scout";

export interface Topic {
  title: string;
  icon: "create-outline" | "sparkles" | "swap-horizontal-outline";
  points: { heading?: string; text: string }[];
  footer?: string;
}

export const TOPICS: Record<TopicId, Topic> = {
  listing: {
    title: "Make your listing count",
    icon: "create-outline",
    points: [
      {
        text: "Be exact. Put the brand and model in the title, like 'Samsung Galaxy A52, 128 GB'. The AI valuation and Scout both read it.",
      },
      { text: "Be honest about condition. A fair description now avoids disputes at the swap." },
      { text: "Add clear photos in good light. The first photo is used for the valuation." },
      { text: "Describe what's included and any faults. Detailed listings get better offers." },
    ],
  },
  valuation: {
    title: "How the AI valuation works",
    icon: "sparkles",
    points: [
      {
        text: "Our AI looks at your photo, title, description and condition, and estimates a USD price range.",
      },
      {
        text: "It's a guide, not a price tag. You set your own declared value, and both are shown to buyers.",
      },
      {
        text: "The more accurate your listing, the better the estimate. If it fails, you can retry from your listing.",
      },
    ],
  },
  trading: {
    title: "How trading works",
    icon: "swap-horizontal-outline",
    points: [
      { text: "Offer one or more of your items, cash, or items plus a cash top-up." },
      { text: "The other person can accept, decline or counter. Chat opens once you agree." },
      { text: "Meet, swap, and both confirm. Then rate each other to build trust." },
    ],
  },
  scout: {
    title: "How Scout works",
    icon: "sparkles",
    points: [
      {
        heading: "What you'd take",
        text: "When you list something, pick up to 3 categories you'd accept in exchange. Scout shows you listings in those categories.",
      },
      {
        heading: "They may want yours",
        text: "Scout checks whether the other person wants what you're offering. Two-way matches rank higher.",
      },
      {
        heading: "Your taste",
        text: "Add brands, music and films you love. Scout uses Qloo's taste data to favour listings from brands that people with your taste enjoy.",
      },
    ],
    footer:
      "Scout only suggests. You decide what to offer and you send it yourself. Labels show how close a match is: Strong, Good or Possible.",
  },
};

export const WELCOME = {
  title: "Welcome to Bartcash",
  text: "Swap what you have for what you want. We'll show you around as you go, and you can tap ⓘ anytime to learn more.",
  button: "Let's go",
};
