import { json } from '@sveltejs/kit';
import { PRIVATE_STRIPE_API_KEY, STRIPE_WEBHOOK_SECRET } from "$env/static/private"
import Stripe from "stripe"
const stripe = new Stripe(PRIVATE_STRIPE_API_KEY, { apiVersion: "2023-08-16" })


export async function POST({ request, locals: { supabaseServiceRole } }) {
    const payload = await request.text();
    const sig = request.headers.get('stripe-signature');
    // console.log("PAYLOAD STRIPE")
    try {
        const event = stripe.webhooks.constructEvent(
            payload,
            sig,
            // 'whsec_lMaIzq9SdUk2OnZqDUqy2BLN823Hw4yQ'
            STRIPE_WEBHOOK_SECRET
        );
        // console.log("STRIPE EVENT")


        // Handle the event type Invoice Payment Succeeded For Subscription Cycle --------------------------------------

        if (event.type === 'invoice.payment_succeeded' && event.data.object.billing_reason === 'subscription_cycle') {
            await new Promise(resolve => setTimeout(resolve, 2000));

            console.log("WEBHOOK EVENT INVOICE PAYMENT SUCCEEDED FOR SUBSCRIPTION CYCLE")
            const invoice = event.data.object
            // const priceId = invoice.lines.data[0].plan.id

            // console.log("PLAN ID", priceId)
            // // Get plans from plans table in supabase
            // const { data: plan, error: plansError } = await supabaseServiceRole
            //     .from('plans')
            //     .select('id, credits')
            //     .eq('stripe_price_id', priceId)
            //     .single();

            // //define plan credits
            // const planCredits = plan.credits
            // console.log("PLAN CREDITS", planCredits)


            // Retrieve customer ID from the event
            const customerId = invoice.customer;

            console.log("STRIPE CUSTOMER ID", customerId)

            //Get total_credits from stripe_customers table
            const { data: customerData, error: customerError } = await supabaseServiceRole
                .from('stripe_customers')
                .select('total_credits')
                .eq('stripe_customer_id', customerId)
                .single();

            //define total_credits
            const total_credits = customerData.total_credits

            console.log("TOTAL CREDITS", total_credits)


            // Reset credits for the customer in the database


            //add 1 second delay to avoid concurrent updates



            const { data: customer, error } = await supabaseServiceRole
                .from('stripe_customers') // Your users table
                .update({ credits: total_credits }) // Reset credits to total_credits value
                .eq('stripe_customer_id', customerId); // Match the Stripe customer ID

            if (error) {
                console.error('Error updating user credits:', error);
                return json({ error: 'Failed to update user credits' }, { status: 500 });
            }

            console.log('User credits reset successfully.');
        }


        // Handle the event type Invoice Payment Failed For Subscription Cycle --------------------------------------------

        if (event.type === 'invoice.payment_failed' && event.data.object.billing_reason === 'subscription_cycle') {

            console.log("WEBHOOK EVENT INVOICE PAYMENT FAILED FOR SUBSCRIPTION CYCLE")
            const invoice = event.data.object;

            // Retrieve customer ID from the event
            const customerId = invoice.customer;
            console.log("STRIPE CUSTOMER ID", customerId)
            // Reset credits for the customer in the database
            const { error } = await supabaseServiceRole
                .from('stripe_customers') // Your users table
                .update({ credits: 0 }) // Reset credits to 100 (example value)
                .eq('stripe_customer_id', customerId); // Match the Stripe customer ID

            if (error) {
                console.error('Error updating user credits:', error);
                return json({ error: 'Failed to update user credits' }, { status: 500 });
            }

            console.log('User credits reset to ZERO successfully.');
        }

        // Handle the event type Customer Subscription Deleted--------------------------------------------------------

        if (event.type === 'customer.subscription.deleted') {

            console.log("WEBHOOK EVENT CUSTOMER SUBSCRIPTION DELETED")
            const invoice = event.data.object;

            // Retrieve customer ID from the event
            const customerId = invoice.customer;
            console.log("STRIPE CUSTOMER ID", customerId)

            //fetch free plan credits from plans table
            const { data: plans, error: plansError } = await supabaseServiceRole
                .from('plans')
                .select('id, name, credits, price')
                .eq('id', 1)
                .single();

            //define Free Plan name, credits and price
            const freePlanName = plans.name
            const freePlanCredits = plans.credits
            const freePlanPrice = plans.price
            const freePlanId = plans.id
            console.log("FREE PLAN CREDITS", freePlanCredits)

            // Reset credits for the customer in the database
            const { error } = await supabaseServiceRole
                .from('stripe_customers') // Your users table
                .update({
                    plan: freePlanName,
                    total_credits: freePlanCredits,
                    credits: freePlanCredits,
                    price: freePlanPrice,
                    plan_id: freePlanId,
                }) // Reset credits to 100 (example value)
                .eq('stripe_customer_id', customerId); // Match the Stripe customer ID

            if (error) {
                console.error('Error updating user credits:', error);
                return json({ error: 'Failed to update user credits' }, { status: 500 });
            }

            console.log('User credits reset to ZERO successfully.');
        }

        // Handle the event type Subscription Created------------------------------------------

        if (event.type === 'customer.subscription.created' && event.data.object.pending_update === null) {
            console.log("WEBHOOK EVENT NEW SUBSCRIPTION CREATED")


            // Retrieve customer ID from the event
            const subscription = event.data.object;
            // console.log("NEW SUBSCRIPTION CREATED",subscription)
            const subscriptionId = subscription.id;
            const customerId = subscription.customer;
            console.log("STRIPE CUSTOMER ID", customerId)

            // const plan = subscription.items.data[0].plan
            // console.log("PLAN--------",plan)

            // const planId = subscription.items.data[0].plan.product
            // const priceId = subscription.items.data[0].plan.id

            const planId = subscription.plan.product
            const priceId = subscription.plan.id
            // console.log("PLAN ID",planId)
            // console.log("PRICE ID",priceId)

            //fetch plan name and credits from plans table
            const { data: plans, error: plansError } = await supabaseServiceRole
                .from('plans')
                .select('id, name, credits,price') //select plan name and credits
                // .eq('stripe_product_id', planId)
                .eq('stripe_price_id', priceId)
                .single();

            //define plan name, price and credits
            const price = plans.price
            const planId = plans.id
            const planName = plans.name
            const planCredits = plans.credits




            // const billingCycle = subscription.items.data[0].plan.interval
            const billingCycle = subscription.plan.interval



            // Update the customer in the database
            const { error } = await supabaseServiceRole
                .from('stripe_customers') // Your users table
                .update({ plan_id: planId, billing_cycle: billingCycle, stripe_subscription_id: subscriptionId, plan: planName, credits: planCredits, total_credits: planCredits, price: price }) // Reset credits to 100 (example value)
                .eq('stripe_customer_id', customerId); // Match the Stripe customer ID

            if (error) {
                console.error('Error updating user credits:', error);
                return json({ error: 'Failed to update user credits' }, { status: 500 });
            }

            console.log('User Subscription Updated successfully.');
        }


        // Handle the event type Subscription Updated-------------------------------------------------------

        if (event.type === 'customer.subscription.updated' && event.data.object.pending_update === null) {
            console.log("WEBHOOK EVENT NEW SUBSCRIPTION UPDATED")


            // Retrieve customer ID from the event
            const subscription = event.data.object;
            // console.log("NEW SUBSCRIPTION CREATED",subscription)
            const subscriptionId = subscription.id;
            const customerId = subscription.customer;
            console.log("STRIPE CUSTOMER ID", customerId)

            const planId = subscription.plan.product
            const priceId = subscription.plan.id
            // console.log("PLAN ID",planId)
            // console.log("PRICE ID",priceId)

            //fetch plan name and credits from plans table
            const { data: plans, error: plansError } = await supabaseServiceRole
                .from('plans')
                .select('id,name, credits, price') //select plan name and credits
                // .eq('stripe_product_id', planId)
                .eq('stripe_price_id', priceId)
                .single();

            //define plan name, price and credits
            const price = plans.price
            const planId = plans.id
            const planName = plans.name
            const planCredits = plans.credits




            const billingCycle = subscription.plan.interval



            // Update the customer in the database
            const { error } = await supabaseServiceRole
                .from('stripe_customers') // Your users table
                .update({ plan_id: planId, billing_cycle: billingCycle, stripe_subscription_id: subscriptionId, plan: planName, total_credits: planCredits, credits: planCredits, price: price }) // Reset credits to 100 (example value)
                .eq('stripe_customer_id', customerId); // Match the Stripe customer ID

            if (error) {
                console.error('Error updating user credits:', error);
                return json({ error: 'Failed to update user credits' }, { status: 500 });
            }

            console.log('User Subscription Updated successfully.');
        }



        return json({ received: true });
    } catch (err) {
        console.error(`Webhook signature verification failed: ${err.message}`);
        return json({ error: 'Webhook signature verification failed' }, { status: 400 });
    }
}
