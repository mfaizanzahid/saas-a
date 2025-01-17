import cron from 'node-cron';
import { resetCredits } from './resetCredits.js'

// Schedule the job to run at midnight every day

// cron.schedule('0 0 * * *', async () => {              //daily at midnight

//schedule to run every 5 minutes for testing
cron.schedule('*/2 * * * *', async () => {            //every 5 minutes


    // cron.schedule('* * * * *', async () => {            //every minute
    console.log('Running CRON daily credits reset  ...')
    const result = await resetCredits()
    if (result.success) {
        console.log('Daily credits reset completed successfully.')
    } else {
        console.error('Daily credits reset encountered an error:', result.error)
    }
});
