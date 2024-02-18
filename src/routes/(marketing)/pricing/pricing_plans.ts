export const defaultPlanId = "free"

export const pricingPlans = [
  {
    id: "free",
    name: "Free",
    description: "A free plan to get you started!",
    price: "$0",
    priceIntervalName: "per month",
    stripe_price_id: null,
    features: ["MIT Licence", "Fast Performance", "Stripe Integration"],
  },
  {
    id: "pro",
    name: "Pro",
    description:
      "A plan to test the purchase experience. Try buying this with the test credit card 4242424242424242.",
    price: "$15",
    priceIntervalName: "per month",
    stripe_price_id: "price_1OlCPXCAHU0k78s7CnlrWAKi",
    stripe_product_id: "prod_PaN9rdzhChcz7L",
    features: [
      "Everything in Free",
      "Support us with fake money",
      "Test the purchase experience",
    ],
  },
  {
    id: "enterprise",
    name: "Enterprise",
    description:
      "AAA plan to test the upgrade expereince. Try buying this with the test credit card 4242424242424242.",
    price: "$30",
    priceIntervalName: "per month",
    stripe_price_id: "price_1OlCQ3CAHU0k78s7NWy3RGEe",
    stripe_product_id: "prod_PaNAJpD9OzIS2H",
    features: [
      "Everything in Pro",
      "Try the 'upgrade plan' UX",
      "Still actually free!",
    ],
  },
]
