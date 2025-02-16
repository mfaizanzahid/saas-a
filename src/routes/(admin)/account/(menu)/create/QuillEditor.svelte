<script>
  import { onMount } from "svelte"
  import { createEventDispatcher } from "svelte"

  export let value = ""
  export let readOnly = false
  export let quill = null

  const dispatch = createEventDispatcher()
  let editor
  let quillElement

  onMount(async () => {
    const Quill = (await import("quill")).default
    await import("quill/dist/quill.snow.css")

    editor = new Quill(quillElement, {
      theme: "snow",
      placeholder: "",
      readOnly: readOnly,
      modules: {
        toolbar: readOnly
          ? false
          : [
              [{ header: [1, 2, false] }],
              ["bold", "italic", "underline", "strike"],
              [{ list: "ordered" }, { list: "bullet" }],
              ["link"],
              ["clean"],
            ],
      },
    })

    // Initialize editor content with external value.
    editor.root.innerHTML = value
    quill = editor // Expose the editor instance

    // Only dispatch if the change comes from user action.
    editor.on("text-change", (_, __, source) => {
      if (source === "user") {
        dispatch("input", editor.root.innerHTML)
      }
    })
  })

  // If the external "value" prop changes and doesn't match the editor content, update it.
  $: if (editor && value !== editor.root.innerHTML) {
    editor.root.innerHTML = value
  }

  // Sync the readOnly state.
  $: if (editor && editor.options.readOnly !== readOnly) {
    editor.enable(!readOnly)
  }
</script>

<div bind:this={quillElement} class="editor"></div>

<style>
  .editor {
    height: 68vh; /* Match the height from your previous container */
    border: 1px solid #ccc;
    margin-top: 1rem;
    background-color: white;
  }

  :global(.ql-editor) {
    font-size: 0.9rem;
    line-height: 1.5;
    padding: 1rem;
    overflow-y: auto;
  }

  :global(.ql-toolbar) {
    border-bottom: 1px solid #ccc;
    background-color: #f8f9fa;
  }

  :global(.ql-container) {
    height: calc(68vh - 55px) !important; /* Adjust for toolbar height */
  }
</style>
