import Anthropic from '@anthropic-ai/sdk';

const anthropic = new Anthropic({
  
});

export async function createAnthropicMessage(formData) {
  const { businessDescription, targetAudience, wordCount, objective, numEmails, isBreakupEmail, breakupReason, creativity, problemFocus, solution, emailToRewrite } = formData;

  const messages = [{ role: 'user', content: `What does ${businessDescription} do?` }];

  const message = await anthropic.messages.create({
    max_tokens: 1024,
    messages,
    model: 'claude-instant-1.2',
  });

  return message.content;
}





// import Anthropic from '@anthropic-ai/sdk';
// import { PRIVATE_ANTHROPIC_API_KEY } from "$env/static/private";


// const anthropic = new Anthropic({
//   apiKey: PRIVATE_ANTHROPIC_API_KEY,
// });

// export async function createAnthropicMessage(formData) {
//   const { businessDescription, targetAudience, wordCount, objective, numEmails, isBreakupEmail, breakupReason, creativity, problemFocus, solution, emailToRewrite } = formData;

//   const messages = [{ role: 'user', content: `Business Description: ${businessDescription}\nTarget Audience: ${targetAudience}\nWord Count: ${wordCount}\nObjective: ${objective}\nNum Emails: ${numEmails}\nIs Breakup Email: ${isBreakupEmail}\nBreakup Reason: ${breakupReason}\nCreativity: ${creativity}\nProblem Focus: ${problemFocus}\nSolution: ${solution}\nEmail to Rewrite: ${emailToRewrite}` }];

//   const message = await anthropic.messages.create({
//     max_tokens: 1024,
//     messages,
//     model: "claude-instant-1.2",
//   });

//   return message.content;
// }
