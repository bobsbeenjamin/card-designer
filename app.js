const backendConfig = window.backendConfig;

const imageProviderStorageKey = "cardDesignerImageProvider";
const imageProviderLabels = {
  openai: "OpenAI",
  gemini: "Google Gemini",
  aws: "AWS Bedrock",
  midjourney: "Midjourney-compatible",
  claude: "Claude-compatible",
  morphic: "Morphic-compatible",
  leonardo: "Leonardo.ai-compatible",
  fal: "Fal.ai-compatible",
  ace: "ace.ai-compatible",
  runware: "Runware-compatible",
  firefly: "Adobe Firefly-compatible",
  stability: "Stability AI",
};
const endpointConfigProviders = new Set([
  "midjourney",
  "claude",
  "morphic",
  "leonardo",
  "fal",
  "ace",
  "runware",
  "firefly",
  "stability",
]);
const keylessImageProviders = new Set(["aws"]);
const modelConfigProviders = new Set([
  "gemini",
  "aws",
  "midjourney",
  "claude",
  "morphic",
  "leonardo",
  "fal",
  "ace",
  "runware",
  "firefly",
  "stability",
]);

const state = {
  ...AccountAuthController.readStoredSession(),
  imageGenerationSettings: null,
  currentUserTooltip: null,
  currentUserTooltipHideTimer: 0,
  currentUserTooltipPressTimer: 0,
};

const elements = {
  signInPanel: document.querySelector("#signInPanel"),
  homeFeatureMessage: document.querySelector("#homeFeatureMessage"),
  signedInPanel: document.querySelector("#signedInPanel"),
  usernameInput: document.querySelector("#usernameInput"),
  passwordInput: document.querySelector("#passwordInput"),
  cancelSignInButton: document.querySelector("#cancelSignInButton"),
  openSignUpButton: document.querySelector("#openSignUpButton"),
  signUpDialog: document.querySelector("#signUpDialog"),
  signUpForm: document.querySelector("#signUpForm"),
  signUpEmailInput: document.querySelector("#signUpEmailInput"),
  signUpUsernameInput: document.querySelector("#signUpUsernameInput"),
  signUpPasswordInput: document.querySelector("#signUpPasswordInput"),
  usernameAvailabilityStatus: document.querySelector("#usernameAvailabilityStatus"),
  confirmationFields: document.querySelector("#confirmationFields"),
  confirmationInput: document.querySelector("#confirmationInput"),
  signUpButton: document.querySelector("#signUpButton"),
  cancelSignUpButton: document.querySelector("#cancelSignUpButton"),
  signUpStatus: document.querySelector("#signUpStatus"),
  signInButton: document.querySelector("#signInButton"),
  confirmButton: document.querySelector("#confirmButton"),
  authStatus: document.querySelector("#authStatus"),
  currentUserLabel: document.querySelector("#currentUserLabel"),
  accountMenuButton: document.querySelector("#accountMenuButton"),
  accountMenu: document.querySelector("#accountMenu"),
  signOutButton: document.querySelector("#signOutButton"),
  chooseImageProviderButton: document.querySelector("#chooseImageProviderButton"),
  imageProviderDialog: document.querySelector("#imageProviderDialog"),
  imageProviderForm: document.querySelector("#imageProviderForm"),
  closeImageProviderButton: document.querySelector("#closeImageProviderButton"),
  closeImageProviderXButton: document.querySelector("#closeImageProviderXButton"),
  imageProviderInput: document.querySelector("#imageProviderInput"),
  providerApiKeyLabel: document.querySelector("#providerApiKeyLabel"),
  providerApiKeyInput: document.querySelector("#providerApiKeyInput"),
  providerEndpointLabel: document.querySelector("#providerEndpointLabel"),
  providerEndpointInput: document.querySelector("#providerEndpointInput"),
  providerModelLabel: document.querySelector("#providerModelLabel"),
  providerModelInput: document.querySelector("#providerModelInput"),
  imageGenerationStatus: document.querySelector("#imageGenerationStatus"),
  saveImageGenerationSettingsButton: document.querySelector("#saveImageGenerationSettingsButton"),
  myFriendsButton: document.querySelector("#myFriendsButton"),
  toastRegion: document.querySelector("#toastRegion"),
  incomingShareDialog: document.querySelector("#incomingShareDialog"),
  incomingShareForm: document.querySelector("#incomingShareForm"),
  incomingShareTitle: document.querySelector("#incomingShareTitle"),
  incomingShareMessage: document.querySelector("#incomingShareMessage"),
  incomingShareCodeChoice: document.querySelector("#incomingShareCodeChoice"),
  incomingShareCodeChoiceText: document.querySelector("#incomingShareCodeChoiceText"),
  incomingShareCodeResolution: document.querySelector("#incomingShareCodeResolution"),
  incomingShareNameChoice: document.querySelector("#incomingShareNameChoice"),
  incomingShareNameChoiceText: document.querySelector("#incomingShareNameChoiceText"),
  incomingShareNameResolution: document.querySelector("#incomingShareNameResolution"),
  acceptIncomingShareButton: document.querySelector("#acceptIncomingShareButton"),
  rejectIncomingShareButton: document.querySelector("#rejectIncomingShareButton"),
};

