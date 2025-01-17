import { supabaseServiceRoleCron } from './hooks.server';

interface Env {
    // Add any environment variables you need here
  }
  
  export default {
    // Your existing fetch handler for HTTP requests
    async fetch(request: Request, env: Env, ctx: ExecutionContext) {
      // Your existing request handling code
    },
  
    // New scheduled handler for cron jobs
    async scheduled(event: ScheduledEvent, env: Env, ctx: ExecutionContext) {
      console.log("Cron job running at:", event.scheduledTime);
      
      try {
        // Use ctx.waitUntil to keep the worker alive until the task completes
        ctx.waitUntil(runScheduledTasks(env));
      } catch (error) {
        console.error("Error in scheduled task:", error);
      }
    }
  };
  
  async function runScheduledTasks(env: Env) {
    // Put your scheduled tasks here
    // For example:
    await Promise.all([
      resetCredits(),

      // ... other tasks
    ]);
  }

  

function getDynamicResetDate(activatedAt, billingCycle, today) {
    const activationDate = new Date(activatedAt);
    const activationDay = activationDate.getDate();
    const activationMonth = activationDate.getMonth();
    const activationYear = activationDate.getFullYear();

    const todayYear = today.getFullYear();
    const todayMonth = today.getMonth();

    if (billingCycle === 'month') {
        // Monthly billing logic
        const nextMonth = todayMonth + 1;
        const nextMonthFirstDay = new Date(todayYear, nextMonth, 1);
        const lastDayOfNextMonth = new Date(nextMonthFirstDay - 1).getDate();
        const validDay = Math.min(activationDay, lastDayOfNextMonth);



        return new Date(Date.UTC(todayYear, todayMonth, validDay));


    } else if (billingCycle === 'year') {
        // Yearly billing logic
        const nextYear = todayYear + 1;
        const firstDayOfActivationMonthNextYear = new Date(nextYear, activationMonth, 1);
        const lastDayOfActivationMonthNextYear = new Date(firstDayOfActivationMonthNextYear - 1).getDate();
        const validDay = Math.min(activationDay, lastDayOfActivationMonthNextYear);

        return new Date(Date.UTC(todayYear, activationMonth, validDay));
    }
}

export async function resetCredits() {

    let logMessages = []


    console.log('Running resetCredits...')


    //add to system_logs table in supabase with message as event_data and event_type as 'resetCredits'

    const { data: logData, error: logError } = await supabaseServiceRoleCron
        .from('system_logs')
        .insert([
            {
                event_type: 'resetCredits',
                event_data: 'Running resetCredits...'
            }
        ]);


    const today = new Date();
    const todayDate = today.getDate(); // Today's day of the month


    console.log("TODAY", today)


    // Fetch customers whose activated_day is less than or equal to today's date
    const { data: customers, error } = await supabaseServiceRoleCron
        .from('stripe_customers')
        .select('*')
        .gte('activated_day', todayDate)
        .lte('activated_day', todayDate + 3)
        .gt('credits', 0); // Credits are greater than 0

    if (error) {
        console.error('Error fetching customers:', error);
        return { success: false, error: error.message };
    }
    // console.log("CUSTOMERS",customers)
    for (const customer of customers) {
        const billingCycle = customer.billing_cycle
        const activatedAt = customer.activated_at
        const customerPlan = customer.plan
        const customerPlanId = customer.plan_id

        console.log("BILLING CYCLE", billingCycle)
        console.log("ACTIVATED AT", activatedAt)

        if (billingCycle === 'month' && customerPlanId === 1) {

            const resetDate = getDynamicResetDate(activatedAt, 'month', today);
            console.log("MONTHLY RESET DATE", resetDate)
            if (resetDate.toDateString() === today.toDateString()) {
                // const newCredits = customer.plan === 'Basic Plan' ? customer.total_credits : 0;
                // console.log("NEW CREDITS",newCredits)


                // Reset credits for monthly BASIC customers
                const { data: reset, error: updateError } = await supabaseServiceRoleCron
                    .from('stripe_customers')
                    .update({
                        credits: customer.total_credits,
                    })
                    .eq('user_id', customer.user_id);

                console.log("RESET DATA", reset)

                if (updateError) {
                    console.error(`Error resetting credits for customer ${customer.user_id} (monthly):`, updateError);

                    //add to logMessages
                    logMessages.push(`Error resetting credits for customer ${customer.user_id} (monthly): ${updateError}`)



                } else {
                    console.log(`Successfully reset credits for customer ${customer.user_id} (monthly).`);
                    //add to logMessages
                    logMessages.push(`Successfully reset credits for customer ${customer.user_id} (monthly).`)

                    // //set logMessage
                    // logMessage = `Successfully reset credits for customer ${customer.user_id} (monthly).`
                }
            }
        } else if (billingCycle === 'year') {
            // Reset monthly credits for yearly customers
            const monthlyResetDate = getDynamicResetDate(activatedAt, 'month', today);
            console.log("MONTHLY RESET DATE", monthlyResetDate)

            if (monthlyResetDate.toDateString() === today.toDateString()) {

                const { data: reset, error: monthlyUpdateError } = await supabaseServiceRoleCron
                    .from('stripe_customers')
                    .update({
                        credits: customer.total_credits, // Reset to total credits monthly
                    })
                    .eq('user_id', customer.user_id);

                console.log("RESET DATA", reset)

                if (monthlyUpdateError) {
                    console.error(`Error resetting monthly credits for customer ${customer.user_id} (yearly):`, monthlyUpdateError);
                    // //set logMessage
                    // logMessage = `Error resetting monthly credits for customer ${customer.user_id} (yearly): ${monthlyUpdateError}`
                    //add to logMessages
                    logMessages.push(`Error resetting monthly credits for customer ${customer.user_id} (yearly): ${monthlyUpdateError}`)
                } else {
                    console.log(`Successfully reset monthly credits for customer ${customer.user_id} (yearly).`);
                    //add to logMessages
                    logMessages.push(`Successfully reset monthly credits for customer ${customer.user_id} (yearly).`)

                    // //set logMessage
                    // logMessage = `Successfully reset monthly credits for customer ${customer.user_id} (yearly).`
                }
            }



        }
    }

    //add to system_logs table in supabase with message as logMessage and event_type as 'resetCredits'
    const { data: logData2, error: logError2 } = await supabaseServiceRoleCron
        .from('system_logs')
        .insert([
            {
                event_type: 'resetCredits',
                event_data: logMessages.length > 0 ? logMessages : "No credits reset"
            }
        ])


    return { success: true };
}

  