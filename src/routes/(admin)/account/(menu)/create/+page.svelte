<script lang="ts">
  import { getContext } from "svelte"
  import type { Writable } from "svelte/store"
  import { onMount } from "svelte"
  import { writable } from "svelte/store"
  // import { createClient } from "@supabase/supabase-js"
  import { debounce } from "lodash"

  // import { PUBLIC_SUPABASE_URL } from "$env/static/public"
  // import { PUBLIC_SUPABASE_ANON_KEY } from "$env/static/public"

  // const supabase = createClient(PUBLIC_SUPABASE_URL, PUBLIC_SUPABASE_ANON_KEY)

  export let data
  // console.log("DATA", data)
  let customerPlanId = data.customerPlanId

  //set planType as Paid if customerPlanId is 2 or 5 and Premium  if 3 or 6 and Free if 1
  let planType =
    customerPlanId == 2 || customerPlanId == 5
      ? "Paid"
      : customerPlanId == 3 || customerPlanId == 6
        ? "Premium"
        : "Free"

  // let customerCredits = data.customerCredits
  // let totalCredits = data.totalCredits
  // let customerPlanId = data.customerPlanId
  // let customerPlan = data.customerPlan

  let adminSection: Writable<String> = getContext("adminSection")
  adminSection.set("create")

  let formData = {}
  let formFields = writable([])

  let isLoading = false
  let reply = ""
  let currentEmailId = ""
  let currentEmailSequenceId = ""
  let currentEmailSequenceName = ""
  let currentEmailSequenceSteps = 1
  let modelInstructions,
    prompt = "",
    nextPrompt,
    previousEmailId,
    nextEmailId,
    loadEmailId
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
  let deletingSequence = false
  let deletingSelectedSequences = false
  let isRegenerate = 0
  let isGenerating = false

  let currentPage = 1 // Tracks the current page
  const itemsPerPage = 10 // Number of results per page
  let updatedRecordCount = itemsPerPage

  // Store for email sequences and selection state
  let isSelectionMode = writable(false)
  let selectedSequences = writable(new Set())

  let isTyping = false
  let displayedText = "" // The text progressively shown with the typing effect
  let typingSpeed = 2 // Adjust the typing speed (milliseconds per character)

  let searchTerm = ""
  let resultsCount = 0
  let isSearching = false
  let progress = 0 // Progress percentage
  let intervalId
  let isStepRename = false
  let isStepDelete = false
  let isStepModalOpen = false
  let deleteConfirm

  let copyTemplates = writable([])
  let selectedCopyTypeId = null
  let selectedCopyTemplate = null
  let selectedCopyTemplateId = null
  let selectedCopyTemplateForm = null
  let isCopyTemplateModalOpen = false

  let isUpgradeModalOpen = false

  async function fetchCopyTemplates(copyTypeId) {
    const formDataString = `copyTypeId=${copyTypeId}`
    const response = await fetch("/account/api?/fetchCopyTemplates", {
      method: "POST",
      headers: {
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body: formDataString,
    })
    if (response.ok) {
      const result = await response.json()
      const jsonCopyTemplateData = JSON.parse(result.data)
      const jsonCopyTemplateDataC = JSON.parse(jsonCopyTemplateData[1])

      console.log("JSON C", jsonCopyTemplateDataC)
      copyTemplates.set(jsonCopyTemplateDataC)
      console.log("COPY TEMPLATES", $copyTemplates)
    } else {
      console.error("Failed to fetch copy templates")
    }
  }

  function handleCopyTypeSelection(type) {
    copyTemplates.set([])
    selectedCopyType = type.name
    selectedCopyTypeId = type.id
    fetchCopyTemplates(selectedCopyTypeId)
    isCopyTypeModalOpen = false
    isCopyTemplateModalOpen = true
  }

  function handleCopyTemplateSelection(template) {
    selectedCopyTemplate = template.name
    selectedCopyTemplateId = template.id
    selectedCopyTemplateForm = template.form_data
    // selectedCopyTemplateForm = JSON.stringify(selectedCopyTemplateForm)

    formFields.set(selectedCopyTemplateForm)

    isCopyTemplateModalOpen = false

    showForm.set(true)

    console.log("SELECTED COPY TEMPLATE", template)
  }

  function closeCopyTemplateModal() {
    isCopyTemplateModalOpen = false
  }

  function closeCopyTypeModal() {
    isCopyTypeModalOpen = false
  }

  function openRenameModal(sequence) {
    currentSequence = sequence
    newName = sequence.name
    // userId = sequence.user_id
    currentSequenceId = sequence.id
    isModalOpen = true

    console.log("OPEN MODAL", currentSequence, newName, isModalOpen)
  }

  function openStepModal() {
    isStepModalOpen = true
    newName = currentEmailSequenceName
    currentSequenceId = currentEmailSequenceId
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

  function closeStepModal() {
    isStepModalOpen = false
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

        if ((isStepModalOpen = true)) {
          currentEmailSequenceName = newName
        }
      } else {
        console.error("Update Name failed")
        // Handle error appropriately
      }
    } catch (error) {
      console.error("Error updating sequence name:", error.message)
      // Handle error
    } finally {
      isSaving = false
      isStepModalOpen = false
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

        if ((isStepModalOpen = true)) {
          currentEmailSequenceName = newName
          currentEmailIndex = 0
          currentEmailId = ""
          currentEmailSequenceId = ""
          reply = ""
          previousEmailId = null
          nextEmailId = null
        }

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
      isStepModalOpen = false
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
    // isLoading = true

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
    progress = 0

    // Start a timer to update the progress
    intervalId = setInterval(() => {
      if (progress < 99) {
        progress += 1 // Simulate progress
      }
    }, 150)

    /*add 1 to updatedRecordCount to track the number of records fetched so far*/
    // updatedRecordCount++

    showForm.set(false)
    console.log("CURRENT INDEX", currentEmailIndex)
    // Convert form data to form-encoded string
    //  const formDataString = Object.entries(formData)
    //   .map(([key, value]) => `${encodeURIComponent(key)}=${encodeURIComponent(value)}`)
    //   .join('&')
    console.log("EMAIL ID", currentEmailId)
    console.log("EMAIL SEQ", currentEmailSequenceId)

    // const formDataString = `fullPrompt=[${prompt}]&emailId=${currentEmailId}&emailSequenceId=${currentEmailSequenceId}&currentEmailIndex=${currentEmailIndex}&steps=${formData.numberOfEmails}&wordCount=${formData.wordCount}`
    const formDataString = new URLSearchParams({
      emailId: currentEmailId,
      emailSequenceId: currentEmailSequenceId,
      currentEmailIndex: currentEmailIndex.toString(),
      json: JSON.stringify({ ...formData }),
      reply: reply,
      copyType: selectedCopyType,
      copyTemplate: selectedCopyTemplate,
      copyTemplateId: selectedCopyTemplateId,
      previousEmailId: previousEmailId,
      // copyTemplateForm: selectedCopyTemplateForm,
      isRegenerate: isRegenerate.toString(),
      // prompt: prompt,
    }).toString()

    console.log("FORM DATA STRING", formDataString)

    try {
      const response = await fetch("/account/api?/generateReply", {
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
          currentEmailSequenceSteps = jsonData[5]
        }
        currentEmailSequenceId =
          jsonData.length === 8 ? jsonData[7] : jsonData[6]
        currentEmailId = jsonData[6]

        reply = replyValue
        // Update the reply variable with the fetched data
        // reply = reply;

        // Process result
        progress = 100 // Mark progress complete

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
      clearInterval(intervalId) // Stop the timer
      // Trigger the typing effect when the component mounts or reply updates
      typeText(reply)
    }
  }

  async function handleLoad() {
    isLoading = true

    console.log("CURRENT INDEX", currentEmailIndex)
    console.log("STEPSSSSSSSSSS", currentEmailSequenceSteps)
    // Convert form data to form-encoded string
    //  const formDataString = Object.entries(formData)
    //   .map(([key, value]) => `${encodeURIComponent(key)}=${encodeURIComponent(value)}`)
    //   .join('&')
    console.log("EMAIL ID", currentEmailId)
    console.log("EMAIL SEQ", currentEmailSequenceId)
    console.log("LOADED COPY TYPE", selectedCopyType)
    const formDataString = `selectedCopyTemplateId=${selectedCopyTemplateId}&emailSequenceId=${currentEmailSequenceId}&currentEmailIndex=${currentEmailIndex}`

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
        selectedCopyTemplateForm = jsonData[7]
        //convert from array to object
        selectedCopyTemplateForm = JSON.parse(selectedCopyTemplateForm)
        console.log("SELECTED COPY TEMPLATE FORM", selectedCopyTemplateForm)
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
      formFields.set(selectedCopyTemplateForm)
      isLoading = false
    }
  }

  async function fetchEmailSequences(page = 1) {
    // if (!hasMoreRecords) return // Exit if no more records or already loading
    // isLoadingSequences = true

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

        //  // Append new results for subsequent pages, ignoring duplicates
        //  const existingIds = $emailSequences.map((s) => s.id)
        // const newSequences = jsonDataC.filter(
        //   (s) => !existingIds.includes(s.id),
        // )
        // emailSequences.update((existing) => [...existing, ...newSequences])
      }
      updatedRecordCount = $emailSequences.length
      if (updatedRecordCount < 10) {
        updatedRecordCount = 10
      }
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
    // isLoadingSequences = true
    // if (updatedRecordCount < 10) {
    //   updatedRecordCount = 10
    // }

    const formDataString = `page=1&limit=${updatedRecordCount}&searchTerm=${searchTerm}`

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
    currentEmailIndex = 0
    currentEmailId = ""
    currentEmailSequenceId = ""
    reply = ""
    previousEmailId = null
    nextEmailId = null
    formData = {}
    fetchUpdatedEmailSequences()
    showForm.set(false)
  }

  function openCopyTypeModal() {
    isCopyTypeModalOpen = true
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
        closeDeleteModal()

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
        const replyTextAreaDiv = document.getElementById("replyTextArea")
        if (replyTextAreaDiv) {
          replyTextAreaDiv.scrollTop = replyTextAreaDiv.scrollHeight
        }
      } else {
        isTyping = false
      }
    }

    typeNextChar()
  }
  // // Trigger the typing effect when the component mounts or reply updates
  // $: if (reply) typeText(reply)

  // onMount(fetchEmailSequences)

  // Search email sequences from the server
  const fetchResults = debounce(async () => {
    if (searchTerm.length >= 6) {
      isSearching = true

      try {
        // const res = await fetch(`/api/search?query=${searchTerm}`)
        // const data = await res.json()

        // // Update the store with the fetched data
        // emailSequences.set(data.emailSequences || [])

        // if (updatedRecordCount < 10) {
        //   updatedRecordCount = 10
        // }

        const formDataString = `page=1&limit=${updatedRecordCount}&searchTerm=${searchTerm}`

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
          emailSequences.set(jsonDataC)
        }

        resultsCount = $emailSequences.length || 0
      } catch (error) {
        console.error("Error fetching results:", error)
        emailSequences.set([]) // Clear the store in case of error
        resultsCount = 0
      }
    } else {
      // emailSequences.set([]) // Clear the store for shorter terms
      resultsCount = 0
    }
  }, 300) // 300ms debounce delay

  // Trigger search when searchTerm changes
  $: fetchResults()

  onMount(() => {
    fetchEmailSequences(currentPage)
    fetchCopyTypes()
  })

  function handleOptionClick(option, field) {
    if (option.isPremium && planType === "Free") {
      isUpgradeModalOpen = true
    } else {
      formData[field.key] = option.value || option
      field.showOptions = false
    }
  }

  function closeUpgradeModal() {
    isUpgradeModalOpen = false
  }