/** Returns the remembered image provider when it remains supported. */
function getStoredImageProvider() {
  try {
    const provider = localStorage.getItem(imageProviderStorageKey) || "";
    return imageProviderLabels[provider] ? provider : "";
  } catch (error) {
    return "";
  }
}

/** Remembers the selected image provider across page loads. */
function rememberImageProvider(provider) {
  const normalizedProvider = imageProviderLabels[provider] ? provider : "openai";
  try {
    localStorage.setItem(imageProviderStorageKey, normalizedProvider);
  } catch (error) {
    // Storage may be unavailable in private or locked-down browser modes.
  }
  return normalizedProvider;
}

/** Displays account feedback on the signed-out panel. */
function setAuthStatus(message) {
  elements.authStatus.textContent = message;
}

/** Returns the full signed-in account label used in the menu and tooltip. */
function getCurrentUserMessage() {
  const email = state.email || accountAuth.getJwtPayload(state.idToken).email || "";
  return email ? `You are logged in as ${email}` : "";
}

/** Removes the touch tooltip and clears its pending timers. */
function hideCurrentUserTooltip() {
  window.clearTimeout(state.currentUserTooltipPressTimer);
  window.clearTimeout(state.currentUserTooltipHideTimer);
  state.currentUserTooltipPressTimer = 0;
  state.currentUserTooltipHideTimer = 0;
  state.currentUserTooltip?.remove();
  state.currentUserTooltip = null;
}

/** Shows the account label tooltip near the truncated menu text. */
function showCurrentUserTooltip() {
  const message = elements.currentUserLabel.title || elements.currentUserLabel.textContent;
  if (!message) return;
  hideCurrentUserTooltip();

  const tooltip = document.createElement("div");
  const labelRect = elements.currentUserLabel.getBoundingClientRect();
  tooltip.className = "home-account-touch-tooltip";
  tooltip.textContent = message;
  document.body.append(tooltip);
  const tooltipRect = tooltip.getBoundingClientRect();
  const left = Math.min(window.innerWidth - tooltipRect.width - 12, Math.max(12, labelRect.left));
  tooltip.style.left = `${left}px`;
  tooltip.style.top = `${Math.min(window.innerHeight - tooltipRect.height - 12, labelRect.bottom + 8)}px`;
  state.currentUserTooltip = tooltip;
  state.currentUserTooltipHideTimer = window.setTimeout(hideCurrentUserTooltip, 3500);
}

/** Starts the mobile long-press timer for the account label tooltip. */
function startCurrentUserTooltipPress(event) {
  if (event.pointerType !== "touch") return;
  window.clearTimeout(state.currentUserTooltipPressTimer);
  state.currentUserTooltipPressTimer = window.setTimeout(showCurrentUserTooltip, 550);
}

/** Cancels a pending long press while leaving an already shown tooltip visible. */
function cancelCurrentUserTooltipPress() {
  window.clearTimeout(state.currentUserTooltipPressTimer);
  state.currentUserTooltipPressTimer = 0;
}

