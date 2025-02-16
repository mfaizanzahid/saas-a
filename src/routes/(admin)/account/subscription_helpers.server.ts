// import { pricingPlans } from "../../(marketing)/pricing/pricing_plans"
import { pricingPlansPromise } from "../../(marketing)/pricing/pricing_plans"
import { PRIVATE_STRIPE_API_KEY } from "$env/static/private"
import Stripe from "stripe"
const stripe = new Stripe(PRIVATE_STRIPE_API_KEY, { apiVersion: "2023-08-16" })

let pricingPlans = []
  let error = null

  // Fetch the pricing plans when the component is created
  async function loadPricingPlans() {
    const result = await pricingPlansPromise
    if (result.error) {
      error = result.error
    } else {
      pricingPlans = result.pricingPlans
      console.log("PRICING PLANS", pricingPlans)
    }
  }

  loadPricingPlans()
  

export const getOrCreateCustomerId = async ({
  supabaseServiceRole,
  session,
  missingStripeCustomer = false,
}) => {
  const { data: dbCustomer, error } = await supabaseServiceRole
    .from("stripe_customers")
    .select("*")
    .eq("user_id", session.user.id)
    .single()

  if (error && error.code != "PGRST116") {
    // PGRST116 == no rows
    return { error: error }
  }

  if (dbCustomer?.stripe_customer_id && !missingStripeCustomer) {
console.log("FOUND CUSTOMER ID IN SUPABASE", dbCustomer.stripe_customer_id)
    // if (!dbCustomer.billing_cycle) {
    //   //fetch the subscription from stripe api
    //   const subscription = await stripe.subscriptions.retrieve(dbCustomer.stripe_customer_id)
    //   dbCustomer.billing_cycle = subscription.billing_cycle_anchor
    // }

      

    return { customerId: dbCustomer.stripe_customer_id, customerCredits: dbCustomer.credits, totalCredits: dbCustomer.total_credits, customerPlan: dbCustomer.plan, customerPrice: dbCustomer.price, customerPlanId:dbCustomer.plan_id }
  }
console.log("NO CUSTOMER ID FOUND IN SUPABASE----CREATING NEW CUSTOMER IN STRIPE")
  // Fetch data needed to create customer
  let { data: profile, error: profileError } = await supabaseServiceRole
    .from("profiles")
    .select(`full_name, website, company_name`)
    .eq("id", session.user.id)
    .single()
  if (profileError) {
    return { error: profileError }
  }

  // Create a stripe customer
  let customer
  try {
    customer = await stripe.customers.create({
      email: session.user.email,
      name: profile.data?.full_name ?? "",
      metadata: {
        user_id: session.user.id,
        company_name: profile.data?.company_name ?? "",
        website: profile.data?.website ?? "",
      },
    })
    console.log("CREATED CUSTOMER IN STRIPE", customer.id)
  } catch (e) {
    return { error: e }
  }

  if (!customer.id) {
    return { error: "Unknown stripe user creation error" }
  }







console.log("FETCHING FREE PLAN FROM SUPABASE")
  //In supabase table "plans" find the free plan with id 1 and get the credits and price for it
  const { data: plan, error: planError } = await supabaseServiceRole
    .from("plans")
    .select("*")
    .eq("id", 1)
    .single()
  if (planError) {
    return { error: planError }
  }

  //set variables for the credits and price of the free plan
  const credits = plan.credits
  const price = plan.price
  const planId = plan.id
  const planName = plan.name 
  const billingCycle = plan.billing_cycle
console.log("FREE PLAN CREDITS", credits, "FREE PLAN PRICE", price, "FREE PLAN ID", planId, "FREE PLAN NAME", planName, "FREE PLAN BILLING CYCLE", billingCycle)


if (missingStripeCustomer) {
  return { customerId: customer.id, customerCredits: credits, totalCredits: credits, customerPlan: planName, customerPrice: price, customerPlanId: planId, billingCycle: billingCycle }
}
console.log("INSERTING CUSTOMER IN SUPABASE")
  // insert instead of upsert so we never over-write. PK ensures later attempts error.
  const { insertError } = await supabaseServiceRole
    .from("stripe_customers")
    .insert({
      user_id: session.user.id,
      stripe_customer_id: customer.id,
      updated_at: new Date(),
      activated_at: new Date(),
      activated_day: new Date().getDate(),
      credits: credits,
      total_credits: credits,
      price: price,
      billing_cycle: billingCycle,
      email: session.user.email,
      plan_id: planId,
      plan: planName,
    })

  if (insertError) {
    return { error: insertError }
  }

  return { customerId: customer.id }
}

