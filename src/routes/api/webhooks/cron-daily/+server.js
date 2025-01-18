import { PRIVATE_CRON_SECRET } from "$env/static/private"
import { resetCredits } from '../../../../lib/server/resetCredits.js'

const AUTH_TOKEN = PRIVATE_CRON_SECRET;

export async function POST({ request }) {
    const token = request.headers.get("Authorization");

    if (token !== `Bearer ${AUTH_TOKEN}`) {
        return new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401 });
    }

    // Perform the scheduled task logic here
    console.log('Running task at midnight')



    // cron.schedule('* * * * *', async () => {            //every minute
    console.log('Running CRON daily credits reset  ...')
    const result = await resetCredits()
    if (result.success) {
        console.log('Daily credits reset completed successfully.')
    } else {
        console.error('Daily credits reset encountered an error:', result.error)
    }

    return new Response(JSON.stringify({ status: "success" }), { status: 200 });
}
