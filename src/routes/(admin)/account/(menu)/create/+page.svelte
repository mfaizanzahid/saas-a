<script lang="ts">
  import { getContext } from "svelte"
  import type { Writable } from "svelte/store"
  import { onMount } from "svelte"
  import { writable } from "svelte/store"
  import { invalidate } from "$app/navigation"
  // import { createClient } from "@supabase/supabase-js"
  import { debounce, min } from "lodash"
  import { load } from "../../create_profile/+page.js"
  import QuillEditor from "./QuillEditor.svelte"

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

  let customerCredits = data.customerCredits

  // if customerCredits are less than 1 let exhaustedCredits equal to true else false
  let exhaustedCredits = customerCredits < 1 ? true : false

  // let totalCredits = data.totalCredits
  // let customerPlanId = data.customerPlanId
  // let customerPlan = data.customerPlan
  let quillRef

  let adminSection: Writable<String> = getContext("adminSection")
  adminSection.set("create")

  let formData = {}
  let formFields = writable([])

  let isNewGenerate = false
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
    loadEmailId,
    previousSequenceId,
    nextSequenceId
  let currentEmailIndex = 0
  let isCopySuccessful = false

  let emailSequences = writable([])
  let savedResponses = writable([])
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
  let isGenerating = false,
    isLoadingCopyTemplates = false

  let isLoadResponsesModalOpen = false
  let isLoadingResponses = false
  let isSavingResponse = false
  let hasMoreResponses = true
  let searchTemplateTerm = ""
  let resultsTemplateCount = 0
  let isTemplateSearching = false

  let minChar = 5
  let minCharText = `Minimum ${minChar + 1} characters`

  let currentPage = 1 // Tracks the current page
  const itemsPerPage = 30 // Number of results per page
  let updatedRecordCount = itemsPerPage

  let currentResponsePage = 1 // Tracks the current page
  const responsesPerPage = 10 // Number of results per page
  let updatedResponseCount = responsesPerPage
  let fetchUpdatedResponses = false
  let isLoadingNewResponses = false

  // Store for email sequences and selection state
  let isSelectionMode = writable(false)
  let selectedSequences = writable(new Set())

  let isTyping = false
  let displayedText = "" // The text progressively shown with the typing effect
  let typingSpeed = 2 // Adjust the typing speed (milliseconds per character)

  let searchTerm = ""
  let resultsCount = 0
  let isSearching = false
  let isSearchingResponses = false
  let progress = 0 // Progress percentage
  let intervalId
  let isStepRename = false
  let isStepDelete = false
  let isStepModalOpen = false
  let deleteConfirm = false

  let copyTemplates = writable([])
  let selectedCopyTypeId = null
  let selectedCopyTypeWordCount
  let selectedCopyTemplate = null
  let selectedCopyTemplateId = null
  let selectedCopyTemplateForm = null
  let originalSelectedCopyTemplateId = null
  let originalFormData = {}
  let isCopyTemplateModalOpen = false
  let filterCopyTypeId,
    showFilterTypeDropdown = false

  let isUpgradeModalOpen = false
  let isSaveResponseModalOpen = false
  let responseName = ""
  let showStarred = false,
    showFilteredTypes = false,
    editorChanged = false,
    isSavingCopyReply = false,
    isSavingCopyReplySuccessfull = false

  // $: originalReply = reply

  function markEditorChanged(event: CustomEvent<string>) {
    const newText = event.detail
    console.log("Editor changed:", editorChanged)
    console.log("Editor changed TEXT:", newText)
    console.log("Original reply:", reply)
    editorChanged = newText !== reply && newText !== `<p>${reply}</p>`
  }

  async function saveEditorText() {
    isSavingCopyReply = true

    console.log("Saving editor text:", reply)
    //set reply as editor text
    reply = quillRef.root.innerHTML

    const formDataString = `reply=${reply}&copyId=${currentEmailId}&copySequenceId=${currentEmailSequenceId}`

    const response = await fetch("/account/api?/saveCopyReply", {
      method: "POST",
      headers: {
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body: formDataString,
    })
    if (response.ok) {
      const result = await response.json()
      console.log("Editor text saved successfully")
      editorChanged = false
    } else {
      console.error("Failed to save editor text")
    }
    isSavingCopyReply = false
    editorChanged = false
    isSavingCopyReplySuccessfull = true
    // Reset the button text after a short delay
    setTimeout(() => {
      isSavingCopyReplySuccessfull = false
    }, 3000)
  }

  async function fetchCopyTemplates(copyTypeId) {
    isLoadingCopyTemplates = true

    const formDataString = `copyTypeId=${copyTypeId}&searchTerm=${searchTemplateTerm}`
    const response = await fetch("/account/api?/fetchCopyTemplates", {
      method: "POST",
      headers: {
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body: formDataString,
    })
    if (response.ok) {
      const result = await response.json()
      console.log("COPY TEMPLATE RESULT", result)
      const jsonCopyTemplateData = JSON.parse(result.data)
      console.log("JSON COPY TEMPLATES", jsonCopyTemplateData)
      const jsonCopyTemplateDataC = JSON.parse(jsonCopyTemplateData[1])

      console.log("JSON C", jsonCopyTemplateDataC)
      copyTemplates.set(jsonCopyTemplateDataC)
      console.log("COPY TEMPLATES", $copyTemplates)
    } else {
      console.error("Failed to fetch copy templates")
    }
    isLoadingCopyTemplates = false
  }

  function loadResponse(response) {
    // // formData = {}
    // console.log("FORM DATA", formData)
    console.log("FORM RESPONSE", response.response)
    // //set formData to empty

    // Fetch response value from response
    const formResponse = response.response

    // // Set formData to formResponse
    formData = { ...formResponse }

    // Update formFields based on formResponse
    // Object.entries(formResponse).forEach(([key, value]) => {
    //   if ($formFields.hasOwnProperty(key)) {
    //     $formFields[key].value = value
    //   }
    // })
    console.log("FORM FIELDS", $formFields)
    console.log("FORM DATA", formData)
    isLoadResponsesModalOpen = false
  }

  function deleteResponse(response) {
    const formDataString = `responseId=${response.id}`
    fetch("/account/api?/deleteResponse", {
      method: "POST",
      headers: {
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body: formDataString,
    })
      .then((response) => {
        if (response.ok) {
          console.log("Response deleted successfully")
          console.log("UPDATED RESPONSE COUNT", updatedResponseCount)
          fetchUpdatedResponses = true
          loadResponses()
        } else {
          console.error("Failed to delete response")
        }
      })
      .catch((error) => {
        console.error("Error deleting response:", error)
      })

    // savedResponses.update((responses) => {
    //   return responses.filter((r) => r.id !== response.id)
    // })
    //decrease updatedReponseCount by 1
    // updatedResponseCount--
  }

  async function saveResponse() {
    isSaving = true
    // console.log("SAVE NAME??????", currentSequence, newName, isModalOpen)

    if (
      responseName == "" &&
      formData.product_name &&
      formData.target_audience
    ) {
      responseName = `${formData.product_name} (${formData.target_audience.slice(0, 35)}...)`
    }
    //set responseData as formData and delete wordCount and numberOfEmails
    let responseData = { ...formData }
    delete responseData.wordCount
    delete responseData.numberOfEmails
    responseData = JSON.stringify(responseData)

    const formDataString = `response=${responseData}&responseName=${responseName}`

    // Update the sequence name in the Supabase database
    try {
      const response = await fetch("/account/api?/saveResponse", {
        method: "POST",
        headers: {
          "Content-Type": "application/x-www-form-urlencoded",
        },
        body: formDataString,
      })

      if (response.ok) {
        const result = await response.json()
        const jsonData = JSON.parse(result.data)
        closeSaveResponseModal()
      } else {
        console.error("Update Response Name failed")
        // Handle error appropriately
      }
    } catch (error) {
      console.error("Error updating response name:", error.message)
      // Handle error
    } finally {
      isSaving = false
      isSaveResponseModalOpen = false
      responseName = ""
      hasMoreResponses = true
      fetchUpdatedResponses = true
      // updatedResponseCount += 1
    }
  }

  async function loadResponses(responsePage = 1) {
    isLoadingNewResponses = true
    //if savedResponses is not empty and fetchUpdatedResponses == false then do not proceed
    console.log("UPDATED RESPONSE COUNT", updatedResponseCount)
    console.log("SAVED RESPONSES", $savedResponses)
    console.log("FETCHING UPATED RESPONSES????", fetchUpdatedResponses)

    const formDataString = fetchUpdatedResponses
      ? `page=1&limit=${updatedResponseCount}&searchTerm=${searchTemplateTerm}`
      : `page=${responsePage}&limit=${responsesPerPage}`
    console.log("FORM DATA STRING", formDataString)
    const response = await fetch("/account/api?/loadAllResponses", {
      method: "POST",
      headers: {
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body: formDataString,
    })
    if (response.ok) {
      const result = await response.json()
      const jsonData = JSON.parse(result.data)
      console.log("SAVED RESPONSES JSON DATA", jsonData)
      const jsonDataC = JSON.parse(jsonData[2])
      console.log("SAVED RESPONSES JSON DATA C", jsonDataC)
      const sortedResponses = jsonDataC.sort(
        (a, b) => b.updated_at - a.updated_at,
      )

      if (jsonDataC.length < responsesPerPage) {
        hasMoreResponses = false // No more records to load
      }

      if (responsePage === 1 || isSaving || fetchUpdatedResponses) {
        // Replace the list on the first page load
        savedResponses.set(jsonDataC)
      } else {
        // Append new records to the existing list
        savedResponses.update((existingRecords) => {
          const existingIds = existingRecords.map((r) => r.id)
          const newRecords = jsonDataC.filter(
            (r) => !existingIds.includes(r.id),
          )
          return [...existingRecords, ...newRecords]
        })
      }
      updatedResponseCount = $savedResponses.length

      if (updatedResponseCount < responsesPerPage) {
        updatedResponseCount = responsesPerPage
      }

      fetchUpdatedResponses = false

      // isLoadingResponses = false
      console.log("RESPONSES", $savedResponses)
    } else {
      console.error("Failed to fetch responses")
    }
  }

  async function loadMoreResponses() {
    if (isLoadingNewResponses) return // Prevent multiple clicks
    console.log("LOADING NEW RESPONSES", isLoadingNewResponses)
    // isLoadingNewResponses = true

    try {
      console.log("LOADING NEW RESPONSES", isLoadingNewResponses)
      // currentResponsePage += 1

      //update currentResponsePage based on updatedResponseCount and responsesPerPage + 1

      currentResponsePage =
        Math.floor(updatedResponseCount / responsesPerPage) + 1

      await loadResponses(currentResponsePage) // Wait for the fetch operation to complete
      // window.scrollTo({
      //   top: document.body.scrollHeight,
      //   behavior: "smooth",
      // })
    } catch (error) {
      console.error("Error loading responses:", error)
    } finally {
      isLoadingNewResponses = false // Reset after loading completes
    }
  }

  function handleCopyTypeSelection(type) {
    // if (selectedCopyTypeId !== type.id || copyTemplates.length === 0) {
    copyTemplates.set([])
    selectedCopyType = type.name
    selectedCopyTypeId = type.id
    selectedCopyTypeWordCount = type.word_count_options

    fetchCopyTemplates(selectedCopyTypeId)
    // }
    isCopyTypeModalOpen = false
    isCopyTemplateModalOpen = true
  }

  function handleCopyTemplateSelection(template) {
    console.log("CURRENT FORM FIELDS", $formFields)

    selectedCopyTemplate = template.name
    selectedCopyTemplateId = template.id
    selectedCopyTemplateForm = template.form_data

    // selectedCopyTemplateForm = JSON.stringify(selectedCopyTemplateForm)

    formFields.set([selectedCopyTypeWordCount, ...selectedCopyTemplateForm])

    //add selectedCopyTypeWordCount to formFields in first position

    // //add selectedCopyTypeWordCount to formFields
    // formFields.update((fields) => {
    //   fields.push({ ...selectedCopyTypeWordCount })
    //   return fields
    // })

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

  function openSaveResponseModal() {
    isSaveResponseModalOpen = true
  }

  function closeSaveResponseModal() {
    isSaveResponseModalOpen = false
  }

  function openLoadResponsesModal() {
    isLoadResponsesModalOpen = true
  }

  function closeLoadResponsesModal() {
    isLoadResponsesModalOpen = false
    // hasMoreResponses = true
    // updatedResponseCount = responsesPerPage
    // currentResponsePage = 1
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

  // function copyToClipboard() {
  //   const div = document.getElementById("replyTextArea") as HTMLDivElement
  //   navigator.clipboard.writeText(div.innerText).then(() => {
  //     isCopySuccessful = true
  //     // Reset the button text after a short delay
  //     setTimeout(() => {
  //       isCopySuccessful = false
  //     }, 2000)
  //   })
  // }

  function copyToClipboard() {
    if (quillRef) {
      const text = quillRef.root.innerHTML
      navigator.clipboard.writeText(text).then(() => {
        isCopySuccessful = true
        // Reset the button text after a short delay
        setTimeout(() => {
          isCopySuccessful = false
        }, 3000)
      })
    }
  }

  async function handleSubmit() {
    // isLoading = true

    //show error alert if form required fields are not filled and return
    const requiredFields = $formFields.filter((field) => field.required)
    console.log("FORM DATA", formData)
    console.log("REQUIRED FIELDS", requiredFields)

    const emptyFields = requiredFields.filter((field) => !formData[field.key])
    console.log("EMPTY FIELDS", emptyFields)

    if (emptyFields.length > 0) {
      alert("Please fill all required fields")
      return
    }

    isNewGenerate = true
    originalSelectedCopyTemplateId = selectedCopyTemplateId
    originalFormData = { ...formData }
    await handleGenerate()
    await saveResponse()

    isNewGenerate = false
  }

  async function handleGenerate() {
    await invalidate("app:customerData")
    customerCredits = data.customerCredits
    exhaustedCredits = customerCredits < 1 ? true : false
    console.log("EXHAUSTED CREDITS STATUS", exhaustedCredits)
    console.log("CREDITS", customerCredits)
    console.log("PLAN TYPE", planType)
    console.log("GENERATING REPLY")

    //if customerCredits is less than 1 and planType is Free then show upgrade modal and return
    if (exhaustedCredits) {
      console.log("NOT ENOUGH CREDITS")
      isUpgradeModalOpen = true
      return
    }
    if (isNewGenerate) {
      console.log("NEW GENERATION---------------------")
      hasMoreRecords = true
      currentEmailIndex = 1
      currentEmailId = ""
      currentEmailSequenceId = ""
      currentEmailSequenceName = ""
      previousEmailId = null
      nextEmailId = null
    }

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
      copyTypeId: selectedCopyTypeId,
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
    originalSelectedCopyTemplateId = selectedCopyTemplateId
    originalFormData = { ...formData }

    console.log("ORIGINAL FORM DATA", originalFormData)
    console.log("FORM DATA", formData)
    fetchCopyTemplates(selectedCopyTypeId)

    console.log("CURRENT INDEX", currentEmailIndex)
    console.log("STEPSSSSSSSSSS", currentEmailSequenceSteps)
    // Convert form data to form-encoded string
    //  const formDataString = Object.entries(formData)
    //   .map(([key, value]) => `${encodeURIComponent(key)}=${encodeURIComponent(value)}`)
    //   .join('&')
    console.log("EMAIL ID", currentEmailId)
    console.log("EMAIL SEQ", currentEmailSequenceId)
    console.log("LOADED COPY TYPE", selectedCopyType)
    const formDataString = `selectedCopyTypeId=${selectedCopyTypeId}&selectedCopyTemplateId=${selectedCopyTemplateId}&emailSequenceId=${currentEmailSequenceId}&currentEmailIndex=${currentEmailIndex}`

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
        selectedCopyTypeWordCount = jsonData[8]
        //convert from array to object
        selectedCopyTemplateForm = JSON.parse(selectedCopyTemplateForm)
        console.log("SELECTED COPY TEMPLATE FORM", selectedCopyTemplateForm)
        selectedCopyTypeWordCount = JSON.parse(selectedCopyTypeWordCount)
        console.log("SELECTED COPY TYPE WORD COUNT", selectedCopyTypeWordCount)
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
      formFields.set([selectedCopyTypeWordCount, ...selectedCopyTemplateForm])
      isLoading = false
    }
  }

  async function fetchEmailSequences(page = 1) {
    // if (!hasMoreRecords) return // Exit if no more records or already loading
    // isLoadingSequences = true

    const formDataString = `page=${page}&limit=${itemsPerPage}`
    console.log("FORM DATA STRING", formDataString)
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
        // emailSequences.update((existing) => [...existing, ...jsonDataC])

        const existingIds = $emailSequences.map((s) => s.id)
        const newSequences = jsonDataC.filter(
          (s) => !existingIds.includes(s.id),
        )
        emailSequences.update((existing) => [...existing, ...newSequences])

        //  // Append new results for subsequent pages, ignoring duplicates
        //  const existingIds = $emailSequences.map((s) => s.id)
        // const newSequences = jsonDataC.filter(
        //   (s) => !existingIds.includes(s.id),
        // )
        // emailSequences.update((existing) => [...existing, ...newSequences])
      }
      updatedRecordCount = $emailSequences.length
      if (updatedRecordCount < itemsPerPage) {
        updatedRecordCount = itemsPerPage
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
    console.log("FORM DATA STRING UPDATED", formDataString)
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
      // currentPage += 1
      currentPage = Math.floor(updatedRecordCount / itemsPerPage) + 1
      console.log("CURRENT PAGE", currentPage)
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
    formFields.set([])
    fetchUpdatedEmailSequences()
    showForm.set(false)
    responseName = ""
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

  // // Function to simulate typing effect
  // function typeText(text) {
  //   displayedText = "" // Reset the displayed text
  //   let index = 0

  //   isTyping = true

  //   function typeNextChar() {
  //     if (index < text.length) {
  //       displayedText += text[index]
  //       index++
  //       setTimeout(typeNextChar, typingSpeed)
  //       const replyTextAreaDiv = document.getElementById("replyTextArea")
  //       if (replyTextAreaDiv) {
  //         replyTextAreaDiv.scrollTop = replyTextAreaDiv.scrollHeight
  //       }
  //     } else {
  //       isTyping = false
  //     }
  //   }

  //   typeNextChar()
  // }

  // Modified typeText function
  function typeText(text) {
    displayedText = "" // Reset the displayed text
    let index = 0
    isTyping = true

    function typeNextChar() {
      if (index < text.length) {
        displayedText += text[index]
        updateQuill(displayedText) // Update Quill editor content
        index++
        setTimeout(typeNextChar, typingSpeed)
      } else {
        isTyping = false
        updateQuill(text) // Ensure final content is set correctly
      }
    }

    typeNextChar()
  }

  // Add function to update Quill editor content
  function updateQuill(content) {
    if (quillRef) {
      quillRef.root.innerHTML = content
      // Auto scroll to bottom
      const editorContainer = document.querySelector(".ql-editor")
      if (editorContainer) {
        editorContainer.scrollTop = editorContainer.scrollHeight
      }
    }
  }

  // // Trigger the typing effect when the component mounts or reply updates
  // $: if (reply) typeText(reply)

  // onMount(fetchEmailSequences)

  // Search email sequences from the server
  const fetchResults = debounce(async () => {
    if (searchTerm.length > minChar) {
      console.log("SEARCHING COLLECTIONS FOR TERM", searchTerm)
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

  // Search email sequences from the server
  const fetchTemplateResults = debounce(async () => {
    if (searchTemplateTerm.length > minChar) {
      isTemplateSearching = true

      try {
        const formDataString = `copyTypeId=${selectedCopyTypeId}&searchTerm=${searchTemplateTerm}`
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
        }

        resultsTemplateCount = $copyTemplates.length || 0
      } catch (error) {
        console.error("Error fetching template results:", error)
        copyTemplates.set([]) // Clear the store in case of error
        resultsTemplateCount = 0
      }
    } else {
      resultsTemplateCount = 0
    }
    isTemplateSearching = false
  }, 300) // 300ms debounce delay

  // Trigger search when searchTemplateTerm changes
  $: fetchTemplateResults()

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

  function formatRelativeTime(dateString) {
    const now = Date.now()
    const date = new Date(dateString).getTime()
    const deltaSeconds = Math.floor((now - date) / 1000)
    console.log("deltaSeconds", deltaSeconds)
    const timeUnits = [
      { unit: "day", seconds: 86400 },
      { unit: "hour", seconds: 3600 },
      { unit: "minute", seconds: 60 },
      { unit: "second", seconds: 1 },
    ]

    for (const { unit, seconds } of timeUnits) {
      const count = Math.floor(deltaSeconds / seconds)
      console.log("count", count)
      if (count > 0) {
        return `${count} ${unit}${count > 1 ? "s" : ""} ago`
      }
    }
    return "just now"
  }

  function updateTemplateFavouriteStatus(copyTemplateId, isFavourite) {
    // isFavourite = !isFavourite
    const formDataString = `templateId=${copyTemplateId}&isFavourite=${isFavourite}`
    fetch("/account/api?/updateTemplateFavouriteStatus", {
      method: "POST",
      headers: {
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body: formDataString,
    })
      .then((response) => {
        if (response.ok) {
          fetchCopyTemplates(selectedCopyTypeId)

          console.log("Template favourite status updated successfully")
        } else {
          console.error("Failed to update template favourite status")
        }
      })
      .catch((error) => {
        console.error("Error updating template favourite status:", error)
      })
  }

  function updateEmailSequenceFavourite(
    emailSequenceId,
    emailSequenceFavourite,
  ) {
    // emailSequence.favourite = !emailSequence.favourite

    const formDataString = `emailSequenceId=${emailSequenceId}&isFavourite=${emailSequenceFavourite}`
    console.log("FORM DATA STRING", formDataString)

    fetch("/account/api?/updateEmailSequenceFavouriteStatus", {
      method: "POST",
      headers: {
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body: formDataString,
    })
      .then((response) => {
        if (response.ok) {
          fetchUpdatedEmailSequences()
        } else {
          console.error("Failed to update email sequence favourite status")
        }
      })
      .catch((error) => {
        console.error("Error updating email sequence favourite status:", error)
      })
  }

  async function showStarredSequences() {
    showStarred = !showStarred
    console.log("SHOW STARRED", showStarred)
    if (showStarred) {
      const formDataString = `isFavourite=${showStarred}`
      try {
        const response = await fetch("/account/api?/getFavouriteSequences", {
          method: "POST",
          headers: {
            "Content-Type": "application/x-www-form-urlencoded",
          },
          body: formDataString,
        })
        if (response.ok) {
          const result = await response.json()
          const jsonData = JSON.parse(result.data)
          console.log("JSON DATA", jsonData)
          const jsonDataResult = JSON.parse(jsonData[2])
          console.log("JSON DATA RESULT", jsonDataResult)
          emailSequences.set(jsonDataResult)
        } else {
          console.error("Failed to update email sequence favourite status")
        }
      } catch (error) {
        console.error("Error updating email sequence favourite status:", error)
      }
    } else {
      fetchUpdatedEmailSequences()
    }
  }

  async function filterByCopyType(id) {
    filterCopyTypeId = id
    showFilteredTypes = true
    const formDataString = `filterCopyTypeId=${filterCopyTypeId}`
    try {
      const response = await fetch("/account/api?/filterByCopyType", {
        method: "POST",
        headers: {
          "Content-Type": "application/x-www-form-urlencoded",
        },
        body: formDataString,
      })
      if (response.ok) {
        const result = await response.json()
        const jsonData = JSON.parse(result.data)
        console.log("JSON DATA", jsonData)
        const jsonDataResult = JSON.parse(jsonData[2])
        console.log("JSON DATA RESULT", jsonDataResult)
        emailSequences.set(jsonDataResult)
      } else {
        console.error("Failed to update email sequence favourite status")
      }
    } catch (error) {
      console.error("Error updating email sequence favourite status:", error)
    }
  }
  // Set default values for select fields
  $: {
    $formFields.forEach((field) => {
      if (field.type === "select" && !formData[field.key]) {
        formData[field.key] = field.options[0].value || field.options[0]
      }
    })
  }

  onMount(() => {
    fetchEmailSequences(currentPage)
    fetchCopyTypes()
  })
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
      <div class="flex justify-between items-center">
        <button
          class="btn btn-outline btn-sm py-1 px-2"
          on:click={() => {
            toggleHideForm()
          }}>&larr; Back</button
        >
        <div class="space-x-1 mr-2">
          <button
            class="btn btn-outline btn-sm py-1 px-2"
            on:click={() => {
              //set responseName to product_name + target_audience
              if (formData.product_name && formData.target_audience) {
                responseName = `${formData.product_name} (${formData.target_audience.slice(0, 35)}...)`
              }

              openSaveResponseModal()
            }}>Save Product</button
          >
          <button
            class="btn btn-outline btn-sm py-1 px-2"
            on:click={() => {
              isLoadResponsesModalOpen = true

              if ($savedResponses.length === 0 || fetchUpdatedResponses) {
                loadResponses()
              }
            }}>Load Product</button
          >
        </div>
      </div>
      <form
        id="create-form"
        on:submit|preventDefault={handleSubmit}
        class="form-container pt-4 pr-2 text-xs"
      >
        <div
          class="form-section border-base-200 bg-base-100 border rounded-xl p-2"
        >
          <div class=" w-full text-left">
            <label
              for="copyTemplate"
              class="font-bold text-gray-700 text-xs mb-2 inline-flex items-center"
              >Selected {selectedCopyType} Template</label
            >
            <select
              id="copyTemplate"
              class="w-full p-2 border rounded focus:outline-none focus:shadow-outline"
              required={true}
              value={selectedCopyTemplateId}
              on:change={(e) =>
                handleCopyTemplateSelection(
                  $copyTemplates.find(
                    (template) => template.id === Number(e.target.value),
                  ),
                )}
            >
              {#each $copyTemplates as template (template.id)}
                <option value={template.id}>{template.name}</option>
              {/each}
            </select>
          </div>
        </div>
        {#each $formFields as field (field.key)}
          <div
            class="form-section border-base-200 bg-base-100 border rounded-xl p-2"
          >
            {#if field.type === "textarea" && !field.condition}
              <!-- <div tabindex="0" class="collapse collapse-arrow bg-base-100">
                <div
                  class="collapse-title text-xs font-bold pl-2 pr-3 pt-0 pb-0 min-h-[0.2rem]"
                  for={field.key}
                >
                  {field.label}
                </div>
                <div class="collapse-content p-2">
                  <p>{field.info}</p>
                </div>
              </div> -->
              <div class="tooltip w-full text-left" data-tip={field.info}>
                <label
                  class="font-bold text-gray-700 text-xs mb-2 inline-flex items-center"
                  for={field.key}
                >
                  {field.label}
                  {field.required ? "*" : ""}
                  <span
                    class="icon ml-1 bg-base-300 text-white rounded-full w-3 h-3 flex items-center justify-center text-xs"
                    >i</span
                  >
                </label>
              </div>

              <textarea
                bind:value={formData[field.key]}
                id={field.key}
                class="w-full mt-2 p-2 border rounded-xl focus:outline-none focus:shadow-outline overflow-y-auto scrollbar-thin"
                rows={field.rows ? field.rows : 3}
                maxlength={field.maxlength}
                minlength={field.minlength}
                required={field.required}
                placeholder={field.value}
              ></textarea>
            {/if}

            {#if field.type === "select" && !field.condition}
              <label
                class="block font-bold text-gray-700 text-xs mb-2"
                for={field.key}
              >
                {field.label}
                {field.required ? "*" : ""}
              </label>
              <div class="relative">
                <button
                  type="button"
                  class="w-full p-2 border rounded focus:outline-none focus:shadow-outline flex items-center justify-between"
                  on:click={() => (field.showOptions = !field.showOptions)}
                  on:blur={() => (field.showOptions = false)}
                  required={field.required}
                >
                  {formData[field.key]}
                  <span class="icon ml-1">
                    <svg
                      xmlns="http://www.w3.org/2000/svg"
                      class="h-4 w-4"
                      fill="none"
                      viewBox="0 0 24 24"
                      stroke="currentColor"
                    >
                      <path
                        stroke-linecap="round"
                        stroke-linejoin="round"
                        stroke-width="2"
                        d="M19 9l-7 7-7-7"
                      />
                    </svg>
                  </span>
                </button>
                {#if field.showOptions}
                  <div
                    class="absolute z-10 w-full bg-white border rounded shadow-lg"
                    tabindex="0"
                    on:mousedown|preventDefault
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
              <label class="block mt-4 font-bold text-xs" for={field.key}>
                <input
                  type="checkbox"
                  bind:checked={formData[field.key]}
                  class="mr-2"
                  required={field.required}
                />
                {field.label}
                {field.required ? "*" : ""}
              </label>
            {/if}

            {#if field.type === "number" && !field.condition}
              <label
                class="block font-bold text-gray-700 text-xs mb-2"
                for={field.key}
              >
                {field.label}
                {field.required ? "*" : ""}
              </label>
              <input
                type="number"
                bind:value={formData[field.key]}
                id={field.key}
                class="w-full p-2 border rounded focus:outline-none focus:shadow-outline"
                max={field.maxlength}
                min={field.minlength}
                required={field.required}
              />
            {/if}

            {#if field.condition}
              {#if formData[field.condition.dependsOn] === field.condition.value}
                <label
                  class="block font-bold text-gray-700 text-xs mb-2"
                  for={field.key}
                >
                  {field.label}
                  {field.required ? "*" : ""}
                </label>
                <select
                  bind:value={formData[field.key]}
                  id={field.key}
                  class="w-full p-2 border rounded focus:outline-none focus:shadow-outline"
                  required={field.required}
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
          {#if currentEmailIndex === 0 || !reply}
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

    <div class="reply-container mt-5 lg:mt-0">
      <div class="flex justify-between items-center mb-2">
        <div class="text-base self-start">
          {selectedCopyType}: {selectedCopyTemplate} Template Output
        </div>
        <div class="flex self-end z-10">
          <div class="mr-1">
            <button
              on:click={copyToClipboard}
              class="tooltip tooltip-bottom btn btn-sm btn-outline btn-square py-1 px-2"
              data-tip="Copy"
              disabled={!reply || isCopySuccessful}
            >
              {#if isCopySuccessful}
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  width="15"
                  height="15"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="#ffffff"
                  stroke-width="2"
                  stroke-linecap="round"
                  stroke-linejoin="round"
                  ><polyline points="20 6 9 17 4 12"></polyline></svg
                >
              {:else}
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  width="15"
                  height="15"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="#000000"
                  stroke-width="2"
                  stroke-linecap="round"
                  stroke-linejoin="round"
                  ><rect x="9" y="9" width="10" height="10" rx="2" ry="2"
                  ></rect><path
                    d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"
                  ></path></svg
                >
              {/if}
            </button>
          </div>
          <div class="mr-1">
            <button
              on:click={saveEditorText}
              class="tooltip tooltip-bottom btn btn-outline btn-sm btn-square py-1 px-2"
              data-tip="Save"
              disabled={isSavingCopyReply || !currentEmailId || !editorChanged}
            >
              {#if isSavingCopyReplySuccessfull}
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  width="15"
                  height="15"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="#ffffff"
                  stroke-width="2"
                  stroke-linecap="round"
                  stroke-linejoin="round"
                  ><polyline points="20 6 9 17 4 12"></polyline></svg
                >
              {:else}
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  width="15"
                  height="15"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="#000000"
                  stroke-width="2"
                  stroke-linecap="round"
                  stroke-linejoin="round"
                >
                  <path
                    d="M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v11a2 2 0 0 1-2 2z"
                  ></path>
                  <polyline points="17 21 17 13 7 13 7 21"></polyline>
                  <polyline points="7 3 7 8 15 8"></polyline>
                </svg>
              {/if}
            </button>
          </div>
        </div>
      </div>
      <div class="textarea-container">
        <!-- <textarea
          id="replyTextArea"
          bind:value={reply}
          readonly
          class="w-full p-2 border rounded focus:outline-none focus:shadow-outline h-80vh resize-none"
        ></textarea> -->
        <div>
          <div class="textarea-container">
            <QuillEditor
              bind:quill={quillRef}
              bind:value={reply}
              readOnly={isTyping}
              on:input={markEditorChanged}
            />
          </div>
        </div>
        <!-- <div
          id="replyTextArea"
          class="w-full p-2 border rounded-md focus:outline-none focus:shadow-outline overflow-auto h-[70vh]"
          style="white-space: pre-wrap"
        >
          {#if !isTyping}
            {reply}
          {:else}
            {displayedText}
          {/if}
        </div> -->
      </div>

      <div class="button-container" class:pt-2={!reply}>
        {#if currentEmailIndex != 0 && reply}
          <div class="flex justify-between items-center">
            <div class="flex justify-center mt-1 p-0 rounded-md items-center">
              {#if previousSequenceId}
                <button
                  on:click={() => {
                    const emailSequence = $emailSequences.find(
                      (seq) => seq.id === previousSequenceId,
                    )
                    if (emailSequence) {
                      currentEmailIndex = 1
                      currentEmailSequenceId = emailSequence.id
                      currentEmailSequenceName = emailSequence.name
                      currentEmailSequenceSteps = emailSequence.steps
                      formData = emailSequence.copy_info
                      selectedCopyType = emailSequence.copy_type
                      selectedCopyTypeId = emailSequence.copy_type_id
                      selectedCopyTemplate = emailSequence.copy_template
                      selectedCopyTemplateId = emailSequence.copy_template_id

                      // Update previousSequenceId and nextSequenceId
                      const currentIndex = $emailSequences.findIndex(
                        (seq) => seq.id === emailSequence.id,
                      )
                      previousSequenceId =
                        currentIndex > 0
                          ? $emailSequences[currentIndex - 1].id
                          : null
                      nextSequenceId =
                        currentIndex < $emailSequences.length - 1
                          ? $emailSequences[currentIndex + 1].id
                          : null

                      handleLoad()
                    }
                  }}
                  class="tooltip flex items-center justify-center btn btn-outline btn-sm btn-square text-xs text-base"
                  data-tip="Previous"
                >
                  <svg
                    xmlns="http://www.w3.org/2000/svg"
                    width="18"
                    height="18"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    stroke-width="2"
                    stroke-linecap="round"
                    stroke-linejoin="round"><path d="M15 18l-6-6 6-6" /></svg
                  >
                </button>
              {/if}
            </div>

            <div
              class="flex justify-center mt-1 py-1 rounded-md items-center hover:bg-base-200 cursor-pointer flex-1"
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
            <div class="flex justify-center mt-1 p-0 rounded-md items-center">
              {#if nextSequenceId}
                <button
                  on:click={() => {
                    const emailSequence = $emailSequences.find(
                      (seq) => seq.id === nextSequenceId,
                    )
                    if (emailSequence) {
                      currentEmailIndex = 1
                      currentEmailSequenceId = emailSequence.id
                      currentEmailSequenceName = emailSequence.name
                      currentEmailSequenceSteps = emailSequence.steps
                      formData = emailSequence.copy_info
                      selectedCopyType = emailSequence.copy_type
                      selectedCopyTypeId = emailSequence.copy_type_id
                      selectedCopyTemplate = emailSequence.copy_template
                      selectedCopyTemplateId = emailSequence.copy_template_id

                      // Update previousSequenceId and nextSequenceId
                      const currentIndex = $emailSequences.findIndex(
                        (seq) => seq.id === emailSequence.id,
                      )
                      previousSequenceId =
                        currentIndex > 0
                          ? $emailSequences[currentIndex - 1].id
                          : null
                      nextSequenceId =
                        currentIndex < $emailSequences.length - 1
                          ? $emailSequences[currentIndex + 1].id
                          : null

                      handleLoad()
                    }
                  }}
                  class="tooltip flex items-center justify-center btn btn-outline btn-sm btn-square text-xs text-base"
                  data-tip="Next"
                >
                  <svg
                    xmlns="http://www.w3.org/2000/svg"
                    width="18"
                    height="18"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    stroke-width="2"
                    stroke-linecap="round"
                    stroke-linejoin="round"><path d="M9 18l6-6-6-6" /></svg
                  >
                </button>
              {/if}
            </div>
          </div>
          <div class="mb-3">
            SEQUENCE ID # {currentEmailSequenceId}
            / STEP {currentEmailIndex} OF {currentEmailSequenceSteps}
          </div>
        {/if}
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
          {:else}Done{/if}
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
        {#if !nextEmailId && currentEmailIndex != 0 && selectedCopyTemplateId == originalSelectedCopyTemplateId && JSON.stringify(originalFormData) == JSON.stringify(formData)}
          <button
            on:click={() => {
              isRegenerate = 1
              handleGenerate()
            }}
            class="btn btn-outline"
            disabled={isTyping ||
              selectedCopyTemplateId !== originalSelectedCopyTemplateId ||
              JSON.stringify(originalFormData) !== JSON.stringify(formData)}
          >
            Regenerate
          </button>
        {/if}
        {#if currentEmailIndex < currentEmailSequenceSteps && currentEmailIndex != 0 && !nextEmailId && selectedCopyTemplateId == originalSelectedCopyTemplateId && JSON.stringify(originalFormData) == JSON.stringify(formData)}
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
            disabled={isTyping ||
              selectedCopyTemplateId !== originalSelectedCopyTemplateId ||
              JSON.stringify(originalFormData) !== JSON.stringify(formData)}
          >
            Generate Next
          </button>
        {/if}

        <button
          on:click={() => {
            handleSubmit()
          }}
          class="btn btn-success"
          disabled={isTyping}
        >
          Generate New
        </button>

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
    </div>
  {/if}
  {#if !reply && !isLoading && !$showForm && !isLoadingSequences}
    <div class="main-head">
      <div
        class="search-box border-solid rounded border border-gray-300 flex items-center"
      >
        <button
          class="tooltip tooltip-right pr-2"
          data-tip="Show All Starred"
          on:click={() => showStarredSequences()}
        >
          <svg
            xmlns="http://www.w3.org/2000/svg"
            width="12"
            height="12"
            viewBox="0 0 24 24"
            fill={showStarred ? "currentColor" : "none"}
            stroke="currentColor"
            stroke-width="2"
            stroke-linecap="round"
            stroke-linejoin="round"
            class={showStarred
              ? "w-5 h-5 text-yellow-500 dark:text-yellow-400"
              : "w-5 h-5 text-gray-500 dark:text-gray-400"}
          >
            <polygon
              points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"
            />
          </svg>
        </button>
        <div class="relative">
          <button
            class="tooltip tooltip-right pr-2 pt-1"
            data-tip="Filter By Type"
            on:click={() => (showFilterTypeDropdown = !showFilterTypeDropdown)}
          >
            <svg
              xmlns="http://www.w3.org/2000/svg"
              width="12"
              height="12"
              viewBox="0 -3 24 24"
              fill="none"
              stroke="currentColor"
              stroke-width="2"
              stroke-linecap="round"
              stroke-linejoin="round"
              class={showFilteredTypes
                ? "w-5 h-5 text-yellow-500 dark:text-yellow-400"
                : "w-5 h-5 text-gray-500 dark:text-gray-400"}
            >
              <path d="M4 6h16M4 12h16M4 18h7" />
            </svg>
          </button>
          {#if showFilterTypeDropdown}
            <ul
              class="absolute text-xs left-0 mt-2 w-[300px] bg-white border border-gray-300 rounded shadow-lg z-10"
            >
              <li>
                <button
                  class="block w-full text-left px-4 py-2 text-xs text-gray-700 hover:bg-gray-100"
                  class:bg-gray-200={!filterCopyTypeId}
                  on:click={() => {
                    showFilterTypeDropdown = false
                    showFilteredTypes = false
                    filterCopyTypeId = null
                    fetchUpdatedEmailSequences()
                  }}
                >
                  All
                </button>
              </li>
              {#each $copyTypes as type}
                <li>
                  <button
                    class="block w-full text-left px-4 py-2 text-xs text-gray-700 hover:bg-gray-100"
                    class:bg-gray-200={filterCopyTypeId === type.id}
                    on:click={() => {
                      filterByCopyType(type.id)
                      showFilterTypeDropdown = false
                    }}
                  >
                    {type.name}
                  </button>
                </li>
              {/each}
            </ul>
          {/if}
        </div>
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
      </div>

      <div>
        <button class="btn btn-warning" on:click={openCopyTypeModal}
          >+ Create New</button
        >
      </div>
    </div>
    <div class="w-full mt-2">
      {#if searchTerm.length > 0 && searchTerm.length <= minChar}
        <p>{minCharText}</p>
      {:else if searchTerm.length > minChar}
        <p>
          There’s {resultsCount} copy collections matching “{searchTerm}”
        </p>
      {/if}
    </div>

    <div class="w-full mt-2">
      {#if $isSelectionMode}
        <button
          class="btn btn-outline btn-sm text-xs text-base"
          on:click={selectAll}>Select All</button
        >
        <button
          class="btn btn-outline btn-sm text-xs text-base"
          on:click={cancelSelection}>Cancel</button
        >
        <button
          class="btn btn-outline btn-sm text-xs text-base"
          on:click={() => {
            deletingSelectedSequences = true
            openSelectedDeleteModal()
          }}>Delete Selected</button
        >
      {/if}
    </div>

    <!-- <button class="plus-sign" on:click={toggleShowForm}>+ New</button> -->
    <!-- <button class="plus-sign" on:click={openCopyTypeModal}>+ New</button> -->
    <div class="main-list pt-3">
      {#if $emailSequences.length > 0}
        {#each $emailSequences as emailSequence (emailSequence.id)}
          <div
            class="email-box border-solid rounded border border-gray-300 {$isSelectionMode
              ? 'hover-mode selection-mode'
              : ''} flex items-start"
            on:mouseenter={() =>
              event.currentTarget.classList.add("hover-mode")}
            on:mouseleave={() =>
              event.currentTarget.classList.remove("hover-mode")}
          >
            <div class="flex flex-col h-full mr-2 mt-[5px]">
              <button
                class="p-0 mb-1"
                title="Favourite"
                on:click={() => {
                  emailSequence.favourite = !emailSequence.favourite
                  updateEmailSequenceFavourite(
                    emailSequence.id,
                    emailSequence.favourite,
                  )
                }}
              >
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  width="12"
                  height="12"
                  viewBox="0 0 24 24"
                  fill={emailSequence.favourite ? "currentColor" : "none"}
                  stroke="currentColor"
                  stroke-width="1"
                  stroke-linecap="round"
                  stroke-linejoin="round"
                  class={emailSequence.favourite
                    ? "w-4 h-4 text-yellow-500 dark:text-yellow-400"
                    : "w-4 h-4 text-gray-500 dark:text-gray-400"}
                >
                  <polygon
                    points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"
                  />
                </svg>
              </button>

              <input
                type="checkbox"
                class="select-checkbox mt-1 p-0"
                checked={$selectedSequences.has(emailSequence.id)}
                on:click={() => isSelectionMode.set(true)}
                on:change={() => {
                  toggleSelection(emailSequence.id)
                  if (!$selectedSequences.size) {
                    cancelSelection()
                  }
                }}
              />
            </div>
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
                selectedCopyTypeId = emailSequence.copy_type_id
                selectedCopyTemplate = emailSequence.copy_template
                selectedCopyTemplateId = emailSequence.copy_template_id
                // formFields.set(emailSequence.copy_form_data)

                // Set previousSequenceId and nextSequenceId
                const currentIndex = $emailSequences.findIndex(
                  (seq) => seq.id === emailSequence.id,
                )
                previousSequenceId =
                  currentIndex > 0 ? $emailSequences[currentIndex - 1].id : null
                console.log("PREVIOUS SEQUENCE ID", previousSequenceId)
                nextSequenceId =
                  currentIndex < $emailSequences.length - 1
                    ? $emailSequences[currentIndex + 1].id
                    : null
                console.log("NEXT SEQUENCE ID", nextSequenceId)

                handleLoad()
              }}
              >{emailSequence.name}
              <br />
              <p class="text-xs text-gray-500">
                <span title={`${formatDate(emailSequence.updated_at)}`}>
                  Last Updated {formatRelativeTime(emailSequence.updated_at)}
                </span>
              </p>
            </span>

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
                class="btn btn-outline text-lg mr-2 mb-1"
                on:click={() => openRenameModal(emailSequence)}>Rename</button
              >
              <button
                class="btn btn-outline text-lg mr-2 mb-1"
                on:click={() => {
                  deletingSequence = true
                  openDeleteModal(emailSequence)
                }}>Delete</button
              >
            </div>
          </div>
        {/each}
      {:else if !isSearching}
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
        disabled={!hasMoreRecords ||
          isLoadingNewSequences ||
          isSearching ||
          showStarred ||
          showFilteredTypes}
      >
        {#if !hasMoreRecords || isSearching || showStarred || showFilteredTypes}
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
        <input
          class="text-neutral w-full"
          bind:value={newName}
          id="newName"
          on:keydown={(e) => {
            if (e.key === "Enter") {
              saveName()
            }
          }}
        />
      </div>
      <ul>
        <li>
          <button
            class="btn btn-success btn-block"
            on:click={saveName}
            disabled={isSaving}
          >
            {#if isSaving}Saving...{:else}Save{/if}
          </button>
        </li>

        <li>
          <button
            class="btn btn-block"
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
        <input
          on:keydown={(e) => {
            if (e.key === "Enter") {
              saveName()
            }
          }}
          class="text-neutral w-full"
          bind:value={newName}
          id="newName"
        />
      </div>
      <ul>
        <li>
          <button
            class="btn btn-success btn-block"
            on:click={saveName}
            disabled={isSaving}
          >
            {#if isSaving}Saving...{:else}Rename{/if}
          </button>
        </li>

        <li>
          <button
            class="btn btn-block"
            on:click={closeStepModal}
            disabled={isSaving}
          >
            Cancel
          </button>
        </li>
        <li>
          <button
            class="btn btn-error btn-block"
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
            {#if isSaving && deleteConfirm}Deleting...{:else if deleteConfirm}Confirm
              Delete?{:else}Delete Collection{/if}
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
            class="btn btn-error btn-block"
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
            class="btn btn-block"
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
          <li
            class="flex items-center justify-between rounded bg-secondary outline outline-1 outline-neutral-content pt-2 pb-2"
          >
            <button
              class="flex-1 text-neutral"
              on:click={() => handleCopyTypeSelection(type)}
            >
              {type.name}
            </button>
          </li>
        {/each}
      </ul>
      <button class="btn btn-block" on:click={closeCopyTypeModal}>Cancel</button
      >
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

      <div
        class="text-neutral border-solid rounded border border-gray-300 max-w-full flex-1 p-1 mb-2"
      >
        <input
          type="text"
          placeholder="Search templates..."
          bind:value={searchTemplateTerm}
          class="w-full"
          on:input={() => {
            if (searchTemplateTerm.length === 0) {
              fetchCopyTemplates(selectedCopyTypeId)
              isTemplateSearching = false
            } else {
              fetchTemplateResults()
            }
          }}
        />

        {#if searchTemplateTerm.length > 0 && searchTemplateTerm.length <= minChar}
          <p>{minCharText}</p>
        {:else if searchTemplateTerm.length > minChar}
          <p>
            There’s {resultsTemplateCount} templates matching “{searchTemplateTerm}”
          </p>
        {/if}
      </div>

      <div class="text-neutral text-sm text-center mb-3">
        {#if isLoadingCopyTemplates}
          <span class="loading loading-spinner loading-sm text-primary"></span>
        {/if}

        {#if isTemplateSearching}
          <span class="loading loading-spinner loading-sm text-primary"></span>
        {/if}

        {#if !isLoadingCopyTemplates && !isTemplateSearching && $copyTemplates.length === 0}
          <p>No templates found</p>
        {/if}
      </div>

      <ul>
        {#each $copyTemplates as template (template.id)}
          <li
            class="flex items-center justify-between rounded bg-secondary outline outline-1 outline-neutral-content pt-2 pb-2"
          >
            <button
              class="pl-3"
              title="Favourite"
              on:click={() => {
                template.isFavourite = !template.isFavourite
                updateTemplateFavouriteStatus(template.id, template.isFavourite)
              }}
            >
              <svg
                class="w-5 h-5 text-yellow-500 dark:text-yellow-400"
                aria-hidden="true"
                xmlns="http://www.w3.org/2000/svg"
                width="24"
                height="24"
                viewBox="0 0 24 24"
                fill={template.isFavourite ? "currentColor" : "none"}
                stroke="currentColor"
                stroke-width="2"
                stroke-linecap="round"
                stroke-linejoin="round"
              >
                <polygon
                  points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"
                />
              </svg>
            </button>

            <button
              class="flex-1 text-neutral"
              on:click={() => handleCopyTemplateSelection(template)}
            >
              {template.name}
            </button>
            <button
              class="tooltip pr-4"
              data-tip="More info"
              on:click={() => (template.showInfo = !template.showInfo)}
            >
              <svg
                class="w-5 h-5 text-gray-800 dark:text-white"
                aria-hidden="true"
                xmlns="http://www.w3.org/2000/svg"
                width="24"
                height="24"
                fill="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  fill-rule="evenodd"
                  d="M2 12C2 6.477 6.477 2 12 2s10 4.477 10 10-4.477 10-10 10S2 17.523 2 12Zm9.408-5.5a1 1 0 1 0 0 2h.01a1 1 0 1 0 0-2h-.01ZM10 10a1 1 0 1 0 0 2h1v3h-1a1 1 0 1 0 0 2h4a1 1 0 1 0 0-2h-1v-4a1 1 0 0 0-1-1h-2Z"
                  clip-rule="evenodd"
                />
              </svg>
            </button>
            <div class="tooltip fixed ml-2" data-tip="More info"></div>
            {#if template.showInfo}
              <div
                class="absolute z-10 p-4 bg-white border rounded shadow-lg text-neutral text-sm w-[560px] max-w-[68vw] max-h-[500px] overflow-y-auto scrollbar-thin"
              >
                {template.info}
                <button
                  class="absolute top-0 right-0 mt-1 mr-1 flex items-center justify-center w-5 h-5 rounded-full bg-neutral text-white"
                  on:click={() => (template.showInfo = false)}
                >
                  X
                </button>
              </div>
            {/if}
          </li>
        {/each}
      </ul>
      <div class="flex w-full justify-between space-x-2">
        <button class="btn flex-1" on:click={closeCopyTemplateModal}>
          Cancel
        </button>
        <button
          class="btn flex-1"
          on:click={() => {
            isCopyTemplateModalOpen = false
            isCopyTypeModalOpen = true
            searchTemplateTerm = ""
          }}
        >
          Back
        </button>
      </div>
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
        {#if exhaustedCredits}You Are Out Of Credits{:else}Premium Feature{/if}
      </p>
      <p class="text-center mb-4 text-neutral">
        {#if exhaustedCredits}
          Please upgrade to get more credits.
        {:else}
          This feature is available only for paid plans. Please upgrade to
          access this feature.
        {/if}
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

{#if isSaveResponseModalOpen}
  <div
    class="modal-backdrop"
    role="dialog"
    aria-modal="true"
    on:click={closeSaveResponseModal}
  >
    <div class="copy-type-modal" role="document" on:click|stopPropagation>
      {#if !responseName}
        <p class="mt-2 mb-4 text-center text-lg text-neutral">
          Please enter a product name and target audience
        </p>
        <ul>
          <li>
            <button class="btn btn-block" on:click={closeSaveResponseModal}>
              Back
            </button>
          </li>
        </ul>
      {:else}
        <p class="mt-2 mb-4 text-center text-xl font-semibold text-neutral">
          Save Your Product
        </p>
        <div class="border-2 rounded-md p-2">
          <input
            class="text-neutral w-full"
            bind:value={responseName}
            id="responseName"
            placeholder="Enter name for saved response"
            on:keydown={(e) => {
              if (e.key === "Enter" && responseName) {
                saveResponse()
              }
            }}
          />
        </div>
        <ul>
          <li>
            <button
              class="btn btn-success btn-block"
              on:click={saveResponse}
              disabled={isSaving || !responseName}
            >
              {#if isSaving}Saving...{:else}Save{/if}
            </button>
          </li>

          <li>
            <button
              class="btn btn-block"
              on:click={closeSaveResponseModal}
              disabled={isSaving}
            >
              Cancel
            </button>
          </li>
        </ul>
      {/if}
    </div>
  </div>
{/if}
{#if isLoadResponsesModalOpen}
  <div
    class="modal-backdrop"
    role="dialog"
    aria-modal="true"
    on:click={closeLoadResponsesModal}
  >
    <div class="copy-type-modal" role="document" on:click|stopPropagation>
      <p class="mt-2 mb-4 text-center text-xl font-semibold text-neutral">
        Load Your Saved Product
      </p>
      <ul>
        {#each $savedResponses as response}
          <li
            class="flex items-center justify-between rounded outline outline-1 outline-neutral-content pt-2 pb-2"
          >
            <button
              class="flex-1 text-neutral"
              on:click={() => loadResponse(response)}
            >
              {response.name}
            </button>

            <button class="pr-2" on:click={() => deleteResponse(response)}>
              <svg
                class="w-4 h-4 text-gray-800 dark:text-white"
                aria-hidden="true"
                xmlns="http://www.w3.org/2000/svg"
                width="20"
                height="20"
                fill="none"
                viewBox="0 0 24 24"
              >
                <path
                  stroke="currentColor"
                  stroke-linecap="round"
                  stroke-linejoin="round"
                  stroke-width="2"
                  d="M5 7h14m-9 3v8m4-8v8M10 3h4a1 1 0 0 1 1 1v3H9V4a1 1 0 0 1 1-1ZM6 7h12v13a1 1 0 0 1-1 1H7a1 1 0 0 1-1-1V7Z"
                />
              </svg>
            </button>
          </li>
        {/each}
      </ul>
      <button
        class="btn btn-primary btn-block btn-sm mb-2"
        on:click={loadMoreResponses}
        disabled={!hasMoreResponses ||
          isLoadingNewResponses ||
          isSearchingResponses}
      >
        {#if !hasMoreResponses || isSearchingResponses}
          No More Records
        {:else}
          {isLoadingNewResponses ? "Loading..." : "Show More"}
        {/if}
      </button>

      <button
        class="btn btn-block btn-sm"
        on:click={closeLoadResponsesModal}
        disabled={isSaving}
      >
        Close
      </button>
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
    max-width: 80vw;
    width: 600px;
    /* width: 50vw; */
    /* min-width: 300px;*/
    max-height: 500px;
    overflow-y: auto;
    scrollbar-width: thin;
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
  }

  .email-box:hover .actions {
    display: flex;
  }

  .actions {
    display: none;
    position: absolute;
    right: -30px;
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
      max-width: 71%;
    }
    .email-box {
      max-width: 100%;
      min-height: 65px; /* Ensure consistent min-height */
    }
  }

  .bulk-actions {
    scale: 0.7;
    margin-left: 0;
    position: fixed;
  }

  .select-checkbox {
    display: none;
  }

  @media (max-width: 768px) {
    .select-checkbox {
      display: inline-block;
      /* margin-right: 20px; */
      margin-top: 2px;
    }
  }

  .hover-mode .select-checkbox {
    display: inline-block;
    /* margin-right: 20px; */
    margin-top: 2px;
  }

  .selection-mode .select-checkbox {
    display: inline-block;
    /* margin-right: 20px; */
    margin-top: 2px;
  }
  .main-list {
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
