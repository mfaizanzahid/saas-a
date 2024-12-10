// src/routes/api/anthropic.ts

import Anthropic from '@anthropic-ai/sdk';

const anthropic = new Anthropic({
 
});

export async function post(request) {
  try {
    const formData = JSON.parse(request.body);
    
    const messages = [
      {
        role: 'user',
        content: `Business Description: ${formData.businessDescription}\n...`,
      },
    ];

    const message = await anthropic.messages.create({
      max_tokens: 1024,
      messages,
      model: 'claude-instant-1.2'
    });

    return {
      status: 200,
      body: JSON.stringify({ reply: message.content }),
    };
  } catch (error) {
    return {
      status: 500,
      body: JSON.stringify({ error: 'Error processing Anthropic request' }),
    };
  }
}
