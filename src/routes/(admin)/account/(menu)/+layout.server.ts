import { redirect, error } from "@sveltejs/kit"
import {
  getOrCreateCustomerId,
} from "../subscription_helpers.server"
import type { PageServerLoad } from "./$types"

export const load: PageServerLoad = async ({ depends, locals: { getSession, supabaseServiceRole } }) => {
  // Declare the dependency
  depends('app:customerData');

  const session = await getSession()
  if (!session) {
    throw redirect(303, "/login")
  }

  let { error: idError, customerId, customerCredits, totalCredits, customerPlan, customerPrice } = await getOrCreateCustomerId({
    supabaseServiceRole,
    session,
  })
  if (idError || !customerId) {
    throw error(500, {
      message: "Unknown error. If issue persists, please contact us.",
    })
  }

  return {
 totalCredits,
    customerCredits,
    customerPlan,
    customerPrice,
  }
}
