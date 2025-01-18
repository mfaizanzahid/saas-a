import { fail, redirect } from "@sveltejs/kit"

import Anthropic from '@anthropic-ai/sdk';
import { PRIVATE_ANTHROPIC_API_KEY } from '$env/static/private';

const anthropic = new Anthropic({
  apiKey: PRIVATE_ANTHROPIC_API_KEY,
});



export const actions = {
  updateEmail: async ({ request, locals: { supabase, getSession } }) => {
    const formData = await request.formData()
    const email = formData.get("email") as string

    let validationError
    if (!email || email === "") {
      validationError = "An email address is required"
    }
    // Dead simple check -- there's no standard here (which is followed),
    // and lots of errors will be missed until we actually email to verify, so
    // just do that
    else if (!email.includes("@")) {
      validationError = "A valid email address is required"
    }
    if (validationError) {
      return fail(400, {
        errorMessage: validationError,
        errorFields: ["email"],
        email,
      })
    }

    const session = await getSession()

    const { error } = await supabase.auth.updateUser({ email: email })

    if (error) {
      return fail(500, {
        errorMessage: "Unknown error. If this persists please contact us.",
        email,
      })
    }

    return {
      email,
    }
  },
/**
 * Handles user password update requests.
 * 
 * This function validates and updates a user's password using the Supabase authentication system.
 * It checks for the existence of a session, validates the new password according to specific criteria,
 * and ensures the current password is correct unless the user is in a password recovery session.
 * 
 * @param {Object} context - Contains request and session-related information.
 * @param {Request} context.request - The incoming request object.
 * @param {Object} context.locals - Local context containing Supabase and session functions.
 * @param {Function} context.locals.supabase - Supabase client for authentication.
 * @param {Function} context.locals.getSession - Function to retrieve the current user session.
 * 
 * @throws Redirects to the login page if no session is found.
 * @throws Redirects to an error page if the current password is incorrect.
 * 
 * @returns {Object} Contains the updated password fields if successful.
 */

  updatePassword: async ({ request, locals: { supabase, getSession } }) => {
    const session = await getSession()
    if (!session) {
      throw redirect(303, "/login")
    }

    const formData = await request.formData()
    const newPassword1 = formData.get("newPassword1") as string
    const newPassword2 = formData.get("newPassword2") as string
    const currentPassword = formData.get("currentPassword") as string

    // Can check if we're a "password recovery" session by checking session amr
    // let currentPassword take priority if provided (user can use either form)
    let recoveryAmr = session.user?.amr?.find((x) => x.method === "recovery")
    const isRecoverySession = recoveryAmr && !currentPassword

    // if this is password recovery session, check timestamp of recovery session
    if (isRecoverySession) {
      let timeSinceLogin = Date.now() - recoveryAmr.timestamp * 1000
      if (timeSinceLogin > 1000 * 60 * 15) {
        // 15 mins in milliseconds
        return fail(400, {
          errorMessage:
            'Recovery code expired. Please log out, then use "Forgot Password" on the sign in page to reset your password. Codes are valid for 15 minutes.',
          errorFields: [],
          newPassword1,
          newPassword2,
          currentPassword: "",
        })
      }
    }

    let validationError
    let errorFields = []
    if (!newPassword1) {
      validationError = "You must type a new password"
      errorFields.push("newPassword1")
    }
    if (!newPassword2) {
      validationError = "You must type the new password twice"
      errorFields.push("newPassword2")
    }
    if (newPassword1.length < 6) {
      validationError = "The new password must be at least 6 charaters long"
      errorFields.push("newPassword1")
    }
    if (newPassword1.length > 72) {
      validationError = "The new password can be at most 72 charaters long"
      errorFields.push("newPassword1")
    }
    if (newPassword1 != newPassword2) {
      validationError = "The passwords don't match"
      errorFields.push("newPassword1")
      errorFields.push("newPassword2")
    }
    if (!currentPassword && !isRecoverySession) {
      validationError =
        "You must include your current password. If you forgot it, sign out then use 'forgot password' on the sign in page."
      errorFields.push("currentPassword")
    }
    if (validationError) {
      return fail(400, {
        errorMessage: validationError,
        errorFields: [...new Set(errorFields)], // unique values
        newPassword1,
        newPassword2,
        currentPassword,
      })
    }

    // Check current password is correct before updating, but only if they didn't log in with "recover" link
    // Note: to make this truely enforced you need to contact supabase. See: https://www.reddit.com/r/Supabase/comments/12iw7o1/updating_password_in_supabase_seems_insecure/
    // However, having the UI accessible route still verify password is still helpful, and needed once you get the setting above enabled
    if (!isRecoverySession) {
      const { error } = await supabase.auth.signInWithPassword({
        email: session?.user.email || "",
        password: currentPassword,
      })
      if (error) {
        // The user was logged out because of bad password. Redirect to error page explaining.
        throw redirect(303, "/login/current_password_error")
      }
    }

    const { error } = await supabase.auth.updateUser({
      password: newPassword1,
    })
    if (error) {
      return fail(500, {
        errorMessage: "Unknown error. If this persists please contact us.",
        newPassword1,
        newPassword2,
        currentPassword,
      })
    }

    return {
      newPassword1,
      newPassword2,
      currentPassword,
    }
  },
  deleteAccount: async ({
    request,
    locals: { supabase, supabaseServiceRole, getSession },
  }) => {
    const session = await getSession()
    if (!session) {
      throw redirect(303, "/login")
    }

    const formData = await request.formData()
    const currentPassword = formData.get("currentPassword") as string

    if (!currentPassword) {
      return fail(400, {
        errorMessage:
          "You must provide your current password to delete your account. If you forgot it, sign out then use 'forgot password' on the sign in page.",
        errorFields: ["currentPassword"],
        currentPassword,
      })
    }

    // Check current password is correct before deleting account
    const { error: pwError } = await supabase.auth.signInWithPassword({
      email: session?.user.email || "",
      password: currentPassword,
    })
    if (pwError) {
      // The user was logged out because of bad password. Redirect to error page explaining.
      throw redirect(303, "/login/current_password_error")
    }

    const { error } = await supabaseServiceRole.auth.admin.deleteUser(
      session.user.id,
      true,
    )
    if (error) {
      return fail(500, {
        errorMessage: "Unknown error. If this persists please contact us.",
        currentPassword,
      })
    }

    await supabase.auth.signOut()
    throw redirect(303, "/")
  },
  updateProfile: async ({ request, locals: { supabase, getSession } }) => {
    const formData = await request.formData()
    const fullName = formData.get("fullName") as string
    const companyName = formData.get("companyName") as string
    const website = formData.get("website") as string

    let validationError
    let errorFields = []
    if (!fullName) {
      validationError = "Name is required"
      errorFields.push("fullName")
    }
    if (!companyName) {
      validationError =
        "Company name is required. If this is a hobby project or personal app, please put your name."
      errorFields.push("companyName")
    }
    if (!website) {
      validationError =
        "Company website is required. An app store URL is a good alternative if you don't have a website."
      errorFields.push("website")
    }
    if (validationError) {
      return fail(400, {
        errorMessage: validationError,
        errorFields,
        fullName,
        companyName,
        website,
      })
    }

    const session = await getSession()

    const { error } = await supabase.from("profiles").upsert({
      id: session?.user.id,
      full_name: fullName,
      company_name: companyName,
      website: website,
      updated_at: new Date(),
    })

    if (error) {
      return fail(500, {
        errorMessage: "Unknown error. If this persists please contact us.",
        fullName,
        companyName,
        website,
      })
    }

    return {
      fullName,
      companyName,
      website,
    }
  },
  signout: async ({ locals: { supabase, getSession } }) => {
    const session = await getSession()
    if (session) {
      await supabase.auth.signOut()
      throw redirect(303, "/login")
    }
  },

  generateAnthropicReply: async ({ request, locals: {  supabase, getSession } }) => {
console.log("WE ARE IN THE BACKEND GENERATE")

let prompt="",promptA="",nextPrompt="",modelInstructions="",firstPrompt="",reply="",promptAdd="",fetchPromptEmailIndex,currentEmailSequenceName=''


    const formData = await request.formData()
    // const formData = await request.json(); // Assuming the request data is sent as JSON
    const businessDescription = formData.get("businessDescription");
    const targetAudience = formData.get("targetAudience");
    const objective = formData.get("objective");
    const creativity = formData.get("creativity");
    const problemFocus = formData.get("problemFocus");
    const solution = formData.get("solution");
    const emailToRewrite = formData.get("emailToRewrite");
    const wordCount = formData.get("wordCount");
    const copyType = formData.get("copyType");
    const copyTemplate = formData.get("copyTemplate");
    const copyTemplateId = formData.get("copyTemplateId");
    

    reply = formData.get("reply") as string ?? null;
    
    prompt = formData.get("prompt") as string ?? null;

    console.log("businessDescription,targetAudience,objective,creativity,problemFocus,solution,emailToRewrite,wordCount",businessDescription,targetAudience,objective,creativity,problemFocus,solution,emailToRewrite,wordCount)
    console.log("FORM DATAAAA",formData)

    // const promptA = formData.get("fullPrompt") as string

    const newEmailId = formData.get("emailId") as string ?? null
    const newEmailSequenceId = formData.get("emailSequenceId") as string ?? null
    const previousEmailId = formData.get("previousEmailId") as string ?? null
    const isRegenerate = formData.get("isRegenerate") as string ?? null
    
    const currentEmailIndex = Number(formData.get("currentEmailIndex"))
    const steps = formData.get("steps")
    // const wordCount = formData.get("wordCount") as string

    console.log("CURRENT EMAIL INDEX",currentEmailIndex)
    console.log("NEW EMAIL IDSSSSSSSS",newEmailId)
    console.log("SEQ IDSSSSSSSS",newEmailSequenceId)
    console.log("PREVIOUS EMAIL IDSSSSSSSS",previousEmailId)

//FETCH PROMPT FROM DATABASE FOR CURRENT EMAIL IF IT EXISTS


if (newEmailSequenceId) {


if(isRegenerate=='1') {
  fetchPromptEmailIndex = currentEmailIndex
} else {fetchPromptEmailIndex = currentEmailIndex - 1 }

console.log("FETCH PROMPT EMAIL INDEX",fetchPromptEmailIndex)

try {

  const { data: currentEmailData, error: currentEmailError } = await supabase
    .from('copies')
    .select()
    .eq('copy_collection_id', newEmailSequenceId)
    .eq('index', fetchPromptEmailIndex);

console.log("DATABASE RESULT",currentEmailData)

  prompt = currentEmailData[0]?.prompt;
  console.log ("FETCHED CURRENT PROMPT",prompt)

  if (currentEmailError) {
    console.error('Error fetching current prompt:', currentEmailError);
    throw new Error('Error fetching current prompt');
  }

  if (!currentEmailData || currentEmailData.length === 0) {
    throw new Error('No records found');
  }
}catch (error) {
  console.error('Error fetching current prompt', error);
  throw new Error('Error fetching current prompt');
}
   
}
    // console.log("PROMPTA",promptA)
    // const prompt = JSON.parse(promptA)
    // console.log("PROMPT",prompt)
    const session = await getSession();
    const userId = session?.user.id
    // console.log("SESSION DETAILS",session)
    if (!session) {
      return {
        status: 401,
        body: { errorMessage: 'User not authenticated' },
      };
    }

     // Fetch copy template prompts
     const { data: copyTemplatePromptsData, error: copyTypeError } = await supabase
     .from('copy_templates')
     .select('system_prompt, first_prompt, next_prompt')
     .eq('id', copyTemplateId)
     .single();

     if (copyTypeError) {
       console.error('Error fetching copy type prompts:', copyTypeError)
       throw new Error('Error fetching copy type prompts')
     }

     modelInstructions = copyTemplatePromptsData.system_prompt
     firstPrompt = copyTemplatePromptsData.first_prompt.replace("${wordCount}", wordCount)
     nextPrompt = copyTemplatePromptsData.next_prompt.replace("${currentEmailIndex}", currentEmailIndex).replace("${wordCount}", wordCount).replace("${steps}", steps)

  



   console.log("MODEL INSTRUCTIONS",modelInstructions)
   console.log("FIRST PROMPT",firstPrompt)
   console.log("NEXT PROMPT",nextPrompt)


if (currentEmailIndex==1 && !newEmailId) {
  console.log("WE ARE HERE CREATING THE NEW PROMPT")
    promptA = `[{"role": "user", "content": "${firstPrompt
      .replace(/\n/g, "\\n")
      .replace(/&/g, "\\&")
      .replace(/"/g, '\\"')
      .replace(
        /\u00A0/g,
        " ",
      )} ${emailToRewrite.replace(/\n/g, "\\n")}" }]`

      
      prompt = JSON.parse(promptA)
console.log("CHECK NEW PROMPT",prompt)

} else if (currentEmailIndex>1) {
  console.log("WE ARE HERE CREATING THE NEXT PROMPT")

  // nextPrompt = `Write email # ${currentEmailIndex} of ${wordCount}`

  promptA = `[${prompt},{"role": "assistant", "content": "${reply
    .replace(/\n/g, "\\n")
    .replace(/&/g, "\\&")
    .replace(/"/g, '\\"')
    .replace(
      /\u00A0/g,
      " ",
    )}"},{"role": "user", "content": "${nextPrompt}"}]`

    console.log("CHECK NEXT PROMPT",promptA)


    prompt = JSON.parse(promptA)
   
} else if (currentEmailIndex==1 && newEmailId) {
  
  promptA=`[${prompt}]`
  prompt = JSON.parse(promptA)
  console.log("USING EXISTING PROMPT",prompt)
}



promptAdd = promptA.replace(/\[|\]/g, '')

//GENERATE COPY
    try {
      const message = await anthropic.messages.create({
        max_tokens: 1024,
        system: modelInstructions,
        messages: prompt,
        model: 'claude-3-5-haiku-latest',
      });
      console.log("ANTHROPIC MESSAGEEE EEEEEEEEEEEEE",message)


      // console.log("REPLY",message.content);
      

      const messageContent = message.content
      const reply = message.content[0]?.text || ''

      // console.log('EXTRACTED',reply);



console.log('EMAIL IDS',newEmailId,newEmailSequenceId)

    try {
      // ... (existing code)

      // Save the generated content to the user's profile in Supabase
      const { updatedEmailId, updatedEmailSequenceId }= await createEmailSequence();

      console.log('EMAIL IDS 222',updatedEmailId,updatedEmailSequenceId,promptAdd)


      
   return {
    status: 200,
    body: { reply: reply, name:currentEmailSequenceName, emailSequenceId: updatedEmailId, emailId: updatedEmailSequenceId},
  }


    } catch (error) {
      console.error('Error saving email:', error);
      return {
        status: 500,
        body: { errorMessage: 'Error saving email' },
      };
    }

    // Function to create or update the "email_sequence" row for the user
    async function createEmailSequence() {
      let updatedEmailId, updatedEmailSequenceId;

      // promptAdd = promptA.replace(/\[|\]/g, '')

      try {
        // Create a new email sequence
        
        if (!newEmailSequenceId) {
          currentEmailSequenceName = reply.match(/^[^,.;\(\n]+/)[0]
          // currentEmailSequenceName = reply.slice(0, 50)
        const { data: newEmailSequence, error: sequenceError } = await supabase
          .from('copy_collection')
          .upsert([
            {
              user_id: userId,
              name:currentEmailSequenceName,
              steps:steps,
              word_count: wordCount,
              copy_type:copyType,
              copy_template:copyTemplate,
              copy_template_id:copyTemplateId,
              ...(newEmailSequenceId ? { id: newEmailSequenceId } : {}),
              // created_at: new Date(),
            },
          ])
          .select();
          updatedEmailSequenceId = newEmailSequence[0].id
          
    console.log("ADDED SEQUENCE ID",newEmailSequence,updatedEmailSequenceId )
        
        if (sequenceError) {
          console.error('Error creating email sequence:', sequenceError);
          throw new Error('Error creating email sequence');
        }
      } else {updatedEmailSequenceId=newEmailSequenceId}
       
        // Add a new email linked to the created email_sequence
        console.log("NEW EMAIL IDDDDDDD",newEmailId)

         
        
    const { data: newEmail, error: newEmailError } = await supabase


    .from('copies')
    .upsert([
      {
        copy_collection_id: updatedEmailSequenceId,
        index: currentEmailIndex,
        content: reply,
        prompt:promptAdd,
        ...(newEmailId ? { id: newEmailId } : {}),
      },
    ])
    .select();
    // console.log("ADDED EMAIL ADDED ID",newEmail,newEmail[0]?.id )

    updatedEmailId = newEmail[0]?.id

    console.log("ADDED EMAIL ID",updatedEmailId )

  if (newEmailError) {
    console.error('Error creating email:', newEmailError);
    throw new Error('Error creating email');
  }

  if (!newEmail || newEmail.length === 0) {
    throw new Error('Failed to create email');
  }

  

  return { updatedEmailId, updatedEmailSequenceId };

} catch (error) {
  console.error('Error adding records', error);
  throw new Error('Error adding records');
}
}


      // return {
      //   reply: reply,
      // };
      
    } catch (error) {
      console.error('Error contacting Anthropic API:', error);
      return {
        status: 500,
        body: { errorMessage: 'Error contacting Anthropic API' },
      };
    }
  },


  loadEmail: async ({ request, locals: {  supabase, getSession } }) => {

    const formData = await request.formData()
    // const formData = await request.json(); // Assuming the request data is sent as JSON

   


    console.log("FORM DATAAAA",formData)

    const currentEmailSequenceId = Number(formData.get("emailSequenceId"))
    const currentEmailIndex = Number(formData.get("currentEmailIndex"))
    

    let currentEmail, previousEmailId, nextEmailId, currentEmailId,currentPrompt;
   
    
    const session = await getSession();
    const userId = session?.user.id
    // console.log("SESSION DETAILS",session)
    if (!session) {
      return {
        status: 401,
        body: { errorMessage: 'User not authenticated' },
      };
    }


    try {
      // ... (existing code)

      // Save the generated content to the user's profile in Supabase
      const { currentEmail,previousEmailId,nextEmailId,currentEmailId,currentPrompt } = await loadEmailA();

      console.log('FETCHED REPLY------',currentEmail)
      console.log("PREVIOUS EMAIL ID------",previousEmailId)
      console.log("NEXT EMAIL ID------", nextEmailId)
      console.log("CURRENT EMAIL ID------",currentEmailId)
      
   return {
    status: 200,
    body: { reply: currentEmail, previousEmailId:previousEmailId, nextEmailId:nextEmailId, currentEmailId:currentEmailId},
  }
      

    } catch (error) {
      console.error('Error saving email:', error);
      return {
        status: 500,
        body: { errorMessage: 'Error saving email' },
      };
    }

    // Function to create or update the "email_sequence" row for the user
    async function loadEmailA() {
      
    
      try {
        // Fetch current email
        const { data: currentEmailData, error: currentEmailError } = await supabase
          .from('copies')
          .select()
          .eq('copy_collection_id', currentEmailSequenceId)
          .eq('index', currentEmailIndex);
    
        currentEmail = currentEmailData[0]?.content;
        currentEmailId = currentEmailData[0]?.id;
        currentPrompt = currentEmailData[0]?.prompt;
        console.log("CURRENT EMAIL ID---",currentEmailId);
        // console.log("CURRENT EMAIL PROMPT---",currentPrompt);
        if (currentEmailError) {
          console.error('Error fetching current email:', currentEmailError);
          throw new Error('Error fetching current email');
        }
    
        if (!currentEmailData || currentEmailData.length === 0) {
          throw new Error('Failed to fetch current email');
        }
    
        // Fetch previous email
        
        const { data: previousEmailData, error: previousEmailError } = await supabase
          .from('copies')
          .select()
          .eq('copy_collection_id', currentEmailSequenceId)
          .eq('index', currentEmailIndex - 1);
    
          previousEmailId = previousEmailData.length > 0 ? previousEmailData[0]?.id : '';
          console.log("PREVIOUS EMAIL ID---",previousEmailId)

        // Fetch next email
        const { data: nextEmailData, error: nextEmailError } = await supabase
          .from('copies')
          .select()
          .eq('copy_collection_id', currentEmailSequenceId)
          .eq('index', currentEmailIndex + 1);
    
          nextEmailId = nextEmailData.length > 0 ? nextEmailData[0]?.id : null;
          console.log("NEXT EMAIL ID---", nextEmailId)
    
        if (previousEmailError || nextEmailError) {
          console.error('Error fetching adjacent emails:', previousEmailError || nextEmailError);
          throw new Error('Error fetching adjacent emails');
        }
    
        
    
        return { currentEmail, previousEmailId, nextEmailId,currentEmailId};
      } catch (error) {
        console.error('Error fetching emails', error);
        throw new Error('Error fetching emails');
      }
    }
  },
  

  getEmailSequences: async ({ request, locals: { supabase, getSession } }) => {
    const session = await getSession();
    const userId = session?.user.id;

    if (!session) {
      return {
        status: 401,
        body: { errorMessage: 'User not authenticated' },
      };
    }
    const formData = await request.formData()
    console.log("FETCH SEQUENCES FORM DATAAAA",formData)
    
    const searchTerm = formData.get('searchTerm');
    const page = parseInt(formData.get('page'));
  const limit = parseInt(formData.get('limit'));

  const offset = (page - 1) * limit;

    try {

        
      // Fetch email sequences for the logged-in user

      // const { data: emailSequences, error } = await supabase
      // .from('copy_collection')
      // .select('id,name,created_at,updated_at,steps,word_count,copy_type') //avoid passing user_id
      // // .select()
      // .eq('user_id', userId)
      // .order('updated_at', { ascending: false })
      // .range(offset, offset + limit - 1);
      //   // console.log("FETCH SEQUENCES",emailSequences)
      //   console.log("FETCHED SEQUENCES")

console.log("SEARCH TERM",searchTerm)
      
      let { data: emailSequences, error } = await supabase
      .from('copy_collection')
      .select('id,name,created_at,updated_at,steps,word_count,copy_type') //avoid passing user_id
      // .select()
      .eq('user_id', userId)

      if(searchTerm) {
        console.log('SEARCHING NOW ......')
        emailSequences = (await supabase
        .from('copy_collection')
        .select('id,name,created_at,updated_at,steps,word_count,copy_type')
        .ilike('name', `%${searchTerm}%`)
        .order('updated_at')).data;
      } else {
        console.log('JUST FETCHING ......')
        emailSequences = (await supabase
        .from('copy_collection')
        .select('id,name,created_at,updated_at,steps,word_count,copy_type')
        .eq('user_id', userId)
        .order('updated_at', { ascending: false })
        .range(offset, offset + limit - 1)).data;
        
      }
      console.log("FETCHED SEQUENCES")

      if (error) {
        console.error('Error fetching email sequences:', error);
        throw new Error('Error fetching email sequences');
      }

      return {
       
        body: JSON.stringify(emailSequences)
      };

     
      
    } catch (error) {
      console.error('Error fetching email sequences:', error);
      return {
        status: 500,
        body: { errorMessage: 'Error fetching email sequences' },
      };
    }


  },

  fetchCopyTypes: async ({ locals: { supabase, getSession } }) => {
    const session = await getSession();
    const userId = session?.user.id;

    if (!session) {
      return {
        status: 401,
        body: { errorMessage: 'User not authenticated' },
      };
    }
// console.log("FETCHING COPY TYPES")
    try {
      // Fetch email sequences for the logged-in user
      const { data: copyTypes, error } = await supabase
      .from('copy_types')
      .select('id, name');
        console.log("FETCHED COPY TYPES",copyTypes)
        
      if (error) {
        console.error('Error fetching copy types', error);
        throw new Error('Error fetching copy types');
      }

      return {
       
        body: JSON.stringify(copyTypes)
      };
      
    } catch (error) {
      console.error('Error fetching copy types:', error);
      return {
        status: 500,
        body: { errorMessage: 'Error fetching copy types' },
      };
    }

    
  },


  fetchCopyTemplates: async ({  request, locals: { supabase, getSession } }) => {
    const session = await getSession();
    const userId = session?.user.id;

    if (!session) {
      return {
        status: 401,
        body: { errorMessage: 'User not authenticated' },
      };
    }

    const formData = await request.formData()
   
    const copyTypeId = formData.get('copyTypeId');
    console.log("COPY TYPE ID",copyTypeId)

// console.log("FETCHING COPY TYPES")
    try {
      // Fetch email sequences for the logged-in user
      const { data: copyTemplates, error } = await supabase
      .from('copy_templates')
      .select('id, name')
      .eq('copy_type_id', copyTypeId);
        console.log("FETCHED COPY TEMPLATES",copyTemplates)
        
      if (error) {
        console.error('Error fetching copy templates', error);
        throw new Error('Error fetching copy templates');
      }

      return {
       
        body: JSON.stringify(copyTemplates)
      };
      
    } catch (error) {
      console.error('Error fetching copy types:', error);
      return {
        status: 500,
        body: { errorMessage: 'Error fetching copy types' },
      };
    }

    
  },


 
  saveSequenceName: async ({ request, locals: { supabase, getSession } }) => {
    const session = await getSession();
    const userId = session?.user.id;

    if (!session) {
      return {
        status: 401,
        body: { errorMessage: 'User not authenticated' },
      };
    }

    const formData = await request.formData()
    // const formData = await request.json(); // Assuming the request data is sent as JSON

   


    console.log("SAVE NAME FORM DATAAAA",formData)

    // const userId = Number(formData.get("currentSequenceId"))
    const currentSequenceId = Number(formData.get("currentSequenceId"))
    const newName =formData.get("newName") as string

    try {
      console.log("Updating Name for Sequence", currentSequenceId)
      console.log("New Name", newName)

      const { data, error } = await supabase
        .from("copy_collection")
        .update({ name: newName })
        .eq("user_id", userId)
        .eq("id", currentSequenceId)
        .select()

      console.log("Updated sequence name:", data)
        
      if (error) {
        console.error('Error fetching email sequences:', error);
        throw new Error('Error fetching email sequences');
      }

      return {
       
        body: JSON.stringify(data)
      };
      
    } catch (error) {
      console.error('Error fetching email sequences:', error);
      return {
        status: 500,
        body: { errorMessage: 'Error fetching email sequences' },
      };
    }
  },


  
  deleteEmailSequence: async ({ request, locals: { supabase, getSession } }) => {
    const session = await getSession();
    const userId = session?.user.id;

    if (!session) {
      return {
        status: 401,  
        body: { errorMessage: 'User not authenticated' },
      };
    } 

    const formData = await request.formData();
    const currentSequenceId = Number(formData.get("currentSequenceId"));

    try {
      const { data, error } = await supabase
        .from("copy_collection")
        .delete()
        .eq("user_id", userId)
        .eq("id", currentSequenceId)
        .select();
console.log("DELETED SEQUENCE",data)
      if (error) {
        console.error('Error deleting email sequence:', error);
        throw new Error('Error deleting email sequence');
      }

      return {
        status: 200,
        body: JSON.stringify(data),
      };
    } catch (error) {
      console.error('Error deleting email sequence:', error);
      return {
        status: 500,
        body: { errorMessage: 'Error deleting email sequence' },
      }

}
  },

  deleteSelectedSequences: async ({ request, locals: { supabase, getSession } }) => {
    const session = await getSession();
    const userId = session?.user.id;

    if (!session) {
      return {
        status: 401,  
        body: { errorMessage: 'User not authenticated' },
      };
    } 

    const formData = await request.formData();
    const deleteIds = formData.get("deleteIds");
console.log("DELETE IDS",deleteIds);

    try {
      const { data, error } = await supabase
        .from("copy_collection")
        .delete()
        .eq("user_id", userId)
        .in("id", deleteIds.split(",").map(Number));

console.log("DELETED SEQUENCE",data)
      if (error) {
        console.error('Error deleting email sequence:', error);
        throw new Error('Error deleting email sequence');
      }
      return {
        status: 200,
        body: JSON.stringify(data),
      };
    } catch (error) {
      console.error('Error deleting email sequence:', error);
      return {
        status: 500,
        body: { errorMessage: 'Error deleting email sequence' },
      }

}
  },








}
