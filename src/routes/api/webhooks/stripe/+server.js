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


        // Handle the event type Invoice Payment Succeeded

        if (event.type === 'invoice.payment_succeeded') {

            console.log("WEBHOOK EVENT INVOICE PAYMENT SUCCEEDED")
            const invoice = event.data.object
            const planId = invoice.lines.data[0].plan.product




            // Get plans from plans table in supabase
            const { data: plan, error: plansError } = await supabaseServiceRole
                .from('plans')
                .select('id, credits')
                .eq('stripe_product_id', planId)
                .single();

            //define plan credits
            const planCredits = plan.credits
            console.log("PLAN CREDITS", planCredits)


            // Retrieve customer ID from the event
            const customerId = invoice.customer;

            console.log("STRIPE CUSTOMER ID", customerId)
            // Reset credits for the customer in the database
            const { error } = await supabaseServiceRole
                .from('stripe_customers') // Your users table
                .update({ credits: planCredits }) // Reset credits to 100 (example value)
                .eq('stripe_customer_id', customerId); // Match the Stripe customer ID

            if (error) {
                console.error('Error updating user credits:', error);
                return json({ error: 'Failed to update user credits' }, { status: 500 });
            }

            console.log('User credits reset successfully.');
        }


        // Handle the event type Invoice Payment Failed

        if (event.type === 'invoice.payment_failed') {

            console.log("WEBHOOK EVENT INVOICE PAYMENT FAILED")
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

        // Handle the event type Subscription Created

        if (event.type === 'customer.subscription.created') {
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
                .select('name, credits,price') //select plan name and credits
                .eq('stripe_product_id', planId)
                .eq('stripe_price_id', priceId)
                .single();

            //define plan name, price and credits
            const price = plans.price
            const planName = plans.name
            const planCredits = plans.credits




            const billingCycle = subscription.items.data[0].plan.interval



            // Reset credits for the customer in the database
            const { error } = await supabaseServiceRole
                .from('stripe_customers') // Your users table
                .update({ billing_cycle: billingCycle, stripe_subscription_id: subscriptionId, plan: planName, total_credits: planCredits, price: price }) // Reset credits to 100 (example value)
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
