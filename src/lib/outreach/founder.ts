/**
 * Vikram's company facts used by email drafts and the deck.
 * Anything in [square brackets] is a placeholder: the UI highlights it and blocks "Send now"
 * until it is replaced, so no invented number ever reaches a real investor.
 * The deck's sample figures are DUMMY and every slide is labelled "Illustrative".
 */
export const FOUNDER = {
  firstName: "Vikram",
  company: "Freightlane", // placeholder company name for the dummy deck
  oneLiner: "dispatch and live-tracking software for Indian fleet operators running 20 to 200 trucks",
  traction: "[ARR] across [N] fleet operators, growing [X]% month on month",
  ask: "a [₹X Cr] seed round",
  signoff: "Vikram\nFounder, Freightlane",
  linkedinSignoff: "Vikram, founder of Freightlane",
};

/** Dummy deck content. Clearly illustrative; replace with real material before use. */
export const DECK = {
  date: () => new Date().toLocaleDateString("en-IN", { month: "long", year: "numeric" }),
  slides: [
    {
      title: "The problem",
      lines: [
        "Mid-size Indian fleets still dispatch on WhatsApp, phone calls and spreadsheets.",
        "Shippers get no live ETA, so drivers are called 6-8 times per trip.",
        "Empty return legs run at 30-40% of kilometres driven.",
      ],
    },
    {
      title: "What Freightlane does",
      lines: [
        "One dispatch board for every load, truck and driver.",
        "Live tracking through the driver's phone. No hardware.",
        "Automatic shipper ETA updates and digital proof of delivery.",
      ],
    },
    {
      title: "Traction (illustrative)",
      lines: ["41 fleet operators live, 2,300 trucks on the platform", "Rs 38L ARR, 14% month-on-month growth", "Net revenue retention 128%"],
    },
    {
      title: "Market",
      lines: [
        "~1.3M fleet operators in India; 90%+ run fewer than 200 trucks.",
        "Starting wedge: 20-200 truck operators serving manufacturing shippers.",
        "Expansion: payments, fuel and freight financing on the same workflow.",
      ],
    },
    {
      title: "Business model",
      lines: ["SaaS: Rs 450 per truck per month", "Payments take-rate on freight settlements (pilot)", "CAC payback under 5 months (illustrative)"],
    },
    {
      title: "Team",
      lines: ["Vikram, founder: ex-operations at a national 3PL", "CTO: built routing systems at a mobility company", "8-person team in Bengaluru"],
    },
    {
      title: "The ask",
      lines: ["Raising a seed round to reach 400 fleets and Rs 3 Cr ARR in 18 months", "Use of funds: sales in 3 freight corridors, payments product, team", "Contact: Vikram"],
    },
  ],
};