</script>

<!--CONTENT STARTS HERE------------------------------------------------------------------------------------------- -->

<svelte:head>
  <title>Create</title>
</svelte:head>

<div>
  {#if !reply && !isLoading && !$showForm && !isLoadingSequences}
    <!-- <button class="plus-sign" on:click={toggleShowForm}>+ New</button> -->
    <!-- <button class="plus-sign" on:click={openCopyTypeModal}>+ New</button> -->
  {/if}
</div>

<main
  class="main-content {isModalOpen ||
  isStepModalOpen ||
  isCopyTypeModalOpen ||
  isDeleteModalOpen ||
  isCopyTemplateModalOpen ||
  isUpgradeModalOpen
    ? 'blurred'
    : ''}"
>
  {#if isLoading || isLoadingSequences}
    <div class="spinner-container">
      <span class="loading loading-dots loading-lg text-primary"></span>

      <p class="text-center text-sm mt-2 text-gray-400">
        {#if isGenerating}
          <div class="progress-container">
            <div class="progress-bar bg-primary" style="width: {progress}%;">
              <span class="progress-text">{progress}%</span>
            </div>
          </div>
          <!-- Crafting... -->
          {#if progress <= 30}
            Thinking...
          {/if}
          {#if progress > 30}
            Composing...
          {/if}
        {:else}
          Loading...
        {/if}
      </p>
    </div>
  {/if}

  <!-- {#if !reply && !isLoading && $showForm} -->
  {#if !isLoading && ($showForm || reply)}
    <div class="main-form-container">
      <button
        class="text-gray-700 hover:text-gray-900 py-1 px-2"
        on:click={() => {
          toggleHideForm()
        }}>&larr; Back</button
      >
      <form
        id="create-form"
        on:submit|preventDefault={handleSubmit}
        class="form-container"
      >
        {#each $formFields as field (field.key)}
          <div class="form-section">
            {#if field.type === "textarea" && !field.condition}
              <label
                class="block text-gray-700 text-sm font-bold mb-2"
                for={field.key}
              >
                {field.label}:
              </label>
              <textarea
                bind:value={formData[field.key]}
                id={field.key}
                class="w-full p-2 border rounded focus:outline-none focus:shadow-outline"
                rows={field.attributes?.rows}
                maxlength={field.attributes?.maxlength}
              ></textarea>
            {/if}

            {#if field.type === "select" && !field.condition}
              <label
                class="block text-gray-700 text-sm font-bold mb-2"
                for={field.key}
              >
                {field.label}:
              </label>
              <div class="relative">
                <button
                  type="button"
                  class="w-full p-2 border rounded focus:outline-none focus:shadow-outline"
                  on:click={() => (field.showOptions = !field.showOptions)}
                >
                  {formData[field.key] || "Select an option"}
                </button>
                {#if field.showOptions}
                  <div
                    class="absolute z-10 w-full bg-white border rounded shadow-lg"
                  >
                    {#each field.options as option (option.value ? option.value : option)}
                      <div
                        class="premium-option p-2 hover:bg-gray-200 cursor-pointer"
                        on:click={() => handleOptionClick(option, field)}
                      >
                        {option.value || option}
                        {#if option.isPremium}
                          <span class="premium-tag">
                            <span class="icon">★</span> Premium
                          </span>
                        {/if}
                      </div>
                    {/each}
                  </div>
                {/if}
              </div>
            {/if}

            {#if field.type === "checkbox" && !field.condition}
              <label class="block mt-4" for={field.key}>
                <input
                  type="checkbox"
                  bind:checked={formData[field.key]}
                  class="mr-2"
                />
                {field.label}
              </label>
            {/if}

            {#if field.type === "number" && !field.condition}
              <label
                class="block text-gray-700 text-sm font-bold mb-2"
                for={field.key}
              >
                {field.label}:
              </label>
              <input
                type="number"
                bind:value={formData[field.key]}
                id={field.key}
                class="w-full p-2 border rounded focus:outline-none focus:shadow-outline"
                max={field.attributes?.max}
              />
            {/if}

            {#if field.condition}
              {#if formData[field.condition.dependsOn] === field.condition.value}
                <label
                  class="block text-gray-700 text-sm font-bold mb-2"
                  for={field.key}
                >
                  {field.label}:
                </label>
                <select
                  bind:value={formData[field.key]}
                  id={field.key}
                  class="w-full p-2 border rounded focus:outline-none focus:shadow-outline"
                >
                  {#each field.options as option (option)}
                    <option value={option}>{option}</option>
                  {/each}
                </select>
              {/if}
            {/if}
          </div>
        {/each}

        <div class="button-container">
          <button type="submit" class="btn btn-success mb-2 w-full"
            >Generate New</button
          >
          {#if currentEmailIndex === 0}
            <button
              class="btn btn-neutral w-full"
              on:click={() => {
                toggleHideForm()
              }}>Go Back</button
            >
          {/if}
        </div>
      </form>
    </div>

    <div class="reply-container">
      <div class="textarea-container">
        <!-- <textarea
          id="replyTextArea"
          bind:value={reply}
          readonly
          class="w-full p-2 border rounded focus:outline-none focus:shadow-outline h-80vh resize-none"
        ></textarea> -->
        <div
          id="replyTextArea"
          class="w-full p-2 border rounded-md focus:outline-none focus:shadow-outline overflow-auto h-[75vh]"
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
      {#if currentEmailIndex != 0}
        <div class="button-container">
          <div
            class="flex justify-center mt-1 py-2 rounded-md items-center hover:bg-base-200 cursor-pointer"
            on:click={() => {
              openStepModal()
              isStepModalOpen = true
            }}
          >
            <div class="all-caps">
              {currentEmailSequenceName}
            </div>
            <div>
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
                style="margin-left: 0.5rem;"
              >
                <polyline points="6 9 12 15 18 9"></polyline>
              </svg>
            </div>
          </div>
          <div class="mb-3">
            SEQUENCE ID # {currentEmailSequenceId}
            / STEP {currentEmailIndex} OF {currentEmailSequenceSteps}
          </div>

          <button
            on:click={() => {
              // currentEmailIndex = 0
              // currentEmailId = ""
              // currentEmailSequenceId = ""
              // reply = ""
              // previousEmailId = null
              // nextEmailId = null
              // formData = {}
              // // fetchEmailSequences()
              // fetchUpdatedEmailSequences()
              toggleHideForm()
            }}
            class="btn btn-neutral"
            disabled={isTyping}
            >{#if currentEmailIndex < currentEmailSequenceSteps}Go Back
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
          {#if !nextEmailId && currentEmailIndex != 0}
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
          {#if currentEmailIndex < currentEmailSequenceSteps && currentEmailIndex != 0 && !nextEmailId}
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
          {#if currentEmailIndex === 0}
            <button
              on:click={() => {
                handleSubmit()
              }}
              class="btn btn-success"
              disabled={isTyping}
            >
              Generate
            </button>
          {/if}
          {#if currentEmailIndex < currentEmailSequenceSteps && nextEmailId}
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
      {/if}
    </div>
  {/if}
  {#if !reply && !isLoading && !$showForm && !isLoadingSequences}
    <div class="main-head">
      <div class="search-box border-solid rounded border border-gray-300">
        <input
          type="text"
          placeholder="Search your copy collections..."
          bind:value={searchTerm}
          on:input={() => {
            if (searchTerm.length === 0) {
              fetchUpdatedEmailSequences()
              isSearching = false
            } else {
              fetchResults()
            }
          }}
        />

        {#if searchTerm.length >= 6}
          <p>
            There’s {resultsCount} copy collections matching “{searchTerm}”
          </p>
        {/if}
      </div>
      <div>
        <button class="btn btn-warning" on:click={openCopyTypeModal}
          >+ Create New</button
        >
      </div>
    </div>

    {#if $isSelectionMode}
      <div class="bulk-actions">
        <button class="btn btn-outline text-base" on:click={selectAll}
          >Select All</button
        >
        <button class="btn btn-outline text-base" on:click={cancelSelection}
          >Cancel</button
        >
        <button
          class="btn btn-outline text-base"
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
      {#if $emailSequences.length > 0}
        {#each $emailSequences as emailSequence (emailSequence.id)}
          <div
            class="email-box border-solid rounded border border-gray-300 {$isSelectionMode
              ? 'hover-mode selection-mode'
              : ''}"
            on:mouseenter={() =>
              event.currentTarget.classList.add("hover-mode")}
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
                console.log("COPY FORM DATA", emailSequence.copy_form_data)
                currentEmailIndex = 1
                currentEmailSequenceId = emailSequence.id
                currentEmailSequenceName = emailSequence.name
                currentEmailSequenceSteps = emailSequence.steps
                // formData.numberOfEmails = emailSequence.steps
                // formData.wordCount = emailSequence.word_count

                //set all formData fields using json from copy_info
                formData = emailSequence.copy_info

                selectedCopyType = emailSequence.copy_type
                selectedCopyTemplate = emailSequence.copy_template
                selectedCopyTemplateId = emailSequence.copy_template_id
                // formFields.set(emailSequence.copy_form_data)
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
                formData.numberOfEmails = emailSequence.steps
                formData.wordCount = emailSequence.word_count
                selectedCopyType = emailSequence.copy_type
                handleLoad()
              }}
            >
              Open
            </button>  -->
              <button
                class="btn btn-outline text-lg mr-2"
                on:click={() => openRenameModal(emailSequence)}>Rename</button
              >
              <button
                class="btn btn-outline text-lg `mr-2"
                on:click={() => {
                  deletingSequence = true
                  openDeleteModal(emailSequence)
                }}>Delete</button
              >
            </div>
          </div>
        {/each}
      {:else}
        <p class="mb-5">
          No collections found. <span
            on:click={openCopyTypeModal}
            class="underline cursor-pointer">Create</span
          > your first copy.
        </p>
      {/if}

      <button
        class="btn btn-primary"
        on:click={loadMore}
        disabled={!hasMoreRecords || isLoadingNewSequences || isSearching}
      >
        {#if !hasMoreRecords || isSearching}
          No More Records
        {:else}
          {isLoadingNewSequences ? "Loading..." : "Show More"}
        {/if}
      </button>
    </div>
  {/if}
</main>

{#if isModalOpen}
  <div
    class="modal-backdrop"
    role="dialog"
    aria-modal="true"
    on:click={closeRenameModal}
  >
    <div class="copy-type-modal" role="document" on:click|stopPropagation>
      <p class="mt-2 mb-4 text-center text-xl font-semibold text-neutral">
        Rename
      </p>
      <div class="border-2 rounded-md p-2">
        <input class="text-neutral w-full" bind:value={newName} id="newName" />
      </div>
      <ul>
        <li>
          <button
            class="btn btn-success btn-wide"
            on:click={saveName}
            disabled={isSaving}
          >
            {#if isSaving}Saving...{:else}Save{/if}
          </button>
        </li>

        <li>
          <button
            class="btn btn-wide"
            on:click={closeRenameModal}
            disabled={isSaving}
          >
            Cancel
          </button>
        </li>
      </ul>
    </div>
  </div>
{/if}

{#if isStepModalOpen}
  <div
    class="modal-backdrop"
    role="dialog"
    aria-modal="true"
    on:click={closeStepModal}
  >
    <div class="copy-type-modal" role="document" on:click|stopPropagation>
      <p class="mt-2 mb-4 text-center text-xl font-semibold text-neutral">
        Edit Your Copy Collection
      </p>
      <div class="border-2 rounded-md p-2">
        <input class="text-neutral w-full" bind:value={newName} id="newName" />
      </div>
      <ul>
        <li>
          <button
            class="btn btn-success btn-wide"
            on:click={saveName}
            disabled={isSaving}
          >
            {#if isSaving}Saving...{:else}Rename{/if}
          </button>
        </li>

        <li>
          <button
            class="btn btn-wide"
            on:click={closeStepModal}
            disabled={isSaving}
          >
            Cancel
          </button>
        </li>
        <li>
          <button
            class="btn btn-error btn-wide"
            on:click={() => {
              if (deleteConfirm) {
                deleteEmailSequence()
              } else {
                deleteConfirm = true
                setTimeout(() => {
                  deleteConfirm = false
                }, 5000)
              }
            }}
            disabled={isSaving}
          >
            {#if isSaving}Deleting...{:else if deleteConfirm}Confirm Delete?{:else}Delete
              Collection{/if}
          </button>
        </li>
      </ul>
    </div>
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
      <p class="mt-2 mb-4 text-center text-xl font-semibold text-neutral">
        Confirm Delete?
      </p>

      <ul>
        <li>
          <button
            class="btn btn-error btn-wide"
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
          <button
            class="btn btn-wide"
            on:click={closeDeleteModal}
            disabled={isSaving}
          >
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
      <p class="mt-2 mb-5 text-center text-xl font-semibold text-neutral">
        What Are You Looking To Create?
      </p>
      <ul>
        {#each $copyTypes as type (type.id)}
          <li>
            <button
              class="btn btn-secondary btn-wide normal-case"
              on:click={() => handleCopyTypeSelection(type)}
            >
              {type.name}
            </button>
          </li>
        {/each}
      </ul>
      <button class="btn btn-wide" on:click={closeCopyTypeModal}>Cancel</button>
    </div>
  </div>
{/if}

{#if isCopyTemplateModalOpen}
  <div
    class="modal-backdrop"
    role="dialog"
    aria-modal="true"
    on:click={closeCopyTemplateModal}
  >
    <div class="copy-type-modal" role="document" on:click|stopPropagation>
      <p class="mt-2 mb-5 text-center text-xl font-semibold text-neutral">
        Select A Template
      </p>
      <ul>
        {#each $copyTemplates as template (template.id)}
          <li>
            <button
              class="btn btn-secondary btn-wide normal-case"
              on:click={() => handleCopyTemplateSelection(template)}
            >
              {template.name}
            </button>
          </li>
        {/each}
      </ul>
      <button class="btn btn-wide" on:click={closeCopyTemplateModal}
        >Cancel</button
      >
    </div>
  </div>
{/if}

{#if isUpgradeModalOpen}
  <div
    class="modal-backdrop"
    role="dialog"
    aria-modal="true"
    on:click={closeUpgradeModal}
  >
    <div class="copy-type-modal" role="document" on:click|stopPropagation>
      <p class="mt-2 mb-4 text-center text-xl font-semibold text-neutral">
        Premium Feature
      </p>
      <p class="text-center mb-4 text-neutral">
        This feature is available only for paid plans. Please upgrade to access
        this feature.
      </p>
      <a
        href="/account/billing"
        class="btn btn-wide btn-success mb-2"
        on:click={closeUpgradeModal}>Upgrade</a
      >
      <button class="btn btn-wide" on:click={closeUpgradeModal}>Close</button>
    </div>
  </div>
{/if}

<style>
  input:focus {
    outline: none; /* Removes the black border */
  }
  .btn {
    text-transform: none;
  }

  main {
    background: rgba(255, 255, 255, 0); /* Transparent white background */
  }
  .all-caps {
    text-transform: uppercase;
  }
  .plus-sign {
    /* position: absolute;
    top: 10px;
    right: 60px; */
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
    display: flex;
    flex-direction: column;
    gap: 20px;
    max-width: 800px;
    margin: auto;
    padding: 20px;
  }

  .form-section {
    width: 100%;
  }

  .button-container {
    text-align: center;
    margin-top: 0px;
  }

  .main-form-container,
  .reply-container {
    width: 100%;
  }

  @media (min-width: 1024px) {
    .main-form-container,
    .reply-container {
      display: inline-block;
      vertical-align: top;
    }
    .reply-container {
      display: inline-block;
      vertical-align: top;
      width: 64%;
    }

    .main-form-container {
      margin-right: 1px;
      width: 35%;
      max-height: 93vh;
      overflow-y: auto;
      /* Beautify the scrollbar using Tailwind CSS */
      scrollbar-width: thin;
    }
    .main-form-container::-webkit-scrollbar {
      width: 6px;
      height: 6px;
    }
    .main-form-container::-webkit-scrollbar-track {
      background: rgba(0, 0, 0, 0.1);
    }
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
    flex-direction: column;
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
    /* height: 76vh; */
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
  /* .h-80vh {
    height: 80vh;
  } */
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
    max-width: 300px;
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

  /* .copy-type-modal button {
    width: 100%;
    padding: 10px;
    border: none;
    background: #4caf50;
    color: white;
    border-radius: 5px;
    cursor: pointer;
    transition: background-color 0.2s ease;
  } */
  /* 
  .copy-type-modal button:hover {
    background: #45a049;
  }

  /* Cancel button styling */
  /* .copy-type-modal button.red {
    background: #d9534f;
  } */

  /* .copy-type-modal button.red:hover {
    background: #c9302c;
  } */

  .email-box {
    display: flex;
    /* justify-content: space-between; */
    padding: 10px;
    /* border: 1px solid #ccc; */
    margin-bottom: 10px;
    position: relative;
    max-width: 100%;
    align-items: center; /* Vertically centers child elements, including .sequence-name */
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
    .email-box {
      max-width: 100%;
      min-height: 65px; /* Ensure consistent min-height */
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

  .search-box {
    /* margin-top: 20px; */
    /* border: 1px solid #ccc;
    border-radius: 5px; */
    padding: 10px;
    max-width: 100%;
    flex: 1;
    margin-right: 10px;
  }
  @media (max-width: 768px) {
    .search-box {
      max-width: 100%;
    }
  }
  .search-box input {
    width: 100%;
    max-width: 500px;
  }
  .search-box p {
    margin-top: 10px;
    color: #666;
  }
  .search-box ul {
    list-style-type: none;
    padding: 0;
  }
  .search-box li {
    margin-top: 5px;
    font-size: 14px;
  }

  .main-head {
    display: flex;
    /* justify-content: space-between; */
    align-items: center;
  }
  .progress-container {
    width: 100%;
    min-width: 200px;
    background-color: #f3f3f3;
    border-radius: 8px;
    margin: 10px 0;
    position: relative;
    height: 20px;
    overflow: hidden; /* Ensures text doesn't overflow the container */
  }

  .progress-bar {
    height: 100%;
    border-radius: 8px;
    transition: width 0.2s ease;
    position: relative;
    display: flex;
    align-items: center;
    justify-content: center; /* Centers the text horizontally */
    color: white; /* Text color to contrast with the bar background */
    font-weight: bold;
  }

  .progress-text {
    position: absolute;
    width: 100%;
    text-align: center;
    pointer-events: none; /* Prevents interaction with the text */
  }

  .premium-option {
    display: flex;
    align-items: center;
  }
  .premium-tag {
    display: inline-flex;
    align-items: center;
    background-color: #ffd700;
    color: #333;
    border-radius: 50px;
    font-size: 0.6rem; /* Reduced text size */
    font-weight: bold;
    padding: 2px 6px;
    margin-left: 8px;
  }

  .premium-tag .icon {
    display: inline-block;
    width: 12px;
    height: 12px;
    margin-right: 4px;
    border-radius: 50%;
    background-color: #ffd700;
    color: #333;
    font-size: 10px;
    text-align: center;
    line-height: 12px;
    font-weight: bold;
  }
</style>