/** Shows a dismissible notification for ten seconds. */
function showToast(message, variant = "error") {
  const toast = document.createElement("div");
  const closeButton = document.createElement("button");
  const messageText = document.createElement("p");
  let timeoutId = 0;

  toast.className = variant === "info" ? "toast-message toast-info" : "toast-message";
  messageText.textContent = message;
  closeButton.className = "toast-close";
  closeButton.type = "button";
  closeButton.setAttribute("aria-label", "Close notification");
  closeButton.textContent = "x";

  const closeToast = () => {
    window.clearTimeout(timeoutId);
    toast.remove();
  };

  closeButton.addEventListener("click", closeToast);
  toast.append(messageText, closeButton);
  elements.toastRegion.append(toast);
  timeoutId = window.setTimeout(closeToast, 10000);
}

/** Closes the account menu and updates its accessibility state. */
function closeAccountMenu() {
  elements.accountMenu.classList.add("hidden");
  elements.accountMenuButton.setAttribute("aria-expanded", "false");
}

/** Shows the correct home-page account controls for the current session. */
function renderAccountUi() {
  const signedIn = accountAuth.isSignedIn();
  elements.signInPanel.classList.toggle("hidden", signedIn);
  elements.signedInPanel.classList.toggle("hidden", !signedIn);
  elements.homeFeatureMessage.classList.toggle("hidden", signedIn);
  document.querySelector(".home-destinations").classList.toggle("hidden", !signedIn);
  elements.myFriendsButton.classList.toggle("hidden", !signedIn);
  const currentUserMessage = getCurrentUserMessage();
  elements.currentUserLabel.textContent = currentUserMessage;
  elements.currentUserLabel.title = currentUserMessage;
  if (!signedIn) closeAccountMenu();
}

const accountAuth = new AccountAuthController({
  backendConfig,
  state,
  elements,
  renderAuthUi: renderAccountUi,
  setAuthStatus,
  onSessionCleared: () => {
    state.imageGenerationSettings = null;
  },
  onSignedIn: async () => {
    await setSharing.checkSetShareResponses();
    await setSharing.checkIncomingSetShares();
  },
});

const apiFetch = accountAuth.apiClient.request.bind(accountAuth.apiClient);
const setSharing = createSetSharingController({
  elements,
  state,
  apiFetch,
  setStatus: setAuthStatus,
  showToast,
  onBackgroundError: setAuthStatus,
  refreshAfterResponse: async () => {},
});

/** Opens or closes the signed-in account menu. */
function toggleAccountMenu() {
  const isOpen = !elements.accountMenu.classList.contains("hidden");
  elements.accountMenu.classList.toggle("hidden", isOpen);
  elements.accountMenuButton.setAttribute("aria-expanded", String(!isOpen));
}

/** Returns provider status for the selected image service. */
function getSelectedProviderStatus() {
  const provider = elements.imageProviderInput.value || "openai";
  return state.imageGenerationSettings?.providers?.[provider] || {
    label: imageProviderLabels[provider] || provider,
    configured: false,
    apiKeyConfigured: false,
    endpointUrl: "",
    defaultEndpointUrl: "",
    modelId: "",
  };
}

/** Updates credential fields for the selected image provider. */
function syncImageProviderSettingsUi() {
  const provider = elements.imageProviderInput.value || "openai";
  const status = getSelectedProviderStatus();
  const label = status.label || imageProviderLabels[provider] || provider;
  const showApiKey = !keylessImageProviders.has(provider);
  const showEndpoint = endpointConfigProviders.has(provider);
  const showModel = modelConfigProviders.has(provider);
  elements.providerApiKeyLabel.classList.toggle("hidden", !showApiKey);
  elements.providerEndpointLabel.classList.toggle("hidden", !showEndpoint);
  elements.providerModelLabel.classList.toggle("hidden", !showModel);
  elements.providerApiKeyLabel.querySelector("span").textContent = `${label} API key`;
  elements.providerEndpointLabel.querySelector("span").textContent = `${label} endpoint URL`;
  elements.providerModelLabel.querySelector("span").textContent = `${label} model or deployment`;
  elements.providerApiKeyInput.placeholder = status.apiKeyConfigured ? "Saved; enter a new key to replace it" : `Stored for ${label} generation`;
  elements.providerEndpointInput.placeholder = status.defaultEndpointUrl || "Provider-compatible API endpoint";
  elements.providerEndpointInput.value = status.endpointUrl || "";
  elements.providerModelInput.value = status.modelId || "";
}

