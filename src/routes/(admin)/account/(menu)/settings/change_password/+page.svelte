<script lang="ts">
	import { getContext } from 'svelte'
	import type { Writable } from 'svelte/store';
    import SettingsModule from '../settings_module.svelte';

	let adminSection: Writable<String> = getContext('adminSection');
	adminSection.set('settings')

	export let data
</script>

<svelte:head>
	<title>Change Password</title>
</svelte:head>

<h1 class="text-2xl font-bold mb-6">Change Password</h1>

<SettingsModule
    data={data}
	editable={true}
    saveButtonTitle='Change Password'
    successTitle='Password Changed'
    successBody='On next sign in, use your new password.'
    formTarget='/account/api?/updatePassword'
	fields={[
            {id: "newPassword1", label: "New Password", initialValue: '', inputType: 'password'},
            {id: "newPassword2", label: "Confirm New Password", initialValue: '', inputType: 'password'},
            {id: "currentPassword", label: "Current Password", initialValue: '', inputType: 'password'}
		]}
    />