async function addMissingStripeCustomer({ supabaseServiceRole, session }) {
  const userId = session.user.id;
  const userEmail = session.user.email;

  console.log("CUSTOMER NOT FOUND IN STRIPE");
  console.log("CREATING CUSTOMER IN STRIPE WITH NEW EMAIL");
  const customer = await getOrCreateCustomerId({
    supabaseServiceRole,
    session: { user: { id: userId, email: userEmail } },
    missingStripeCustomer: true,
  });

  

  // Update stripe customer id, plan, plan_id, billing_cycle, price, credits, total_credits  in supabase for this user
  console.log("UPDATING STRIPE CUSTOMER ID IN SUPABASE",customer.customerId);
  const { data: updateStripeCustomer, error: updateError } = await supabaseServiceRole
    .from("stripe_customers")
    .update({ stripe_customer_id: customer.customerId, plan: customer.customerPlan, plan_id: customer.customerPlanId, billing_cycle: customer.billingCycle, price: customer.customerPrice, credits: customer.customerCredits, total_credits: customer.totalCredits, activated_at: new Date(), activated_day: new Date().getDate() })
    .eq("user_id", userId)
    .select()
    .single();

  if (updateError) {

    return { error: updateError };
  }
  

  console.log(
    "UPDATED STRIPE CUSTOMER ID IN SUPABASE",
    updateStripeCustomer.stripe_customer_id
  );

  return { customerId: customer.customerId }
}

export const fetchSubscription = async ({
  supabaseServiceRole,
  userEmail,
  userId,
  customerId,
}) => {

console.log("FETCHING SUBSCRIPTION", userId, customerId)
  //fetch customer email from stripe 

  let customer;
try {
  customer = await stripe.customers.retrieve(customerId);
  
const stripeEmail = customer.email;
console.log("CURRENT SESSION EMAIL ADDRESS", userEmail, "CURRENT STRIPE EMAIL ADDRESS", stripeEmail);

if (!customer?.email) {
  console.log("CUSTOMER EMAIL NOT FOUND IN STRIPE");
  return addMissingStripeCustomer({
    supabaseServiceRole,
    session: { user: { id: userId, email: userEmail } },
  });
}


// If email does not equal to user session email then update customer email in stripe
if (stripeEmail !== userEmail) {
  console.log("UPDATING CUSTOMER EMAIL IN STRIPE");

  try {
    const updatedCustomer = await stripe.customers.update(customerId, {
      email: userEmail,
    });
    console.log("UPDATED CUSTOMER EMAIL IN STRIPE", updatedCustomer.email);
  } catch (error) {
    console.log("ERROR UPDATING CUSTOMER EMAIL IN STRIPE", error);
  }

  // Update email in stripe_customers table in supabase for this user with stripe_customer_id equal to customerId
  console.log("UPDATING CUSTOMER EMAIL IN SUPABASE");
  const { data: updatedCustomer, error: updateError } = await supabaseServiceRole
    .from("stripe_customers")
    .update({ email: userEmail })
    .eq("stripe_customer_id", customerId);

  if (updateError) {
    console.log("ERROR UPDATING CUSTOMER EMAIL IN SUPABASE", updateError);
  } else {
    console.log("UPDATED CUSTOMER EMAIL IN SUPABASE", updatedCustomer.email);
  }
}
} catch (error) {
  console.log("ERROR FETCHING CUSTOMER IN STRIPE", error);
  if (error.code === "resource_missing") {
    console.log("CUSTOMER NOT FOUND IN STRIPE");
    return addMissingStripeCustomer({
      supabaseServiceRole,
      session: { user: { id: userId, email: userEmail } },
    });
  }
}






  console.log("----------FETCH SUBSCRIPTION", userId, customerId)
  // Fetch user's subscriptions
  let stripeSubscriptions
  try {
    stripeSubscriptions = await stripe.subscriptions.list({
      customer: customerId,
      limit: 100,
      status: "all",
    })
  } catch (e) {
    return { error: e }
  }

  // find "primary". The user may have several old ones, we want an active one (including trials, and past_due in grace period).
  let primaryStripeSubscription = stripeSubscriptions.data.find((x) => {
    return (
      x.status === "active" ||
      x.status === "trialing" ||
      x.status === "past_due"
    )
  })
  let appSubscription = null
  if (primaryStripeSubscription) {
    let productId =
      primaryStripeSubscription?.items?.data?.[0]?.price.product ?? ""
    appSubscription = pricingPlans.find((x) => {
      return x.stripe_product_id === productId
    })
    if (!appSubscription) {
      return {
        error:
          "Stripe subscription does not have matching app subscription in pricing_plans.ts (via product id match)",
      }
    }
  }
  let primarySubscription = null
  if (primaryStripeSubscription && appSubscription) {
    primarySubscription = {
      stripeSubscription: primaryStripeSubscription,
      appSubscription: appSubscription,
    }
  }

  let hasEverHadSubscription = stripeSubscriptions.data.length > 0
  // console.log("PRIMARY SUBSCRIPTION", primarySubscription)
  return {
    primarySubscription,
   
    hasEverHadSubscription,
  }
}
