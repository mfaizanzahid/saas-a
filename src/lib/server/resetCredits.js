import { supabaseServiceRoleCron } from '../../hooks.server';


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

        return  new Date(Date.UTC(todayYear, activationMonth, validDay));
    }
}

export async function resetCredits() {

    console.log('Running resetCredits...')


    const today = new Date();
    const todayDate = today.getDate(); // Today's day of the month
    
    
    console.log("TODAY",today)


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

console.log("BILLING CYCLE",billingCycle)
console.log("ACTIVATED AT",activatedAt)

        if (billingCycle === 'month' && customerPlan === 'Basic Plan') {

            const resetDate = getDynamicResetDate(activatedAt, 'month', today);
            console.log("MONTHLY RESET DATE",resetDate)
            if (resetDate.toDateString() === today.toDateString()) {
                // const newCredits = customer.plan === 'Basic Plan' ? customer.total_credits : 0;
                // console.log("NEW CREDITS",newCredits)


                // Reset credits for monthly BASIC customers
                const { data:reset, error: updateError } = await supabaseServiceRoleCron
                    .from('stripe_customers')
                    .update({
                        credits: customer.total_credits,
                    })
                    .eq('user_id', customer.user_id);

                    console.log("RESET DATA",reset)

                if (updateError) {
                    console.error(`Error resetting credits for customer ${customer.user_id} (monthly):`, updateError);
                } else {
                    console.log(`Successfully reset credits for customer ${customer.user_id} (monthly).`);
                }
            }
        } else if (billingCycle === 'year') {
            // Reset monthly credits for yearly customers
            const monthlyResetDate = getDynamicResetDate(activatedAt, 'month', today);
            console.log("MONTHLY RESET DATE",monthlyResetDate)

            if (monthlyResetDate.toDateString() === today.toDateString()) {
                
                const { data:reset, error: monthlyUpdateError } = await supabaseServiceRoleCron
                    .from('stripe_customers')
                    .update({
                        credits: customer.total_credits, // Reset to total credits monthly
                    })
                    .eq('user_id', customer.user_id);

                    console.log("RESET DATA",reset)

                if (monthlyUpdateError) {
                    console.error(`Error resetting monthly credits for customer ${customer.user_id} (yearly):`, monthlyUpdateError);
                } else {
                    console.log(`Successfully reset monthly credits for customer ${customer.user_id} (yearly).`);
                }
            }

            // // Check for annual reset
            // const annualResetDate = getDynamicResetDate(activatedAt, 'year', today);
            // console.log("ANNUAL RESET DATE",annualResetDate)

            // if (annualResetDate.toDateString() == today.toDateString()) {
            //     const { data:reset, error: annualUpdateError } = await supabaseServiceRoleCron
            //         .from('stripe_customers')
            //         .update({
            //             credits: 0, // Reset to zero
            //         })
            //         .eq('user_id', customer.user_id);

            //         console.log("RESET DATA",reset)

            //     if (annualUpdateError) {
            //         console.error(`Error resetting annual credits for customer ${customer.user_id} (yearly):`, annualUpdateError);
            //     } else {
            //         console.log(`Successfully reset annual credits for customer ${customer.user_id} (yearly).`);
            //     }
            // }


        }
    }

    return { success: true };
}




// export async function resetCredits() {

//     console.log('Running resetCredits...')

//     const today = new Date().toISOString().split('T')[0]; // Get today's date in YYYY-MM-DD format
//  console.log("TODAY",today)
//     // Fetch customers whose renewal_date is past today's date and credits are greater than 0

//     const { data: customers, error } = await supabaseServiceRoleCronServiceRoleCron
//         .from('stripe_customers')
//         .select('*')
//         .lte('renewal_date', today) // Renewal date is less than or equal to today
//         .gt('credits', 0); // Credits are greater than 0

//         //if customers is empty log it
//         if(customers.length === 0){
//             console.log("NO CUSTOMERS")
//         }

//     if (error) {
//         console.error('Error fetching customers:', error);
//         return { success: false, error: error.message };
//     }

//     // Update credits and renewal_date for each customer
//     for (const customer of customers) {
//         const newCredits = customer.plan === 'Basic Plan' ? 25 : 0; // Determine new credits
//         // const newRenewalDate = customer.plan === 'Basic Plan' 
//         //     ? new Date(new Date().setDate(new Date().getDate() + 29)).toISOString().split('T')[0] 
//         //     : customer.renewal_date; // Update renewal date if Basic Plan
//         const newRenewalDate = new Date(new Date().setDate(new Date().getDate() + 29)).toISOString().split('T')[0]

//         const { error: updateError } = await supabaseServiceRoleCronServiceRoleCron
//             .from('stripe_customers')
//             .update({ credits: newCredits, renewal_date: newRenewalDate })
//             .eq('user_id', customer.user_id); // Update by customer ID

//         if (updateError) {
//             console.error(`Error updating customer ${customer.user_id}:`, updateError);
//         } else {
//             console.log(`Successfully updated customer ${customer.user_id}.`);
//         }
//     }

//     return { success: true };
// }


