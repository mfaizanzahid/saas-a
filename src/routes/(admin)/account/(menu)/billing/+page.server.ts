import { redirect, error } from "@sveltejs/kit"
import {
  getOrCreateCustomerId,
  fetchSubscription,
} from "../../subscription_helpers.server"
import type { PageServerLoad } from "./$types"

export const load: PageServerLoad = async ({
  locals: { getSession, supabaseServiceRole },
}) => {
  const session = await getSession()
  if (!session) {
    throw redirect(303, "/login")
  }

  let { error: idError, customerId, customerCredits, customerPlan, customerPrice } = await getOrCreateCustomerId({
    supabaseServiceRole,
    session,
  })
  if (idError || !customerId) {
    throw error(500, {
      message: "Unknown error. If issue persists, please contact us.",
    })
  }
console.log("FETCHING SUBSCRIPTION FOR CUSTOMER", customerId)
  const {
    primarySubscription,
    hasEverHadSubscription,
    error: fetchErr,
  } = await fetchSubscription({
    customerId,
    supabaseServiceRole,
    userId: session.user.id,
    userEmail: session.user.email,
    
  })
  if (fetchErr) {
    throw error(500, {
      message: "Unknown error. If issue persists, please contact us.",
    })
  }

  return {
    isActiveCustomer: !!primarySubscription,
    hasEverHadSubscription,
    currentPlanId: primarySubscription?.appSubscription?.id,
    customerCredits,
    customerPlan,
    customerPrice,
  }
}