/** Refreshes the home-page image provider settings from the backend. */
async function refreshImageGenerationSettings() {
  const data = await apiFetch("/settings/image-generation");
  const provider = getStoredImageProvider() || data.provider || "openai";
  state.imageGenerationSettings = data;
  elements.imageProviderInput.value = provider;
  syncImageProviderSettingsUi();
  elements.imageGenerationStatus.textContent = "Choose a provider and replace any settings that need to change.";
}

/** Opens the image-provider dialog for the signed-in account. */
async function openImageProviderDialog() {
  closeAccountMenu();
  elements.imageGenerationStatus.textContent = "Loading image provider settings...";
  elements.imageProviderDialog.showModal();
  try {
    await refreshImageGenerationSettings();
  } catch (error) {
    elements.imageGenerationStatus.textContent = error.message;
  }
}

/** Closes and clears sensitive image-provider form fields. */
function closeImageProviderDialog() {
  elements.imageProviderDialog.close();
  elements.providerApiKeyInput.value = "";
  elements.imageGenerationStatus.textContent = "";
}

/** Saves the selected image-provider credentials and closes the dialog. */
async function saveImageGenerationSettings() {
  elements.saveImageGenerationSettingsButton.disabled = true;
  try {
    const data = await apiFetch("/settings/image-generation", {
      method: "PUT",
      body: JSON.stringify({
        provider: elements.imageProviderInput.value,
        providerApiKey: elements.providerApiKeyInput.value.trim(),
        providerEndpointUrl: elements.providerEndpointInput.value.trim(),
        providerModelId: elements.providerModelInput.value.trim(),
      }),
    });
    state.imageGenerationSettings = data;
    rememberImageProvider(data.provider || elements.imageProviderInput.value || "openai");
    closeImageProviderDialog();
    showToast(`${imageProviderLabels[data.provider] || "Image provider"} settings saved.`, "info");
  } catch (error) {
    elements.imageGenerationStatus.textContent = error.message;
  } finally {
    elements.saveImageGenerationSettingsButton.disabled = false;
  }
}

/** Registers the home-page event handlers. */
function attachEvents() {
  accountAuth.attachEvents();
  elements.accountMenuButton.addEventListener("click", toggleAccountMenu);
  elements.currentUserLabel.addEventListener("pointerdown", startCurrentUserTooltipPress);
  elements.currentUserLabel.addEventListener("pointerup", cancelCurrentUserTooltipPress);
  elements.currentUserLabel.addEventListener("pointercancel", cancelCurrentUserTooltipPress);
  elements.currentUserLabel.addEventListener("pointerleave", cancelCurrentUserTooltipPress);
  elements.currentUserLabel.addEventListener("contextmenu", (event) => event.preventDefault());
  elements.signOutButton.addEventListener("click", () => accountAuth.signOut(""));
  elements.chooseImageProviderButton.addEventListener("click", openImageProviderDialog);
  elements.imageProviderInput.addEventListener("change", () => {
    rememberImageProvider(elements.imageProviderInput.value);
    syncImageProviderSettingsUi();
  });
  elements.imageProviderForm.addEventListener("submit", (event) => {
    event.preventDefault();
    saveImageGenerationSettings();
  });
  elements.closeImageProviderButton.addEventListener("click", closeImageProviderDialog);
  elements.closeImageProviderXButton.addEventListener("click", closeImageProviderDialog);
  setSharing.attachEvents();
  document.addEventListener("click", (event) => {
    if (!elements.signedInPanel.contains(event.target)) closeAccountMenu();
  });
}

/** Restores the browser session and starts the home screen. */
async function initialize() {
  attachEvents();
  if (!(await accountAuth.restoreSession())) return;
  setAuthStatus(state.email ? `Signed in as ${state.email}` : "Signed in from this tab session");
  try {
    await setSharing.checkSetShareResponses();
    await setSharing.checkIncomingSetShares();
  } catch (error) {
    setAuthStatus(error.message);
  }
}

initialize();
