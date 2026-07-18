/** Creates the shared incoming set-copy controller for a page. */
window.createSetSharingController = function createSetSharingController(dependencies) {
  const {
    elements,
    state,
    apiFetch,
    setStatus,
    showToast,
    refreshAfterResponse,
    onBackgroundError = setStatus,
    skipIfDialogOpen = false,
  } = dependencies;

  /** Configures the recipient's available choices for copied set conflicts. */
  function configureIncomingShareChoices(share) {
    const codeConflict = Boolean(share.conflicts?.code);
    const nameConflict = Boolean(share.conflicts?.name);
    const setCode = share.setCode || "DEFAULT";
    const setName = share.setName || "Untitled Set";

    elements.incomingShareDialog.dataset.requestedSetName = setName;
    elements.incomingShareDialog.dataset.codeConflict = String(codeConflict);
    elements.incomingShareDialog.dataset.nameConflict = String(nameConflict);
    elements.incomingShareCodeChoice.classList.toggle("hidden", !codeConflict);
    elements.incomingShareNameChoice.classList.toggle("hidden", !nameConflict);
    elements.incomingShareCodeChoiceText.textContent = `A set with code ${setCode} already exists.`;
    elements.incomingShareNameChoiceText.textContent = `A set named ${setName} already exists.`;
    elements.incomingShareCodeResolution.value = "";
    elements.incomingShareNameResolution.value = "";
    syncIncomingShareNameChoice();
  }

  /** Updates name controls when the recipient chooses to overwrite a duplicate code. */
  function syncIncomingShareNameChoice() {
    const codeOverwrite = elements.incomingShareCodeResolution.value === "overwrite";
    const nameConflict = elements.incomingShareDialog.dataset.nameConflict === "true";
    const nameLabel = elements.incomingShareNameChoice.querySelector("label");

    if (!nameConflict) return;
    nameLabel.classList.toggle("hidden", codeOverwrite);
    elements.incomingShareNameChoiceText.textContent = codeOverwrite
      ? "The set name will be overwritten"
      : `A set named ${elements.incomingShareDialog.dataset.requestedSetName || "Untitled Set"} already exists.`;
    if (codeOverwrite) elements.incomingShareNameResolution.value = "keep";
    else elements.incomingShareNameResolution.value = "";
  }

  /** Returns the selected resolution choices for the incoming copied set. */
  function getIncomingShareChoices() {
    const choices = {};
    if (elements.incomingShareDialog.dataset.codeConflict === "true") {
      choices.codeResolution = elements.incomingShareCodeResolution.value;
    }
    if (
      elements.incomingShareDialog.dataset.nameConflict === "true" &&
      elements.incomingShareCodeResolution.value !== "overwrite"
    ) {
      choices.nameResolution = elements.incomingShareNameResolution.value;
    }
    return choices;
  }

  /** Opens a modal for one incoming shared set copy. */
  function openIncomingShareDialog(share) {
    elements.incomingShareDialog.dataset.shareId = share.shareId || "";
    elements.incomingShareTitle.textContent = `Would you like to accept a copy of set ${share.setName || "Untitled Set"} from user ${share.senderEmail || "another user"}?`;
    elements.incomingShareMessage.textContent = "";
    configureIncomingShareChoices(share);
    if (!elements.incomingShareDialog.open) elements.incomingShareDialog.showModal();
  }

  /** Shows unviewed set-share decisions from recipients as informational toasts. */
  async function checkSetShareResponses() {
    if (!state.idToken) return;

    try {
      const data = await apiFetch("/set-share-responses");
      for (const response of data.responses || []) {
        const recipientEmail = response.recipientEmail || "The recipient";
        const setLabel = `${response.setCode || "DEFAULT"} - ${response.setName || "Untitled Set"}`;
        if (response.response === "expired") {
          showToast(`The set you sent to ${recipientEmail} expired (${setLabel}).`, "info");
          continue;
        }
        const decision = response.response === "accepted" ? "accepted" : "rejected";
        showToast(`${recipientEmail} has ${decision} the set you sent them (${setLabel})!`, "info");
      }
    } catch (error) {
      onBackgroundError(error.message);
    }
  }

  /** Checks whether another user has sent this account a set copy. */
  async function checkIncomingSetShares() {
    if (!state.idToken || (skipIfDialogOpen && elements.incomingShareDialog.open)) return;
    try {
      const data = await apiFetch("/set-shares");
      for (const expiredShare of data.expiredShares || []) {
        const senderEmail = expiredShare.senderEmail || "Another user";
        const setLabel = `${expiredShare.setCode || "DEFAULT"} - ${expiredShare.setName || "Untitled Set"}`;
        showToast(`The set copy sent by ${senderEmail} expired (${setLabel}).`, "info");
      }
      const share = (data.shares || [])[0];
      if (share) openIncomingShareDialog(share);
    } catch (error) {
      onBackgroundError(error.message);
    }
  }

  /** Accepts or rejects the incoming set copy currently shown in the modal. */
  async function respondToIncomingShare(accept) {
    const shareId = elements.incomingShareDialog.dataset.shareId;
    if (!shareId) return;

    try {
      elements.acceptIncomingShareButton.disabled = true;
      elements.rejectIncomingShareButton.disabled = true;
      if (accept) {
        await apiFetch(`/set-shares/${encodeURIComponent(shareId)}/accept`, {
          method: "POST",
          body: JSON.stringify(getIncomingShareChoices()),
        });
      } else {
        await apiFetch(`/set-shares/${encodeURIComponent(shareId)}`, { method: "DELETE" });
      }
      elements.incomingShareDialog.close();
      await refreshAfterResponse();
      setStatus(accept ? "Shared set accepted" : "Shared set declined");
      await checkSetShareResponses();
      await checkIncomingSetShares();
    } catch (error) {
      if (error.message === "This set copy request has expired.") {
        elements.incomingShareDialog.close();
        setStatus("That set copy request has expired.");
        await checkIncomingSetShares();
        return;
      }
      elements.incomingShareMessage.textContent = error.message;
    } finally {
      elements.acceptIncomingShareButton.disabled = false;
      elements.rejectIncomingShareButton.disabled = false;
    }
  }

  /** Registers event handlers for the incoming set-copy modal. */
  function attachEvents() {
    elements.acceptIncomingShareButton.addEventListener("click", () => respondToIncomingShare(true));
    elements.rejectIncomingShareButton.addEventListener("click", () => respondToIncomingShare(false));
    elements.incomingShareCodeResolution.addEventListener("change", syncIncomingShareNameChoice);
    elements.incomingShareForm.addEventListener("submit", (event) => event.preventDefault());
  }

  return {
    attachEvents,
    checkIncomingSetShares,
    checkSetShareResponses,
  };
};
