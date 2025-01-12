import { createClient } from "@supabase/supabase-js"
import { PUBLIC_SUPABASE_URL, PUBLIC_SUPABASE_ANON_KEY } from "$env/static/public"


  const supabase = createClient(PUBLIC_SUPABASE_URL, PUBLIC_SUPABASE_ANON_KEY)

export const defaultPlanId = 1

// export const pricingPlans = async () => {
//   console.log("FETCHING PLANS")
//   const { data:allPlans, error } = await supabase
//     .from("plans")
//     .select("*")
//     .order("price", { ascending: true })
// console.log("FETCHED PLANS",allPlans)
//   if (error) {
//     console.error(error)
//   }

//   return allPlans
// }



export const getPricingPlans = async () => {
  console.log("----------FETCHING INNNN PRICING PLANS")
  const { data: pricingPlans, error } = await supabase
    .from("plans")
    .select("*")
    .order("price", { ascending: true })
  console.log("----------FETCHED PRICING PLANS")
  if (error) {
    return { error }
  }


  return { pricingPlans }
}

export const { pricingPlans} = await getPricingPlans()


// export const pricingPlans = [
//   {
//     id: "free",
//     name: "Basic Plan",
//     description: "A free plan to get you started!",
//     price: "$0",
//     priceIntervalName: "per month",
//     stripe_price_id: null,
//     features: ["MIT Licence", "Fast Performance", "Stripe Integration"],
//   },
//   {
//     id: "pro",
//     name: "Standard Plan",
//     description:
//       "A plan to test the purchase experience. Try buying this with the test credit card 4242424242424242.",
//     price: "$15",
//     priceIntervalName: "per month",
//     stripe_price_id: "price_1OlCPXCAHU0k78s7CnlrWAKi",
//     stripe_product_id: "prod_PaN9rdzhChcz7L",
//     features: [
//       "Everything in Free",
//       "Support us with fake money",
//       "Test the purchase experience",
//     ],
//   },
//   {
//     id: "enterprise",
//     name: "Premium Plan",
//     description:
//       "A plan to test the upgrade expereince. Try buying this with the test credit card 4242424242424242.",
//     price: "$30",
//     priceIntervalName: "per month",
//     stripe_price_id: "price_1OlCQ3CAHU0k78s7NWy3RGEe",
//     stripe_product_id: "prod_PaNAJpD9OzIS2H",
//     features: [
//       "Everything in Pro",
//       "Try the 'upgrade plan' UX",
//       "Still actually free!",
//     ],
//   },
// ]