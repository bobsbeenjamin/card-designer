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
  idToken: sessionStorage.getItem("cardDesignerIdToken") || "",
  refreshToken: sessionStorage.getItem("cardDesignerRefreshToken") || "",
  email: sessionStorage.getItem("cardDesignerEmail") || "",
  imageGenerationSettings: null,
  currentUserTooltip: null,
  currentUserTooltipHideTimer: 0,
  currentUserTooltipPressTimer: 0,
};

const elements = {
  signInPanel: document.querySelector("#signInPanel"),
  homeFeatureMessage: document.querySelector("#homeFeatureMessage"),
  signedInPanel: document.querySelector("#signedInPanel"),
  emailInput: document.querySelector("#emailInput"),
  passwordInput: document.querySelector("#passwordInput"),
  confirmationInput: document.querySelector("#confirmationInput"),
  signUpButton: document.querySelector("#signUpButton"),
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
  const email = state.email || getJwtPayload(state.idToken)?.email || "";
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

/** Calls Cognito for browser-based account actions. */
async function cognitoRequest(target, payload) {
  const response = await fetch(`https://cognito-idp.${backendConfig.region}.amazonaws.com/`, {
    method: "POST",
    headers: {
      "content-type": "application/x-amz-json-1.1",
      "x-amz-target": `AWSCognitoIdentityProviderService.${target}`,
    },
    body: JSON.stringify(payload),
  });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(data.message || data.__type || "Cognito request failed.");
  return data;
}

/** Returns the entered email and password after validating both fields. */
function getCredentials() {
  const email = elements.emailInput.value.trim();
  const password = elements.passwordInput.value;
  if (!email || !password) throw new Error("Enter an email and password first.");
  return { email, password };
}

/** Starts Cognito sign-up with the entered account details. */
async function signUp() {
  try {
    const { email, password } = getCredentials();
    await cognitoRequest("SignUp", {
      ClientId: backendConfig.userPoolClientId,
      Username: email,
      Password: password,
      UserAttributes: [{ Name: "email", Value: email }],
    });
    setAuthStatus("Check your email for a confirmation code.");
  } catch (error) {
    setAuthStatus(error.message);
  }
}

/** Confirms a pending Cognito account with the emailed code. */
async function confirmAccount() {
  try {
    const email = elements.emailInput.value.trim();
    const code = elements.confirmationInput.value.trim();
    if (!email || !code) throw new Error("Enter email and confirmation code.");
    await cognitoRequest("ConfirmSignUp", {
      ClientId: backendConfig.userPoolClientId,
      Username: email,
      ConfirmationCode: code,
    });
    setAuthStatus("Account confirmed. You can sign in now.");
  } catch (error) {
    setAuthStatus(error.message);
  }
}

/** Decodes a JWT payload without validating its signature. */
function getJwtPayload(token) {
  if (!token) return null;
  try {
    const encodedPayload = token.split(".")[1].replace(/-/g, "+").replace(/_/g, "/");
    const paddedPayload = encodedPayload.padEnd(Math.ceil(encodedPayload.length / 4) * 4, "=");
    return JSON.parse(atob(paddedPayload));
  } catch (error) {
    return null;
  }
}

/** Checks whether a JWT is absent, malformed, or expired. */
function isJwtExpired(token) {
  const payload = getJwtPayload(token);
  return !payload?.exp || payload.exp * 1000 <= Date.now();
}

/** Refreshes the short-lived ID token through Cognito. */
async function refreshAuthSession() {
  if (!state.refreshToken) return false;
  try {
    const data = await cognitoRequest("InitiateAuth", {
      ClientId: backendConfig.userPoolClientId,
      AuthFlow: "REFRESH_TOKEN_AUTH",
      AuthParameters: { REFRESH_TOKEN: state.refreshToken },
    });
    state.idToken = data.AuthenticationResult.IdToken;
    state.refreshToken = data.AuthenticationResult.RefreshToken || state.refreshToken;
    sessionStorage.setItem("cardDesignerIdToken", state.idToken);
    sessionStorage.setItem("cardDesignerRefreshToken", state.refreshToken);
    return true;
  } catch (error) {
    return false;
  }
}

/** Closes the account menu and updates its accessibility state. */
function closeAccountMenu() {
  elements.accountMenu.classList.add("hidden");
  elements.accountMenuButton.setAttribute("aria-expanded", "false");
}

/** Shows the correct home-page account controls for the current session. */
function renderAccountUi() {
  const signedIn = Boolean(state.idToken) && !isJwtExpired(state.idToken);
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

/** Clears locally stored authentication and account state. */
function clearAuthSession() {
  state.idToken = "";
  state.refreshToken = "";
  state.email = "";
  state.imageGenerationSettings = null;
  sessionStorage.removeItem("cardDesignerIdToken");
  sessionStorage.removeItem("cardDesignerRefreshToken");
  sessionStorage.removeItem("cardDesignerEmail");
  renderAccountUi();
}

/** Signs out and returns the home screen to its account form. */
function signOut() {
  clearAuthSession();
  setAuthStatus("");
}

/** Calls the authenticated backend API and normalizes errors. */
async function apiFetch(path, options = {}) {
  if (!state.idToken || (isJwtExpired(state.idToken) && !(await refreshAuthSession()))) {
    clearAuthSession();
    throw new Error("Your session expired. Sign in again.");
  }
  const response = await fetch(`${backendConfig.apiUrl}${path}`, {
    ...options,
    headers: {
      Authorization: `Bearer ${state.idToken}`,
      "content-type": "application/json",
      ...(options.headers || {}),
    },
  });
  const data = await response.json().catch(() => ({}));
  if (response.status === 401) {
    clearAuthSession();
    throw new Error("Your session expired. Sign in again.");
  }
  if (!response.ok) throw new Error(data.error || `API request failed with ${response.status}.`);
  return data;
}

const setSharing = createSetSharingController({
  elements,
  state,
  apiFetch,
  setStatus: setAuthStatus,
  showToast,
  onBackgroundError: setAuthStatus,
  refreshAfterResponse: async () => {},
});

/** Signs in, persists the browser session, and checks account notifications. */
async function signIn() {
  try {
    const { email, password } = getCredentials();
    const data = await cognitoRequest("InitiateAuth", {
      ClientId: backendConfig.userPoolClientId,
      AuthFlow: "USER_PASSWORD_AUTH",
      AuthParameters: { USERNAME: email, PASSWORD: password },
    });
    state.idToken = data.AuthenticationResult.IdToken;
    state.refreshToken = data.AuthenticationResult.RefreshToken || state.refreshToken;
    state.email = email;
    sessionStorage.setItem("cardDesignerIdToken", state.idToken);
    sessionStorage.setItem("cardDesignerRefreshToken", state.refreshToken);
    sessionStorage.setItem("cardDesignerEmail", state.email);
    elements.passwordInput.value = "";
    renderAccountUi();
    setAuthStatus(`Signed in as ${email}`);
    await setSharing.checkSetShareResponses();
    await setSharing.checkIncomingSetShares();
  } catch (error) {
    setAuthStatus(error.message);
  }
}

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
  elements.signUpButton.addEventListener("click", signUp);
  elements.signInButton.addEventListener("click", signIn);
  elements.confirmButton.addEventListener("click", confirmAccount);
  elements.accountMenuButton.addEventListener("click", toggleAccountMenu);
  elements.currentUserLabel.addEventListener("pointerdown", startCurrentUserTooltipPress);
  elements.currentUserLabel.addEventListener("pointerup", cancelCurrentUserTooltipPress);
  elements.currentUserLabel.addEventListener("pointercancel", cancelCurrentUserTooltipPress);
  elements.currentUserLabel.addEventListener("pointerleave", cancelCurrentUserTooltipPress);
  elements.currentUserLabel.addEventListener("contextmenu", (event) => event.preventDefault());
  elements.signOutButton.addEventListener("click", signOut);
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
  elements.myFriendsButton.addEventListener("click", () => window.alert("Coming Soon"));
  setSharing.attachEvents();
  document.addEventListener("click", (event) => {
    if (!elements.signedInPanel.contains(event.target)) closeAccountMenu();
  });
}

/** Restores the browser session and starts the home screen. */
async function initialize() {
  attachEvents();
  if (state.refreshToken && (!state.idToken || isJwtExpired(state.idToken))) await refreshAuthSession();
  if (!state.idToken || isJwtExpired(state.idToken)) {
    if (sessionStorage.getItem("cardDesignerIdToken") || sessionStorage.getItem("cardDesignerRefreshToken")) {
      clearAuthSession();
      setAuthStatus("Your session expired. Sign in again.");
    }
    renderAccountUi();
    return;
  }
  renderAccountUi();
  setAuthStatus(state.email ? `Signed in as ${state.email}` : "Signed in from this tab session");
  try {
    await setSharing.checkSetShareResponses();
    await setSharing.checkIncomingSetShares();
  } catch (error) {
    setAuthStatus(error.message);
  }
}

initialize();
