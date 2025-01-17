<script lang="ts">
  // import { pricingPlans } from "./pricing_plans"
  import { pricingPlansPromise } from "./pricing_plans"

  // Module context
  export const highlightedPlanId: string = ""
  export let callToAction: string
  export let currentPlanId: string = ""
  export let center = true

  let billingCycle = "month"
  let highlightPlanIdA = "2"
  let highlightPlanIdB = "5"

  function toggleBillingCycle() {
    billingCycle = billingCycle === "month" ? "year" : "month"
  }

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
</script>

<div
  class="flex flex-col lg:flex-row gap-10 {center
    ? 'place-content-center'
    : ''} flex-wrap"
>
  <div class="flex-none w-full mb-6">
    <label class="flex justify-center items-center">
      <span class="mr-2 text-sm text-gray-600">Monthly</span>
      <input type="checkbox" class="toggle" on:change={toggleBillingCycle} />
      <span class="ml-2 text-sm text-gray-600">Yearly (20% off)</span>
    </label>
  </div>

  {#each pricingPlans as plan}
    <!-- Always show the Free Plan -->
    {#if plan.id === 1 || plan.billing_cycle === billingCycle}
      <div
        class="flex-none card card-bordered {plan.id == highlightPlanIdA ||
        plan.id == highlightPlanIdB
          ? 'border-primary'
          : 'border-gray-200'} shadow-xl flex-1 flex-grow min-w-[260px] max-w-[310px] p-6"
      >
        <div class="flex flex-col h-full">
          <div class="text-xl font-bold">{plan.name}</div>
          <p class="mt-2 text-sm text-gray-500 leading-relaxed">
            {plan.description}
          </p>
          <div class="mt-auto pt-4 text-sm text-gray-600">
            Plan Includes:
            <ul class="list-disc list-inside mt-2 space-y-1">
              {#each plan.features as feature}
                <li class="">{feature}</li>
              {/each}
              <ul></ul>
            </ul>
          </div>
          <div class="pt-8">
            <span class="text-4xl font-bold">${plan.price}</span>
            <!-- <span class="text-gray-400">{plan.priceIntervalName}</span> -->
            <span class="text-gray-400"
              >per month
              <!-- {plan.billing_cycle} -->
            </span>
            <div class="mt-6 pt-4 flex-1 flex flex-row items-center">
              {#if plan.id === currentPlanId}
                <div
                  class="btn btn-outline btn-success no-animation w-[80%] mx-auto cursor-default"
                >
                  Current Plan
                </div>
              {:else}
                <a
                  href={"/account/subscribe/" +
                    (plan?.stripe_price_id ?? "free_plan")}
                  class="btn btn-primary w-[80%] mx-auto"
                >
                  {callToAction}
                </a>
              {/if}
            </div>
          </div>
        </div>
      </div>
    {/if}
  {/each}
</div>
