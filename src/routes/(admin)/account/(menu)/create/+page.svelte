<script lang="ts">
  import { getContext } from "svelte"
  import type { Writable } from "svelte/store"
  import { onMount } from "svelte"
  import { writable } from "svelte/store"
  import { createClient } from "@supabase/supabase-js"

  import { PUBLIC_SUPABASE_URL } from "$env/static/public"
  import { PUBLIC_SUPABASE_ANON_KEY } from "$env/static/public"

  const supabase = createClient(PUBLIC_SUPABASE_URL, PUBLIC_SUPABASE_ANON_KEY)

  let adminSection: Writable<String> = getContext("adminSection")
  adminSection.set("create")

  let formData = {
    businessDescription: "",
    targetAudience: "",
    wordCount: "50 words",
    objective: "",
    numEmails: 4,
    isBreakupEmail: false,
    breakupReason: "",
    creativity: "",
    problemFocus: "",
    solution: "",
    emailToRewrite: "",
  }

  let objectives = [
    "Problem Finding",
    "Convincing",
    "Selling",
    "Awareness",
    "Consideration",
    "Repurchase",
  ]

  let numEmailsOptions = [1, 2, 3, 4, 5]

  let wordCountOptions = [
    "50 words",
    "100 words",
    "200 words",
    "300 words",
    "400 words",
    "500 words",
  ]

  let breakupReasons = [
    "Too Busy",
    "Don't Need",
    "Wrong Person",
    "Redirect to Right Person",
  ]

  let creativityOptions = ["Low", "Medium", "High"]

  let isLoading = false
  let reply = ""
  let currentEmailId = ""
  let currentEmailSequenceId = ""
  let currentEmailSequenceName = ""
  let modelInstructions,
    prompt = "",
    nextPrompt,
    previousEmailId,
    nextEmailId,
    loadEmailId,
    steps
  let currentEmailIndex = 0
  let isCopySuccessful = false

  let emailSequences = writable([])
  let showForm = writable(false)

  let isModalOpen = false
  let isDeleteModalOpen = false
  let currentSequence
  let newName = ""
  // let userId
  let currentSequenceId
  let isSaving = false

  let isCopyTypeModalOpen = false
  let copyTypes = writable([])
  let selectedCopyType = null
  let isLoadingNewSequences = false
  let isLoadingSequences = true
  let hasMoreRecords = true // Tracks if there are more records to load
  let updatedRecordCount = 0
  let deletingSequence = false
  let deletingSelectedSequences = false
  let isRegenerate = 0
  let isGenerating = false

  let currentPage = 1 // Tracks the current page
  const itemsPerPage = 10 // Number of results per page

  // Store for email sequences and selection state
  let isSelectionMode = writable(false)
  let selectedSequences = writable(new Set())

  let isTyping = false
  let displayedText = "" // The text progressively shown with the typing effect
  let typingSpeed = 2 // Adjust the typing speed (milliseconds per character)

  function openRenameModal(sequence) {
    currentSequence = sequence
    newName = sequence.name
    // userId = sequence.user_id
    currentSequenceId = sequence.id
    isModalOpen = true

    console.log("OPEN MODAL", currentSequence, newName, isModalOpen)
  }

  function openDeleteModal(sequence) {
    currentSequence = sequence
    newName = sequence.name
    // userId = sequence.user_id
    currentSequenceId = sequence.id
    isDeleteModalOpen = true

    console.log("OPEN MODAL", currentSequence, newName, isModalOpen)
  }

  function openSelectedDeleteModal() {
    isDeleteModalOpen = true
  }

  function closeRenameModal() {
    isModalOpen = false
  }

  function closeDeleteModal() {
    isDeleteModalOpen = false
  }

  async function saveName() {
    isSaving = true
    // console.log("SAVE NAME??????", currentSequence, newName, isModalOpen)

    const formDataString = `currentSequenceId=${currentSequenceId}&newName=${newName}`
    console.log("SAVE NAME??????", formDataString)
    // Update the sequence name in the Supabase database
    try {
      const response = await fetch("/account/api?/saveSequenceName", {
        method: "POST",
        headers: {
          "Content-Type": "application/x-www-form-urlencoded",
        },
        body: formDataString,
      })

      if (response.ok) {
        const result = await response.json()
        const jsonData = JSON.parse(result.data)
        console.log("RESULT", jsonData)
        // const newNameValue = jsonData[3]
        // newName = newNameValue

        closeRenameModal()
        fetchUpdatedEmailSequences()
      } else {
        console.error("Update Name failed")
        // Handle error appropriately
      }
    } catch (error) {
      console.error("Error updating sequence name:", error.message)
      // Handle error
    } finally {
      isSaving = false
    }
  }

  async function deleteEmailSequence() {
    isSaving = true
    const formDataString = `currentSequenceId=${currentSequenceId}`
    console.log("DELETE EMAIL SEQUENCE??????", formDataString)
    // Delete the sequence name in the Supabase database
    try {
      const response = await fetch("/account/api?/deleteEmailSequence", {
        method: "POST",
        headers: {
          "Content-Type": "application/x-www-form-urlencoded",
        },
        body: formDataString,
      })

      if (response.ok) {
        const result = await response.json()
        const jsonData = JSON.parse(result.data)
        console.log("RESULT", jsonData)
        // const newNameValue = jsonData[3]
        // newName = newNameValue

        closeDeleteModal()
        fetchUpdatedEmailSequences()
      } else {
        console.error("Delete Sequence failed")
        // Handle error appropriately
      }
    } catch (error) {
      console.error("Error deleting sequence:", error.message)
      // Handle error
    } finally {
      isSaving = false
      deletingSequence = false
    }
  }

  function formatDate(dateString) {
    let date = new Date(dateString)
    let options = {
      year: "numeric",
      month: "short",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
    }
    return new Intl.DateTimeFormat("en-US", options).format(date)
  }

  // function copyToClipboard() {
  //   const textarea = document.getElementById(
  //     "replyTextArea",
  //   ) as HTMLTextAreaElement
  //   textarea.select()
  //   document.execCommand("copy")
  //   isCopySuccessful = true
  //   // Reset the button text after a short delay
  //   setTimeout(() => {
  //     isCopySuccessful = false
  //   }, 2000)
  // }

  function copyToClipboard() {
    const div = document.getElementById("replyTextArea") as HTMLDivElement
    navigator.clipboard.writeText(div.innerText).then(() => {
      isCopySuccessful = true
      // Reset the button text after a short delay
      setTimeout(() => {
        isCopySuccessful = false
      }, 2000)
    })
  }

  async function handleSubmit() {
    isLoading = true

    currentEmailIndex = 1
    currentEmailId = ""
    currentEmailSequenceId = ""
    currentEmailSequenceName = ""
    previousEmailId = null
    nextEmailId = null

    await handleGenerate()
  }

  async function handleGenerate() {
    isLoading = true
    isGenerating = true
    /*add 1 to updatedRecordCount to track the number of records fetched so far*/
    updatedRecordCount++

    showForm.set(false)
    console.log("CURRENT INDEX", currentEmailIndex)
    // Convert form data to form-encoded string
    //  const formDataString = Object.entries(formData)
    //   .map(([key, value]) => `${encodeURIComponent(key)}=${encodeURIComponent(value)}`)
    //   .join('&')
    console.log("EMAIL ID", currentEmailId)
    console.log("EMAIL SEQ", currentEmailSequenceId)

    // const formDataString = `fullPrompt=[${prompt}]&emailId=${currentEmailId}&emailSequenceId=${currentEmailSequenceId}&currentEmailIndex=${currentEmailIndex}&steps=${formData.numEmails}&wordCount=${formData.wordCount}`
    const formDataString = new URLSearchParams({
      emailId: currentEmailId,
      emailSequenceId: currentEmailSequenceId,
      currentEmailIndex: currentEmailIndex.toString(),
      steps: formData.numEmails.toString(),
      wordCount: formData.wordCount,
      businessDescription: formData.businessDescription,
      targetAudience: formData.targetAudience,
      objective: formData.objective,
      creativity: formData.creativity,
      problemFocus: formData.problemFocus,
      solution: formData.solution,
      emailToRewrite: formData.emailToRewrite,
      reply: reply,
      copyType: selectedCopyType,
      previousEmailId: previousEmailId,
      isRegenerate: isRegenerate.toString(),
      // prompt: prompt,
    }).toString()

    console.log("FORM DATA STRING", formDataString)

    try {
      const response = await fetch("/account/api?/generateAnthropicReply", {
        method: "POST",
        headers: {
          "Content-Type": "application/x-www-form-urlencoded",
        },
        body: formDataString,
      })

      if (response.ok) {
        const result = await response.json()

        const jsonData = JSON.parse(result.data)

        const replyValue = jsonData[3]
        if (!currentEmailSequenceId) {
          currentEmailSequenceName = jsonData[4]
        }
        currentEmailSequenceId =
          jsonData.length === 7 ? jsonData[6] : jsonData[5]
        currentEmailId = jsonData[5]

        reply = replyValue
        // Update the reply variable with the fetched data
        // reply = reply;
        console.log("CURRENT PROMPT", prompt)
        console.log("SEQ NAME", currentEmailSequenceName)

        console.log("EXTRATCTED", reply)

        console.log("RESULT", jsonData)
        console.log("SEQ ID", currentEmailSequenceId)
        console.log("EMAIL ID", currentEmailId)
      } else {
        console.error("Anthropic API request failed")
        // Handle error appropriately
      }
    } catch (error) {
      console.error("Error contacting Anthropic API:", error)
      // Handle error appropriately
    } finally {
      isLoading = false
      isRegenerate = 0
      isGenerating = false
      // Trigger the typing effect when the component mounts or reply updates
      typeText(reply)
    }
  }

  async function handleLoad() {
    isLoading = true

    console.log("CURRENT INDEX", currentEmailIndex)
    console.log("STEPSSSSSSSSSS", formData.numEmails)
    // Convert form data to form-encoded string
    //  const formDataString = Object.entries(formData)
    //   .map(([key, value]) => `${encodeURIComponent(key)}=${encodeURIComponent(value)}`)
    //   .join('&')
    console.log("EMAIL ID", currentEmailId)
    console.log("EMAIL SEQ", currentEmailSequenceId)
    console.log("LOADED COPY TYPE", selectedCopyType)
    const formDataString = `emailSequenceId=${currentEmailSequenceId}&currentEmailIndex=${currentEmailIndex}`

    try {
      const response = await fetch("/account/api?/loadEmail", {
        method: "POST",
        headers: {
          "Content-Type": "application/x-www-form-urlencoded",
        },
        body: formDataString,
      })

      if (response.ok) {
        const result = await response.json()

        const jsonData = JSON.parse(result.data)

        const replyValue = jsonData[3]
        previousEmailId = jsonData[4]
        nextEmailId = jsonData[5]
        currentEmailId = jsonData[6]
        // prompt = jsonData[7]

        reply = replyValue
        // Update the reply variable with the fetched data
        // reply = reply;

        console.log("CURRENT IDS", currentEmailId)
        console.log("PREVIOUS IDS", previousEmailId)
        console.log("NEXT IDS", nextEmailId)
        // console.log("CURRENT PROMPT", prompt)

        console.log("FETCHED RESULT", jsonData)
      } else {
        console.error("Anthropic API request failed")
        // Handle error appropriately
      }
    } catch (error) {
      console.error("Error contacting Anthropic API:", error)
      // Handle error appropriately
    } finally {
      isLoading = false
    }
  }

  async function fetchEmailSequences(page = 1) {
    // if (!hasMoreRecords) return // Exit if no more records or already loading
    isLoadingSequences = true

    const formDataString = `page=${page}&limit=${itemsPerPage}`

    const response = await fetch("/account/api?/getEmailSequences", {
      method: "POST",
      headers: {
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body: formDataString,
    })
    if (response.ok) {
      const result = await response.json()
      const jsonData = JSON.parse(result.data)
      const jsonDataC = JSON.parse(jsonData[1])
      const sortedSequences = jsonDataC.sort(
        (a, b) => b.updated_at - a.updated_at,
      )

      if (jsonDataC.length < itemsPerPage) {
        hasMoreRecords = false // No more records to load
      }

      if (page === 1 || isSaving) {
        // Replace the list on the first page load
        emailSequences.set(jsonDataC)
      } else {
        // Append new results for subsequent pages
        emailSequences.update((existing) => [...existing, ...jsonDataC])
      }
      updatedRecordCount = $emailSequences.length
      console.log("UPDATED RECORD COUNT", updatedRecordCount)

      // emailSequences.set(jsonDataC)
      isLoadingSequences = false
      console.log("EMAIL SEQUENCESSSSS", $emailSequences)
    } else {
      console.error("Failed to fetch email sequences")
    }
  }

  async function fetchUpdatedEmailSequences() {
    // if (!hasMoreRecords) return // Exit if no more records or already loading
    isLoadingSequences = true

    const formDataString = `page=1&limit=${updatedRecordCount}`

    const response = await fetch("/account/api?/getEmailSequences", {
      method: "POST",
      headers: {
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body: formDataString,
    })
    if (response.ok) {
      const result = await response.json()
      const jsonData = JSON.parse(result.data)
      const jsonDataC = JSON.parse(jsonData[1])
      const sortedSequences = jsonDataC.sort(
        (a, b) => b.updated_at - a.updated_at,
      )

      emailSequences.set(jsonDataC)

      // emailSequences.set(jsonDataC)
      isLoadingSequences = false
      console.log("EMAIL SEQUENCESSSSS", $emailSequences)
    } else {
      console.error("Failed to fetch email sequences")
    }
  }

  async function loadMore() {
    if (isLoadingNewSequences) return // Prevent multiple clicks
    console.log("LOADING NEW SEQUENCES", isLoadingNewSequences)
    isLoadingNewSequences = true

    try {
      console.log("LOADING NEW SEQUENCES", isLoadingNewSequences)
      currentPage += 1
      await fetchEmailSequences(currentPage) // Wait for the fetch operation to complete
      window.scrollTo({
        top: document.body.scrollHeight,
        behavior: "smooth",
      })
    } catch (error) {
      console.error("Error loading sequences:", error)
    } finally {
      isLoadingNewSequences = false // Reset after loading completes
    }
  }

  async function fetchCopyTypes() {
    const response = await fetch("/account/api?/fetchCopyTypes", {
      method: "POST",
      headers: {
        "Content-Type": "application/x-www-form-urlencoded",
      },
    })
    if (response.ok) {
      const result = await response.json()
      const jsonCopyTypeData = JSON.parse(result.data)
      const jsonCopyTypeDataC = JSON.parse(jsonCopyTypeData[1])

      console.log("JSON C", jsonCopyTypeDataC)
      copyTypes.set(jsonCopyTypeDataC)
      console.log("COPY TYPES", $copyTypes)
    } else {
      console.error("Failed to fetch copy types")
    }
  }

  async function toggleShowForm() {
    showForm.set(true)
  }
  async function toggleHideForm() {
    showForm.set(false)
  }

  function openCopyTypeModal() {
    isCopyTypeModalOpen = true
  }

  function handleCopyTypeSelection(type: string) {
    selectedCopyType = type.name
    isCopyTypeModalOpen = false
    showForm.set(true) // Show the form after selection
    console.log("SELECTED COPY TYPE", selectedCopyType)
  }

  function closeCopyTypeModal() {
    isCopyTypeModalOpen = false
  }

  // Toggle selection mode
  function toggleSelection(sequenceId) {
    selectedSequences.update((selected) => {
      if (selected.has(sequenceId)) {
        selected.delete(sequenceId)
      } else {
        selected.add(sequenceId)
      }
      return selected
    })
  }

  // Delete selected sequences
  async function deleteSelected() {
    isSaving = true
    const selected = Array.from($selectedSequences)
    const formDataString = `deleteIds=${selected}`
    console.log("DELETE SELECTED SEQUENCES ??????", formDataString)
    // Delete the sequence name in the Supabase database
    try {
      const response = await fetch("/account/api?/deleteSelectedSequences", {
        method: "POST",
        headers: {
          "Content-Type": "application/x-www-form-urlencoded",
        },
        body: formDataString,
      })

      if (response.ok) {
        const result = await response.json()
        const jsonData = JSON.parse(result.data)
        console.log("RESULT", jsonData)
        // const newNameValue = jsonData[3]
        // newName = newNameValue

        // Update local state
        // emailSequences.update((sequences) =>
        //   sequences.filter((sequence) => !selected.includes(sequence.id)),
        // )

        fetchUpdatedEmailSequences()

        selectedSequences.set(new Set())
        isSelectionMode.set(false)
      } else {
        console.error("Delete Selected Sequence failed")
        // Handle error appropriately
      }
    } catch (error) {
      console.error("Error deleting selected sequence:", error.message)
      // Handle error
    } finally {
      selectedSequences.set(new Set())
      isSelectionMode.set(false)
      deletingSelectedSequences = false
      isSaving = false
      deletingSequence = false
    }
  }

  // Select all sequences
  function selectAll() {
    emailSequences.update((sequences) => {
      selectedSequences.set(new Set(sequences.map((seq) => seq.id)))
      return sequences
    })
  }

  // Cancel selection
  function cancelSelection() {
    selectedSequences.set(new Set())
    isSelectionMode.set(false)
  }

  // Function to simulate typing effect
  function typeText(text) {
    displayedText = "" // Reset the displayed text
    let index = 0

    isTyping = true

    function typeNextChar() {
      if (index < text.length) {
        displayedText += text[index]
        index++
        setTimeout(typeNextChar, typingSpeed)
      } else {
        isTyping = false
      }
    }

    typeNextChar()
  }
  // // Trigger the typing effect when the component mounts or reply updates
  // $: if (reply) typeText(reply)

  // onMount(fetchEmailSequences)

  onMount(() => {
    fetchEmailSequences(currentPage)
    fetchCopyTypes()
  })
</script>

<div>
  {#if !reply && !isLoading && !$showForm && !isLoadingSequences}
    <!-- <button class="plus-sign" on:click={toggleShowForm}>+ New</button> -->
    <button class="plus-sign" on:click={openCopyTypeModal}>+ New</button>
  {/if}
</div>

<main
  class="main-content {isCopyTypeModalOpen || isDeleteModalOpen
    ? 'blurred'
    : ''}"
>
  {#if isLoading || isLoadingSequences}
    <div class="spinner-container">
      <span class="loading loading-dots loading-lg text-primary"></span>
    </div>
  {/if}

  <!-- {#if !reply && !isLoading && $showForm} -->
  {#if !reply && !isLoading && $showForm && selectedCopyType === "Rewriter"}
    <form on:submit|preventDefault={handleSubmit} class="form-container">
      <div class="form-section">
        <label
          class="block text-gray-700 text-sm font-bold mb-2"
          for="businessDescription">Describe your business:</label
        >
        <textarea
          bind:value={formData.businessDescription}
          id="businessDescription"
          class="w-full p-2 border rounded focus:outline-none focus:shadow-outline"
        ></textarea>

        <label
          class="block text-gray-700 text-sm font-bold mb-2"
          for="wordCount">Word Count:</label
        >
        <select
          bind:value={formData.wordCount}
          id="wordCount"
          class="w-full p-2 border rounded focus:outline-none focus:shadow-outline"
        >
          {#each wordCountOptions as option (option)}
            <option value={option}>{option}</option>
          {/each}
        </select>

        <label
          class="block text-gray-700 text-sm font-bold mb-2"
          for="numEmails">Number of Emails:</label
        >
        <select
          bind:value={formData.numEmails}
          id="numEmails"
          class="w-full p-2 border rounded focus:outline-none focus:shadow-outline"
        >
          {#each numEmailsOptions as num (num)}
            <option value={num}>{num}</option>
          {/each}
        </select>

        <label
          class="block text-gray-700 text-sm font-bold mb-2"
          for="problemFocus">Problem Focus:</label
        >
        <textarea
          bind:value={formData.problemFocus}
          id="problemFocus"
          class="w-full p-2 border rounded focus:outline-none focus:shadow-outline"
        ></textarea>

        <p>
          <label class="block mt-4" for="isBreakupEmail">
            <input
              type="checkbox"
              bind:checked={formData.isBreakupEmail}
              class="mr-2"
            />
            Last Email should be a break-up email?
          </label>
        </p>

        {#if formData.isBreakupEmail}
          <label
            class="block text-gray-700 text-sm font-bold mb-2"
            for="breakupReason">Break-up reason:</label
          >
          <select
            bind:value={formData.breakupReason}
            id="breakupReason"
            class="w-full p-2 border rounded focus:outline-none focus:shadow-outline"
          >
            {#each breakupReasons as reason (reason)}
              <option value={reason}>{reason}</option>
            {/each}
          </select>
        {/if}
      </div>

      <div class="form-section">
        <!-- Fields for the second column -->
        <!-- ... -->
        <label
          class="block text-gray-700 text-sm font-bold mb-2"
          for="targetAudience">Target audience:</label
        >
        <textarea
          bind:value={formData.targetAudience}
          id="targetAudience"
          class="w-full p-2 border rounded focus:outline-none focus:shadow-outline"
        ></textarea>

        <label
          class="block text-gray-700 text-sm font-bold mb-2"
          for="objective">Objective:</label
        >
        <select
          bind:value={formData.objective}
          id="objective"
          class="w-full p-2 border rounded focus:outline-none focus:shadow-outline"
        >
          {#each objectives as obj (obj)}
            <option value={obj}>{obj}</option>
          {/each}
        </select>

        <label
          class="block text-gray-700 text-sm font-bold mb-2"
          for="creativity">Creativity:</label
        >
        <select
          bind:value={formData.creativity}
          id="creativity"
          class="w-full p-2 border rounded focus:outline-none focus:shadow-outline"
        >
          {#each creativityOptions as option (option)}
            <option value={option}>{option}</option>
          {/each}
        </select>

        <label class="block text-gray-700 text-sm font-bold mb-2" for="solution"
          >Solution:</label
        >
        <textarea
          bind:value={formData.solution}
          id="solution"
          class="w-full p-2 border rounded focus:outline-none focus:shadow-outline"
        ></textarea>
      </div>

      <div class="button-container">
        <label
          class="block text-gray-700 text-sm font-bold mb-2"
          for="emailToRewrite">Email to rewrite (max 500 words):</label
        >
        <textarea
          bind:value={formData.emailToRewrite}
          id="emailToRewrite"
          rows="5"
          maxlength="2000"
          class="w-full p-2 border rounded focus:outline-none focus:shadow-outline"
        ></textarea>
        <button class="btn btn-neutral" on:click={toggleHideForm}
          >Go Back</button
        >
        <button type="submit" class="btn btn-neutral">Generate</button>
      </div>
    </form>
  {/if}

  {#if !reply && !isLoading && $showForm && selectedCopyType === "Long Form Email"}
    <p>Displaying Long Form Email form...</p>
    <!-- Long Form Email specific fields here -->
  {/if}

  {#if !reply && !isLoading && $showForm && selectedCopyType === "Offer Based Cold Email Sequence"}
    <p>Displaying Offer Based Cold Email Sequence form...</p>
    <!-- Offer Based Cold Email Sequence specific fields here -->
  {/if}

  {#if !reply && !isLoading && $showForm && selectedCopyType === "Value Based Cold Email Sequence"}
    <p>Displaying Value Based Cold Email Sequence form...</p>
    <!-- Value Based Cold Email Sequence specific fields here -->
  {/if}

  {#if reply && !isLoading && !$showForm}
    <div>
      <div class="textarea-container">
        <!-- <textarea
          id="replyTextArea"
          bind:value={reply}
          readonly
          class="w-full p-2 border rounded focus:outline-none focus:shadow-outline h-80vh resize-none"
        ></textarea> -->
        <div
          id="replyTextArea"
          class="w-full p-2 border rounded focus:outline-none focus:shadow-outline h-80vh overflow-auto"
          style="white-space: pre-wrap"
        >
          {#if !isTyping}
            {reply}
          {:else}
            {displayedText}
          {/if}
        </div>

        <button
          on:click={copyToClipboard}
          class="btn btn-outline copy-button"
          disabled={!reply || isCopySuccessful}
        >
          {#if isCopySuccessful}
            <svg
              xmlns="http://www.w3.org/2000/svg"
              width="24"
              height="24"
              viewBox="0 0 24 24"
              fill="none"
              stroke="#ffffff"
              stroke-width="1"
              stroke-linecap="round"
              stroke-linejoin="round"
              ><polyline points="20 6 9 17 4 12"></polyline></svg
            >
            Copied
          {:else}
            <svg
              xmlns="http://www.w3.org/2000/svg"
              width="24"
              height="24"
              viewBox="0 0 24 24"
              fill="none"
              stroke="#000000"
              stroke-width="1"
              stroke-linecap="round"
              stroke-linejoin="round"
              ><rect x="9" y="9" width="13" height="13" rx="2" ry="2"
              ></rect><path
                d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"
              ></path></svg
            >
            Copy
          {/if}
        </button>
      </div>

      <div class="button-container">
        <div class="all-caps">
          {currentEmailSequenceName} <br /> SEQUENCE ID # {currentEmailSequenceId}
          / STEP # {currentEmailIndex} / TOTAL STEPS: {formData.numEmails}
        </div>
        <button
          on:click={() => {
            currentEmailIndex = 0
            currentEmailId = ""
            currentEmailSequenceId = ""
            reply = null
            previousEmailId = null
            nextEmailId = null
            // fetchEmailSequences()
            fetchUpdatedEmailSequences()
          }}
          class="btn btn-primary"
          disabled={isTyping}
          >{#if currentEmailIndex < formData.numEmails}Start Over
          {:else}Finish{/if}
        </button>
        {#if currentEmailIndex > 0 && previousEmailId}
          <button
            on:click={() => {
              // nextEmailId = currentEmailId
              // loadEmailId = previousEmailId
              currentEmailIndex -= 1
              handleLoad()
            }}
            class="btn btn-outline"
            disabled={isTyping}
          >
            Previous
          </button>
        {/if}
        {#if !nextEmailId}
          <button
            on:click={() => {
              isRegenerate = 1
              handleGenerate()
            }}
            class="btn btn-outline"
            disabled={isTyping}
          >
            Regenerate
          </button>
        {/if}
        {#if currentEmailIndex < formData.numEmails && !nextEmailId}
          <button
            on:click={() => {
              currentEmailIndex += 1
              previousEmailId = currentEmailId
              currentEmailId = ""

              // currentEmailSequenceId = ""
              // nextPrompt = `Write email # ${currentEmailIndex} of ${formData.wordCount}`
              // prompt = `{"role": "assistant", "content": "${reply
              //   .replace(/\n/g, "\\n")
              //   .replace(/&/g, "\\&")
              //   .replace(/"/g, '\\"')
              //   .replace(/\u00A0/g, " ")}"}`
              console.log("PREVIOUS EMAIL ID", previousEmailId)
              handleGenerate()
            }}
            class="btn btn-success"
            disabled={isTyping}
          >
            Generate Next
          </button>
        {/if}
        {#if currentEmailIndex < formData.numEmails && nextEmailId}
          <button
            on:click={() => {
              // previousEmailId = currentEmailId
              // loadEmailId = nextEmailId
              currentEmailIndex += 1

              handleLoad()
            }}
            class="btn btn-outline"
            disabled={isTyping}
          >
            Next
          </button>
        {/if}
      </div>
    </div>
  {/if}

  {#if !reply && !isLoading && !$showForm && !isLoadingSequences}
    {#if $isSelectionMode}
      <div class="bulk-actions">
        <button class="btn btn-outline" on:click={selectAll}>Select All</button>
        <button class="btn btn-outline" on:click={cancelSelection}
          >Cancel</button
        >
        <button
          class="btn btn-outline"
          on:click={() => {
            deletingSelectedSequences = true
            openSelectedDeleteModal()
          }}>Delete Selected</button
        >
      </div>
    {/if}

    <!-- <button class="plus-sign" on:click={toggleShowForm}>+ New</button> -->
    <!-- <button class="plus-sign" on:click={openCopyTypeModal}>+ New</button> -->
    <div class="main-list">
      {#each $emailSequences as emailSequence (emailSequence.id)}
        <div
          class="email-box {$isSelectionMode
            ? 'hover-mode selection-mode'
            : ''}"
          on:mouseenter={() => event.currentTarget.classList.add("hover-mode")}
          on:mouseleave={() =>
            event.currentTarget.classList.remove("hover-mode")}
        >
          <input
            type="checkbox"
            class="select-checkbox"
            checked={$selectedSequences.has(emailSequence.id)}
            on:click={() => isSelectionMode.set(true)}
            on:change={() => {
              toggleSelection(emailSequence.id)
              if (!$selectedSequences.size) {
                cancelSelection()
              }
            }}
          />
          <span
            class="sequence-name"
            on:click={() => {
              currentEmailIndex = 1
              currentEmailSequenceId = emailSequence.id
              currentEmailSequenceName = emailSequence.name
              formData.numEmails = emailSequence.steps
              formData.wordCount = emailSequence.word_count
              selectedCopyType = emailSequence.copy_type
              handleLoad()
            }}>{emailSequence.name}</span
          >
          <div class="actions">
            <!-- <button
              class="btn btn-outline"
              on:click={() => {
                currentEmailIndex = 1
                currentEmailSequenceId = emailSequence.id
                currentEmailSequenceName = emailSequence.name
                formData.numEmails = emailSequence.steps
                formData.wordCount = emailSequence.word_count
                selectedCopyType = emailSequence.copy_type
                handleLoad()
              }}
            >
              Open
            </button> -->
            <button
              class="btn btn-outline"
              on:click={() => openRenameModal(emailSequence)}>Rename</button
            >
            <button
              class="btn btn-outline"
              on:click={() => {
                deletingSequence = true
                openDeleteModal(emailSequence)
              }}>Delete</button
            >
          </div>
        </div>
      {/each}

      <button
        class="btn btn-primary"
        on:click={loadMore}
        disabled={!hasMoreRecords || isLoadingNewSequences}
      >
        {#if !hasMoreRecords}
          No More Records
        {:else}
          {isLoadingNewSequences ? "Loading..." : "Show More"}
        {/if}
      </button>
    </div>
  {/if}
</main>

{#if isModalOpen}
  <div class="modala">
    <label for="newName">New Name:</label>
    <input bind:value={newName} id="newName" />

    <button on:click={saveName} disabled={isSaving}>
      {#if isSaving}Saving...{:else}Save{/if}
    </button>

    <button on:click={closeRenameModal} disabled={isSaving}> Cancel </button>
  </div>
{/if}

{#if isDeleteModalOpen}
  <div
    class="modal-backdrop"
    role="dialog"
    aria-modal="true"
    on:click={closeDeleteModal}
  >
    <div class="copy-type-modal" role="document" on:click|stopPropagation>
      <h3>Confirm Delete?</h3>

      <ul>
        <li>
          <button
            class="red"
            on:click={() => {
              if (deletingSequence) {
                deleteEmailSequence()
              } else if (deletingSelectedSequences) {
                deleteSelected()
              }
            }}
            disabled={isSaving}
          >
            {#if isSaving}Deleting...{:else}Delete{/if}
          </button>
        </li>
        <li>
          <button on:click={closeDeleteModal} disabled={isSaving}>
            Cancel
          </button>
        </li>
      </ul>
    </div>
  </div>
{/if}

{#if isCopyTypeModalOpen}
  <div
    class="modal-backdrop"
    role="dialog"
    aria-modal="true"
    on:click={closeCopyTypeModal}
  >
    <div class="copy-type-modal" role="document" on:click|stopPropagation>
      <h3>Select Copy Type</h3>
      <ul>
        {#each $copyTypes as type (type.id)}
          <li>
            <button on:click={() => handleCopyTypeSelection(type)}>
              {type.name}
            </button>
          </li>
        {/each}
      </ul>
      <button class="red" on:click={closeCopyTypeModal}>Cancel</button>
    </div>
  </div>
{/if}

<style>
  main {
    background: rgba(255, 255, 255, 0); /* Transparent white background */
  }
  .all-caps {
    text-transform: uppercase;
  }
  .plus-sign {
    position: absolute;
    top: 10px;
    right: 60px;
    font-size: 18px;
    background: #4caf50;
    color: white;
    border: none;
    padding: 10px 20px;
    border-radius: 20px;
    cursor: pointer;
    z-index: 1000;
  }

  .plus-sign:hover {
    background: #45a049;
  }

  .form-container {
    display: grid;
    grid-template-columns: repeat(2, 1fr);
    gap: 20px;
    max-width: 800px;
    margin: auto;
    padding: 20px;
    border-radius: 10px;
    box-shadow: 0 0 10px rgba(0, 0, 0, 0.1);
  }

  .form-section {
    width: 100%;
  }

  .button-container {
    grid-column: span 2;
    text-align: center;
    margin-top: 0px;
  }

  .submit-button {
    background-color: #3490dc; /* Solid color for the button */
    color: white;
    padding: 10px 20px;
    border: none;
    border-radius: 5px;
    cursor: pointer;
  }
  .spinner-container {
    display: flex;
    align-items: center;
    justify-content: center;
    height: 80vh;
  }

  .spinner {
    border: 6px solid rgba(0, 0, 0, 0.1);
    border-radius: 50%;
    border-top: 6px solid #3490dc; /* Set the color of the spinner */
    width: 48px;
    height: 48px;
    animation: spin 1s linear infinite; /* Add a spinning animation */
  }

  @keyframes spin {
    0% {
      transform: rotate(0deg);
    }
    100% {
      transform: rotate(360deg);
    }
  }
  .textarea-container {
    position: relative;
  }

  .copy-button {
    cursor: pointer;
    opacity: 0.8;
    position: absolute;
    right: 10px;
    top: 10px;
    scale: 0.7;
  }

  .copy-button:disabled {
    background-color: #a0aec0; /* Use a different color for the disabled state */
    cursor: not-allowed;
    opacity: 0.6;
  }
  .h-80vh {
    height: 80vh;
  }
  .resize-none {
    resize: none;
  }
  .clickable-row:hover {
    cursor: pointer;
  }
  .modala {
    position: fixed;
    top: 50%;
    left: 50%;
    transform: translate(-50%, -50%);
    background: white;
    padding: 20px;
    border-radius: 5px;
    box-shadow: 0 0 10px rgba(0, 0, 0, 0.1);
    z-index: 1000;
  }
  /* .copy-type-modal {
  background: white;
  padding: 20px;
  border-radius: 8px;
  box-shadow: 0 4px 10px rgba(0, 0, 0, 0.2);
  animation: scaleUp 0.3s ease;
}
  .copy-type-modal ul {
    list-style: none;
    padding: 0;
  }
  .copy-type-modal li {
    margin: 10px 0;
  } */

  .modal-backdrop {
    position: fixed;
    top: 0;
    left: 0;
    width: 100vw;
    height: 100vh;
    background: rgba(0, 0, 0, 0.5);
    display: flex;
    justify-content: center;
    align-items: center;
    z-index: 1000;
    animation: fadeIn 0.3s ease;
  }
  .copy-type-modal {
    background: white;
    padding: 20px;
    border-radius: 8px;
    box-shadow: 0 4px 10px rgba(0, 0, 0, 0.2);
    animation: scaleUp 0.3s ease;
  }
  .main-content {
    will-change: filter;
    width: 100%;
  }
  .main-content.blurred {
    filter: blur(5px);
    transition: filter 0.3s ease;
  }
  /* Animations */
  @keyframes fadeIn {
    from {
      opacity: 0;
    }
    to {
      opacity: 1;
    }
  }

  @keyframes scaleUp {
    from {
      transform: scale(0.9);
      opacity: 0;
    }
    to {
      transform: scale(1);
      opacity: 1;
    }
  }

  /* Modal content */
  .copy-type-modal h3 {
    margin: 0 0 15px;
    font-size: 1.5rem;
    color: #333;
  }

  .copy-type-modal ul {
    list-style: none;
    padding: 0;
    margin: 0;
  }

  .copy-type-modal li {
    margin: 10px 0;
  }

  .copy-type-modal button {
    width: 100%;
    padding: 10px;
    border: none;
    background: #4caf50;
    color: white;
    border-radius: 5px;
    cursor: pointer;
    transition: background-color 0.2s ease;
  }

  .copy-type-modal button:hover {
    background: #45a049;
  }

  /* Cancel button styling */
  .copy-type-modal button.red {
    background: #d9534f; /* Red for cancel */
  }

  .copy-type-modal button.red:hover {
    background: #c9302c;
  }

  .email-box {
    display: flex;
    /* justify-content: space-between; */
    padding: 10px;
    border: 1px solid #ccc;
    margin-bottom: 10px;
    position: relative;
    max-width: 900px;
  }

  .email-box:hover .actions {
    display: flex;
  }

  .actions {
    display: none;
    position: absolute;
    right: -20px;
    top: 0px;
    scale: 0.5;
  }

  .sequence-name {
    cursor: pointer;
    max-width: 80%;
  }

  @media (max-width: 768px) {
    .actions {
      display: flex;
      margin-left: auto;
      margin-right: 5px;
      flex-direction: column;
      /* position: relative; */
      top: -15px;
    }
    .sequence-name {
      cursor: pointer;
      max-width: 70%;
    }
  }

  .bulk-actions {
    scale: 0.7;
    margin-left: -3rem;
    position: fixed;
  }

  .select-checkbox {
    display: none;
  }

  @media (max-width: 768px) {
    .select-checkbox {
      display: inline-block;
      margin-right: 20px;
      margin-top: 2px;
    }
  }

  .hover-mode .select-checkbox {
    display: inline-block;
    margin-right: 20px;
    margin-top: 2px;
  }

  .selection-mode .select-checkbox {
    display: inline-block;
    margin-right: 20px;
    margin-top: 2px;
  }
  .main-list {
    padding-top: 50px;
    width: 100%;
  }
</style>
