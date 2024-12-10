<script lang="ts">
  import { Auth } from "@supabase/auth-ui-svelte"
  import { sharedAppearance, oauthProviders } from "../login_config"

  export let data
  let uniqueCode =
    Date.now().toString(36).substr(4) + Math.random().toString(36).substr(2, 3) // Generate the unique code on load

  console.log("UNIQUE CODE", uniqueCode)

  // Function to get query parameters from the URL
  const getQueryParam = (name) => {
    const params = new URLSearchParams(window.location.search)
    return params.get(name)
  }

  // Get user_type from the URL query parameter or use a default value
  const userType = getQueryParam("user_type") || "business"

  // Get code from the URL query parameter, or default to an empty string
  const partnerCode = getQueryParam("code") || ""

  console.log("USER TYPE", userType)
  console.log("PARTNER CODE", partnerCode)
</script>

<svelte:head>
  <title>Sign up</title>
</svelte:head>

<h1 class="text-2xl font-bold mb-6">Sign Up</h1>
<Auth
  supabaseClient={data.supabase}
  view="sign_up"
  redirectTo={`${data.url}/auth/callback`}
  showLinks={false}
  providers={oauthProviders}
  socialLayout="horizontal"
  appearance={sharedAppearance}
  additionalData={{
    code: uniqueCode,
    user_type: userType,
    partner_code: partnerCode,
  }}
/>
<div class="text-l text-slate-800 mt-4 mb-2">
  Have an account? <a class="underline" href="/login/sign_in">Sign in</a>.
</div>
