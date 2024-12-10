// import { redirect, error } from '@sveltejs/kit';
// import Anthropic from '@anthropic-ai/sdk';
// import { PRIVATE_ANTHROPIC_API_KEY } from "$env/static/private";

// const anthropic = new Anthropic({
//   apiKey: PRIVATE_ANTHROPIC_API_KEY,
// });

// export const load = async ({ request, resolve }) => {
//   if (request.method !== 'POST') {
//     return redirect('/');
//   }

//   const body = await request.json();

//   try {
//     const reply = await createAnthropicMessage(body);
//     return resolve({
//       status: 200,
//       headers: {
//         'Content-Type': 'application/json',
//       },
//       body: JSON.stringify({ reply }),
//     });
//   } catch (error) {
//     console.error('Error contacting Anthropic API:', error);
//     return error(500, {
//       message: 'Internal Server Error',
//     });
//   }
// };

// // Function to interact with Anthropic API
// async function createAnthropicMessage(formData) {
//   // Anthropic API interaction logic here
//   // Example implementation using the SDK
//   const { businessDescription, targetAudience, wordCount, objective, numEmails, isBreakupEmail, breakupReason, creativity, problemFocus, solution, emailToRewrite } = formData;

//   const messages = [{ role: 'user', content: `Business Description: ${businessDescription}\nTarget Audience: ${targetAudience}\nWord Count: ${wordCount}\nObjective: ${objective}\nNum Emails: ${numEmails}\nIs Breakup Email: ${isBreakupEmail}\nBreakup Reason: ${breakupReason}\nCreativity: ${creativity}\nProblem Focus: ${problemFocus}\nSolution: ${solution}\nEmail to Rewrite: ${emailToRewrite}` }];

//   const message = await anthropic.messages.create({
//     max_tokens: 1024,
//     messages,
//     model: 'claude-2.1',
//   });

//   return message.content;
// }
