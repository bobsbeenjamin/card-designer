const backendConfig = window.backendConfig;

let defaults = {};
let rarityColors = {};
let rarityLabels = {};

const imageProviderStorageKey = "cardDesignerImageProvider";
const isRenderWorkspace = new URLSearchParams(window.location.search).get("render") === "card";
const cardRenderProfileStorageKey = "cardDesignerRenderProfile";

const cardHistoryFieldLabels = {
  name: "Name",
  artUrl: "Art",
  cost: "Cost",
  type: "Type",
  sub_type: "Subtype",
  statMode: "Stat mode",
  attack: "Attack",
  health: "Health",
  loyalty: "Loyalty",
  abilities: "Rules",
  flavorText: "Flavor text",
  artistName: "Artist",
  collectorNumber: "Collector number",
  rarity: "Rarity",
  colors: "Colors",
  setCode: "Set",
};

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

/** Returns the stored image provider choice when it is still supported. */
function getStoredImageProvider() {
  try {
    const provider = localStorage.getItem(imageProviderStorageKey) || "";
    return imageProviderLabels[provider] ? provider : "";
  } catch (error) {
    return "";
  }
}

/** Stores the selected image provider for future page loads. */
function rememberImageProvider(provider) {
  const normalizedProvider = imageProviderLabels[provider] ? provider : "openai";
  try {
    localStorage.setItem(imageProviderStorageKey, normalizedProvider);
  } catch (error) {
    // Storage can be unavailable in private or locked-down browser modes.
  }
  return normalizedProvider;
}

function getStoredIdToken() {
  return sessionStorage.getItem("cardDesignerIdToken") || "";
}

/** Returns the refresh token saved for the current browser session. */
function getStoredRefreshToken() {
  return sessionStorage.getItem("cardDesignerRefreshToken") || "";
}

const state = {
  idToken: getStoredIdToken(),
  refreshToken: getStoredRefreshToken(),
  email: sessionStorage.getItem("cardDesignerEmail") || "",
  currentCardId: "",
  cardHistory: [],
  cardHistoryLoading: false,
  cardHistoryStatus: "Load a saved card to view history.",
  savedCards: [],
  savedSets: [],
  artObjectUrl: "",
  artUrl: "",
  pendingArtUpload: null,
  pendingArtLoad: null,
  libraryDraggedCardId: "",
  libraryDragMoved: false,
  cardRendererReadyPromise: null,
  imageGenerationSettings: null,
  renderSetTotal: null,
  imageProviderCredentialsExpanded: false,
};

const elements = {
  card: document.querySelector("#card"),
  cardRenderFrame: document.querySelector("#cardRenderFrame"),
  artWindow: document.querySelector(".art-window"),
  art: document.querySelector("#cardArt"),
  rulesPanel: document.querySelector(".rules-panel"),
  cardName: document.querySelector("#cardName"),
  cardType: document.querySelector("#cardType"),
  cardCost: document.querySelector("#cardCost"),
  cardAttack: document.querySelector("#cardAttack"),
  cardHealth: document.querySelector("#cardHealth"),
  cardLoyalty: document.querySelector("#cardLoyalty"),
  cardAbility: document.querySelector("#cardAbility"),
  cardFlavor: document.querySelector("#cardFlavor"),
  cardArtist: document.querySelector("#cardArtist"),
  cardCollector: document.querySelector("#cardCollector"),
  cardRarity: document.querySelector("#cardRarity"),
  nameInput: document.querySelector("#nameInput"),
  setInput: document.querySelector("#setInput"),
  typeInput: document.querySelector("#typeInput"),
  customTypeInput: document.querySelector("#customTypeInput"),
  customTypeLabel: document.querySelector("#customTypeLabel"),
  subtypeInput: document.querySelector("#subtypeInput"),
  costInput: document.querySelector("#costInput"),
  statModeInput: document.querySelector("#statModeInput"),
  combatInputs: document.querySelector("#combatInputs"),
  loyaltyInputs: document.querySelector("#loyaltyInputs"),
  attackInput: document.querySelector("#attackInput"),
  healthInput: document.querySelector("#healthInput"),
  loyaltyInput: document.querySelector("#loyaltyInput"),
  abilityInput: document.querySelector("#abilityInput"),
  flavorInput: document.querySelector("#flavorInput"),
  artistInput: document.querySelector("#artistInput"),
  collectorInput: document.querySelector("#collectorInput"),
  rarityInput: document.querySelector("#rarityInput"),
  generateImageButton: document.querySelector("#generateImageButton"),
  generateImageSpinner: document.querySelector("#generateImageSpinner"),
  artInput: document.querySelector("#artInput"),
  artUrlInput: document.querySelector("#artUrlInput"),
  deleteArtButton: document.querySelector("#deleteArtButton"),
  fitInput: document.querySelector("#fitInput"),
  frameColor: document.querySelector("#frameColor"),
  accentColor: document.querySelector("#accentColor"),
  textColor: document.querySelector("#textColor"),
  panelColor: document.querySelector("#panelColor"),
  recentCardHistoryRows: document.querySelector("#recentCardHistoryRows"),
  allCardHistoryRows: document.querySelector("#allCardHistoryRows"),
  viewAllCardHistoryButton: document.querySelector("#viewAllCardHistoryButton"),
  cardHistoryDialog: document.querySelector("#cardHistoryDialog"),
  cardHistorySubtitle: document.querySelector("#cardHistorySubtitle"),
  emailInput: document.querySelector("#emailInput"),
  passwordInput: document.querySelector("#passwordInput"),
  signInPanel: document.querySelector("#signInPanel"),
  signedInPanel: document.querySelector("#signedInPanel"),
  aiSettingsPanel: document.querySelector("#aiSettingsPanel"),
  imageProviderInput: document.querySelector("#imageProviderInput"),
  providerSelectRow: document.querySelector("#providerSelectRow"),
  replaceProviderCredentialsButton: document.querySelector("#replaceProviderCredentialsButton"),
  providerApiKeyLabel: document.querySelector("#providerApiKeyLabel"),
  providerApiKeyInput: document.querySelector("#providerApiKeyInput"),
  providerEndpointLabel: document.querySelector("#providerEndpointLabel"),
  providerEndpointInput: document.querySelector("#providerEndpointInput"),
  providerModelLabel: document.querySelector("#providerModelLabel"),
  providerModelInput: document.querySelector("#providerModelInput"),
  saveImageGenerationSettingsButton: document.querySelector("#saveImageGenerationSettingsButton"),
  imageGenerationStatus: document.querySelector("#imageGenerationStatus"),
  mySetsPanel: document.querySelector("#mySetsPanel"),
  cardSetsInput: document.querySelector("#cardSetsInput"),
  addSetButton: document.querySelector("#addSetButton"),
  makeSetPublicButton: document.querySelector("#makeSetPublicButton"),
  publicSetLinkLine: document.querySelector("#publicSetLinkLine"),
  publicSetLink: document.querySelector("#publicSetLink"),
  viewSetsButton: document.querySelector("#viewSetsButton"),
  setLibraryDialog: document.querySelector("#setLibraryDialog"),
  setLibraryTitle: document.querySelector("#setLibraryTitle"),
  setLibraryBackButton: document.querySelector("#setLibraryBackButton"),
  setLibraryCloseButton: document.querySelector("#setLibraryCloseButton"),
  setLibraryStatus: document.querySelector("#setLibraryStatus"),
  setLibraryContent: document.querySelector("#setLibraryContent"),
  setDialog: document.querySelector("#setDialog"),
  setDialogForm: document.querySelector("#setDialogForm"),
  setCodeInput: document.querySelector("#setCodeInput"),
  setNameInput: document.querySelector("#setNameInput"),
  setSymbolInput: document.querySelector("#setSymbolInput"),
  setCopyrightInput: document.querySelector("#setCopyrightInput"),
  setPublicInput: document.querySelector("#setPublicInput"),
  setDialogStatus: document.querySelector("#setDialogStatus"),
  cancelSetButton: document.querySelector("#cancelSetButton"),
  saveSetButton: document.querySelector("#saveSetButton"),
  currentUserLabel: document.querySelector("#currentUserLabel"),
  accountMenuButton: document.querySelector("#accountMenuButton"),
  accountMenu: document.querySelector("#accountMenu"),
  confirmationInput: document.querySelector("#confirmationInput"),
  authStatus: document.querySelector("#authStatus"),
  saveStatus: document.querySelector("#saveStatus"),
  savedCardsInput: document.querySelector("#savedCardsInput"),
  signUpButton: document.querySelector("#signUpButton"),
  confirmButton: document.querySelector("#confirmButton"),
  signInButton: document.querySelector("#signInButton"),
  signOutButton: document.querySelector("#signOutButton"),
  saveNewButton: document.querySelector("#saveNewButton"),
  updateSavedButton: document.querySelector("#updateSavedButton"),
  loadSavedButton: document.querySelector("#loadSavedButton"),
  deleteSavedButton: document.querySelector("#deleteSavedButton"),
  resetCard: document.querySelector("#resetCard"),
  exportPng: document.querySelector("#exportPng"),
  duplicateSaveDialog: document.querySelector("#duplicateSaveDialog"),
  duplicateSaveMessage: document.querySelector("#duplicateSaveMessage"),
  deleteSetDialog: document.querySelector("#deleteSetDialog"),
  deleteSetTitle: document.querySelector("#deleteSetTitle"),
  deleteSetMessage: document.querySelector("#deleteSetMessage"),
  confirmDeleteSetButton: document.querySelector("#confirmDeleteSetButton"),
  saveArtDialog: document.querySelector("#saveArtDialog"),
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

const setSharing = createSetSharingController({
  elements,
  state,
  apiFetch,
  setStatus: setSaveStatus,
  showToast,
  onBackgroundError: setSaveStatus,
  refreshAfterResponse: async () => {
    await Promise.all([refreshSavedCards(), refreshCardSets()]);
    renderSavedCards();
    renderCardSets();
  },
});

function getRarityColor(rarity) {
  return rarityColors[rarity] || rarityColors.common || "currentColor";
}

function getRarityLabel(rarity) {
  return rarityLabels[rarity] || rarityLabels.common;
}

/** Loads the starter card values from the defaults JSON file. */
async function loadCardDefaults() {
  const response = await fetch("defaults/card-defaults.json");
  if (!response.ok) throw new Error("Card defaults failed to load.");

  defaults = await response.json();
}

/** Loads rarity labels and colors used by the preview. */
async function loadRarityInfo() {
  const response = await fetch("defaults/rarity-info.json");
  if (!response.ok) throw new Error("Rarity defaults failed to load.");

  const rarityInfo = await response.json();
  rarityColors = rarityInfo.colors || {};
  rarityLabels = rarityInfo.labels || {};
}

function updateText(target, value, fallback) {
  target.textContent = String(value || "").trim() || fallback;
}

/** Renders entered line breaks with extra spacing while preserving normal wrapping. */
function updateMultilineText(target, value, fallback) {
  const text = String(value || "").trim() || fallback;
  target.replaceChildren();
  if (!text) return;

  for (const line of text.split(/\r?\n/)) {
    const lineElement = document.createElement("span");
    lineElement.className = "card-text-line";
    lineElement.textContent = line || "\u00a0";
    target.append(lineElement);
  }
}

function setAuthStatus(message) {
  elements.authStatus.textContent = message;
}

function setSaveStatus(message) {
  elements.saveStatus.textContent = message;
}

/** Stores the visible card dimensions used as the offscreen render reference. */
function rememberCardRenderProfile() {
  if (isRenderWorkspace) return;

  try {
    const cardBounds = elements.card.getBoundingClientRect();
    const rootFontSize = Number.parseFloat(getComputedStyle(document.documentElement).fontSize);
    localStorage.setItem(cardRenderProfileStorageKey, JSON.stringify({
      rootFontSize,
      width: cardBounds.width,
    }));
  } catch (error) {
    // Rendering still works when local storage is unavailable.
  }
}

/** Applies the visible card dimensions to the hidden renderer workspace. */
function applyCardRenderProfile() {
  if (!isRenderWorkspace) return;

  try {
    const profile = JSON.parse(localStorage.getItem(cardRenderProfileStorageKey) || "null");
    if (Number.isFinite(profile?.width) && profile.width > 0) {
      elements.card.style.width = `${profile.width}px`;
    }
    if (Number.isFinite(profile?.rootFontSize) && profile.rootFontSize > 0) {
      document.documentElement.style.fontSize = `${profile.rootFontSize}px`;
    }
  } catch (error) {
    // The renderer keeps its normal CSS sizing when the profile is unavailable.
  }
}

/** Shows a dismissible toast message for ten seconds. */
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

function closeAccountMenu() {
  elements.accountMenu.classList.add("hidden");
  elements.accountMenuButton.setAttribute("aria-expanded", "false");
}

/** Toggles account controls based on the current sign-in state. */
function updateAccountUi() {
  const signedIn = Boolean(state.idToken);
  elements.signInPanel.classList.toggle("hidden", signedIn);
  elements.signedInPanel.classList.toggle("hidden", !signedIn);
  elements.aiSettingsPanel.classList.toggle("hidden", !signedIn);
  elements.mySetsPanel.classList.toggle("hidden", !signedIn);
  elements.currentUserLabel.textContent = state.email || "Account";
  if (!signedIn) {
    closeAccountMenu();
    state.imageGenerationSettings = null;
    state.imageProviderCredentialsExpanded = false;
    elements.providerApiKeyInput.value = "";
    elements.providerEndpointInput.value = "";
    elements.providerModelInput.value = "";
    elements.imageProviderInput.value = getStoredImageProvider() || "openai";
    syncImageProviderSettingsUi();
    elements.imageGenerationStatus.textContent = "No image provider configured";
  }
}

/** Opens or closes the account popover. */
function toggleAccountMenu() {
  const isOpen = !elements.accountMenu.classList.contains("hidden");
  elements.accountMenu.classList.toggle("hidden", isOpen);
  elements.accountMenuButton.setAttribute("aria-expanded", String(!isOpen));
}

function formatCost(value) {
  return `$${String(value || "").trim() || "0"}`;
}

let standardTypes = [];
const statlessTypes = ["Event", "Item"];

/** Loads the built-in card type options. */
async function loadCardTypes() {
  const response = await fetch("defaults/card-types.json");
  if (!response.ok) throw new Error("Card type defaults failed to load.");

  standardTypes = await response.json();
}

function syncTypeMode() {
  const isCustom = elements.typeInput.value === "__custom";
  elements.customTypeLabel.classList.toggle("hidden", !isCustom);
}

/** Returns either the selected standard type or the custom type text. */
function getSelectedType() {
  if (elements.typeInput.value === "__custom") {
    return elements.customTypeInput.value.trim();
  }

  return elements.typeInput.value.trim();
}

function isStatlessType(typeValue) {
  return statlessTypes.includes(String(typeValue || "").trim());
}

/** Selects the standard/custom type controls for a stored card type. */
function setTypeControl(value) {
  const typeValue = String(value || "").trim();

  if (!typeValue || standardTypes.includes(typeValue)) {
    elements.typeInput.value = typeValue || defaults.type;
    elements.customTypeInput.value = "";
  } else {
    elements.typeInput.value = "__custom";
    elements.customTypeInput.value = typeValue;
  }

  syncTypeMode();
}

/** Shrinks or wraps the preview name so it stays inside the card header. */
function fitCardName() {
  const name = elements.cardName;
  name.classList.remove("is-wrapped");
  name.style.fontSize = "";

  const defaultSize = Number.parseFloat(getComputedStyle(name).fontSize);
  const minSize = Number.parseFloat(getComputedStyle(document.documentElement).fontSize) * 0.8;
  let size = defaultSize;

  while (name.scrollWidth > name.clientWidth && size > minSize) {
    size = Math.max(minSize, size - 1);
    name.style.fontSize = `${size}px`;
  }

  if (name.scrollWidth > name.clientWidth) {
    name.classList.add("is-wrapped");
  }
}

/** Shrinks rules and flavor text until the text box can contain it. */
function fitRulesText() {
  const panel = elements.rulesPanel;
  const ability = elements.cardAbility;
  const flavor = elements.cardFlavor;
  ability.style.fontSize = "";
  ability.style.lineHeight = "";
  flavor.style.fontSize = "";
  flavor.style.lineHeight = "";

  const rootSize = Number.parseFloat(getComputedStyle(document.documentElement).fontSize);
  const minAbilitySize = rootSize * 0.5;
  const minFlavorSize = rootSize * 0.48;
  let abilitySize = Number.parseFloat(getComputedStyle(ability).fontSize);
  let flavorSize = Number.parseFloat(getComputedStyle(flavor).fontSize);

  while (panel.scrollHeight > panel.clientHeight && (abilitySize > minAbilitySize || flavorSize > minFlavorSize)) {
    if (abilitySize > minAbilitySize) {
      abilitySize = Math.max(minAbilitySize, abilitySize - 1);
      ability.style.fontSize = `${abilitySize}px`;
      ability.style.lineHeight = "1.22";
    }

    if (panel.scrollHeight <= panel.clientHeight) break;

    if (flavorSize > minFlavorSize) {
      flavorSize = Math.max(minFlavorSize, flavorSize - 1);
      flavor.style.fontSize = `${flavorSize}px`;
      flavor.style.lineHeight = "1.18";
    }
  }
}

/** Converts stored collector values to a positive card number. */
function normalizeCollectorNumber(value) {
  const rawValue = String(value || "").trim();
  const cardNumber = rawValue.split("/", 1)[0].trim();
  const parsed = Number.parseInt(cardNumber, 10);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : 1;
}

/** Returns saved cards for a set ordered by collector number. */
function getCardsInSet(setCode) {
  return state.savedCards
    .filter((card) => (card.setCode || "DEFAULT") === (setCode || "DEFAULT"))
    .sort((first, second) => {
      const firstNumber = normalizeCollectorNumber(first.collectorNumber);
      const secondNumber = normalizeCollectorNumber(second.collectorNumber);
      if (firstNumber !== secondNumber) return firstNumber - secondNumber;
      return String(first.name || "").localeCompare(String(second.name || ""));
    });
}

function getSetTotal(setCode) {
  const cardsInSet = state.savedCards.filter((card) => (card.setCode || "DEFAULT") === (setCode || "DEFAULT"));
  return Math.max(cardsInSet.length, 1);
}

/** Returns the set total to show for the current editor state. */
function getPreviewSetTotal(setCode) {
  const cardsInSet = state.savedCards.filter((card) => (card.setCode || "DEFAULT") === (setCode || "DEFAULT"));
  if (state.currentCardId) return Math.max(cardsInSet.length, 1);
  return Math.max(cardsInSet.length + 1, 1);
}

function getNextCollectorNumber(setCode) {
  const cardsInSet = state.savedCards.filter((card) => (card.setCode || "DEFAULT") === (setCode || "DEFAULT"));
  return cardsInSet.reduce((max, card) => Math.max(max, normalizeCollectorNumber(card.collectorNumber)), 0) + 1;
}

function formatCollectorNumber(number, setCode, total = getSetTotal(setCode)) {
  return `${normalizeCollectorNumber(number)}/${total}`;
}

function formatPreviewCollectorNumber() {
  const setCode = elements.setInput.value || "DEFAULT";
  const setTotal = isRenderWorkspace && state.renderSetTotal
    ? state.renderSetTotal
    : getPreviewSetTotal(setCode);
  return formatCollectorNumber(elements.collectorInput.value, setCode, setTotal);
}

/** Keeps new unsaved cards assigned to the next set slot. */
function syncCollectorInputForCurrentSet() {
  if (!state.currentCardId) {
    elements.collectorInput.value = getNextCollectorNumber(elements.setInput.value || "DEFAULT");
  }
}

/** Copies form state into the live card preview. */
function syncCard() {
  syncTypeMode();
  const subtype = elements.subtypeInput.value.trim();
  const typeValue = getSelectedType();
  const typeLine = subtype ? `${typeValue || "Card"} - ${subtype}` : typeValue;
  const isStatless = isStatlessType(typeValue);
  if (!isStatless && !["combat", "loyalty"].includes(elements.statModeInput.value)) {
    elements.statModeInput.value = "combat";
  }
  const isLoyalty = !isStatless && elements.statModeInput.value === "loyalty";
  const rarity = elements.rarityInput.value;
  syncCollectorInputForCurrentSet();

  updateText(elements.cardName, elements.nameInput.value, "Untitled Card");
  fitCardName();
  updateText(elements.cardType, typeLine, "Card");
  elements.cardCost.textContent = formatCost(elements.costInput.value);
  updateText(elements.cardAttack, elements.attackInput.value, "0");
  updateText(elements.cardHealth, elements.healthInput.value, "0");
  updateText(elements.cardLoyalty, elements.loyaltyInput.value, "0");
  updateMultilineText(elements.cardAbility, elements.abilityInput.value, "");
  updateMultilineText(elements.cardFlavor, elements.flavorInput.value, "");
  elements.cardFlavor.classList.toggle(
    "has-separator",
    Boolean(elements.abilityInput.value.trim() && elements.flavorInput.value.trim()),
  );
  updateText(
    elements.cardArtist,
    elements.artistInput.value ? `Art: ${elements.artistInput.value}` : "",
    "Art: Unknown",
  );
  updateText(elements.cardCollector, formatPreviewCollectorNumber(), "1/1");
  updateText(elements.cardRarity, getRarityLabel(rarity), getRarityLabel("common"));

  elements.card.classList.toggle("is-loyalty", isLoyalty);
  elements.card.classList.toggle("is-statless", isStatless);
  elements.statModeInput.closest("label").classList.toggle("hidden", isStatless);
  elements.combatInputs.classList.toggle("hidden", isStatless || isLoyalty);
  elements.loyaltyInputs.classList.toggle("hidden", isStatless || !isLoyalty);
  updateArtFit();
  document.documentElement.style.setProperty("--frame", elements.frameColor.value);
  document.documentElement.style.setProperty("--accent", elements.accentColor.value);
  document.documentElement.style.setProperty("--card-text", elements.textColor.value);
  document.documentElement.style.setProperty("--panel", elements.panelColor.value);
  document.documentElement.style.setProperty("--rarity-color", getRarityColor(rarity));
  fitRulesText();
}

/** Checks whether artwork input is an acceptable image URI. */
function isValidImageUri(value) {
  const artUrl = String(value || "").trim();
  if (!artUrl) return true;
  if (artUrl.startsWith("data:image/")) return true;

  try {
    const url = new URL(artUrl);
    return ["http:", "https:"].includes(url.protocol);
  } catch (error) {
    return false;
  }
}

/** Releases the current object URL used for proxied artwork. */
function revokeArtObjectUrl() {
  if (state.artObjectUrl) {
    URL.revokeObjectURL(state.artObjectUrl);
    state.artObjectUrl = "";
  }
}

/** Removes artwork from the preview and resets image state. */
function clearArt() {
  revokeArtObjectUrl();
  state.artUrl = "";
  state.pendingArtUpload = null;
  elements.art.removeAttribute("src");
  elements.art.removeAttribute("crossorigin");
  setArtWindowImage("");
  elements.artWindow.classList.remove("has-image");
}

function setArtWindowImage(src) {
  elements.artWindow.style.backgroundImage = src
    ? `url("${String(src).replace(/"/g, "%22")}")`
    : "";
  updateArtFit();
}

function updateArtFit() {
  const fit = elements.fitInput.value || "cover";
  const backgroundSize = fit === "fill" ? "100% 100%" : fit;
  elements.artWindow.style.backgroundSize = backgroundSize;
}

/** Fetches a remote image through the authenticated image proxy. */
async function getProxiedImageSource(artUrl) {
  if (!state.idToken || isJwtExpired(state.idToken)) {
    throw new Error("Sign in to load image URLs through the CORS-safe proxy.");
  }

  const isSavedArtUrl = artUrl.startsWith(`${backendConfig.apiUrl}/art?`);
  const imageRequestUrl = isSavedArtUrl
    ? artUrl
    : `${backendConfig.apiUrl}/image-proxy?url=${encodeURIComponent(artUrl)}`;
  const response = await fetch(imageRequestUrl, {
    headers: { Authorization: `Bearer ${state.idToken}` },
  });

  if (!response.ok) {
    const data = await response.json().catch(() => ({}));
    throw new Error(data.error || `Image proxy failed with ${response.status}.`);
  }

  const blob = await response.blob();
  if (!blob.type.startsWith("image/")) {
    throw new Error("Image URL did not return an image.");
  }

  return URL.createObjectURL(blob);
}

/** Loads an image element and resolves after its pixels are available. */
function loadArtElement(src) {
  return new Promise((resolve, reject) => {
    const handleLoad = () => {
      cleanup();
      resolve();
    };
    const handleError = () => {
      cleanup();
      reject(new Error("Image URL did not load as an image."));
    };
    const cleanup = () => {
      elements.art.removeEventListener("load", handleLoad);
      elements.art.removeEventListener("error", handleError);
    };

    elements.art.addEventListener("load", handleLoad);
    elements.art.addEventListener("error", handleError);
    elements.art.src = src;
    if (elements.art.complete) {
      if (elements.art.naturalWidth > 0) handleLoad();
      else handleError();
    }
  });
}

/** Marks the preview ready after artwork pixels have loaded. */
function markArtLoaded(statusMessage = "") {
  setArtWindowImage(elements.art.currentSrc || elements.art.src);
  elements.artWindow.classList.add("has-image");
  if (statusMessage) setSaveStatus(statusMessage);
}

/** Loads artwork from a file, data URL, proxied URL, or direct URL fallback. */
async function setArtSource(src, statusMessage = "") {
  const artUrl = String(src || "").trim();
  revokeArtObjectUrl();
  state.artUrl = artUrl;
  if (!artUrl) {
    clearArt();
    return;
  }

  if (!isValidImageUri(artUrl)) {
    clearArt();
    setSaveStatus("Enter a valid image URL.");
    return;
  }

  elements.art.onload = () => markArtLoaded(statusMessage);
  elements.art.onerror = () => {
    clearArt();
    if (statusMessage) setSaveStatus("Image URL did not load as an image.");
  };

  elements.art.removeAttribute("crossorigin");
  if (artUrl.startsWith("data:")) {
    try {
      await loadArtElement(artUrl);
      markArtLoaded(statusMessage);
    } catch (error) {
      return;
    }
    return;
  }

  try {
    const objectUrl = await getProxiedImageSource(artUrl);
    state.artObjectUrl = objectUrl;
    await loadArtElement(objectUrl);
    markArtLoaded(statusMessage);
  } catch (error) {
    try {
      await loadArtElement(artUrl);
      markArtLoaded(statusMessage);
    } catch (loadError) {
      setSaveStatus(loadError.message);
    }
    setSaveStatus(`${error.message} Preview may work, but PNG export may fail.`);
  }
}

function loadArtUrl() {
  elements.artInput.value = "";
  state.pendingArtUpload = null;
  setArtSource(elements.artUrlInput.value, "Image URL loaded");
}

/** Generates card art from the current name/flavor and loads the saved art URL. */
async function generateImage() {
  try {
    elements.generateImageButton.disabled = true;
    elements.generateImageSpinner.classList.remove("hidden");
    setSaveStatus("Generating image...");
    const data = await apiFetch("/art/generate", {
      method: "POST",
      body: JSON.stringify({
        cardName: elements.nameInput.value.trim() || "Untitled Card",
        flavorText: elements.flavorInput.value.trim(),
        provider: elements.imageProviderInput.value || "openai",
        setCode: elements.setInput.value || "DEFAULT",
      }),
    });
    const artUrl = data.artUrl?.startsWith("http") ? data.artUrl : `${backendConfig.apiUrl}${data.artUrl}`;
    state.pendingArtUpload = null;
    elements.artInput.value = "";
    elements.artUrlInput.value = artUrl;
    await setArtSource(artUrl, "Generated image loaded");
    syncCard();
  } catch (error) {
    setSaveStatus("Image generation failed. See the error popup for details.");
    showToast(error.message);
  } finally {
    elements.generateImageButton.disabled = false;
    elements.generateImageSpinner.classList.add("hidden");
  }
}

/** Restores the editor to default card values. */
function resetCard() {
  state.currentCardId = "";
  clearCardHistory();
  elements.nameInput.value = defaults.name;
  setTypeControl(defaults.type);
  elements.setInput.value = "DEFAULT";
  elements.subtypeInput.value = defaults.subtype;
  elements.costInput.value = defaults.cost;
  elements.statModeInput.value = defaults.statMode;
  elements.attackInput.value = defaults.attack;
  elements.healthInput.value = defaults.health;
  elements.loyaltyInput.value = defaults.loyalty;
  elements.abilityInput.value = defaults.ability;
  elements.flavorInput.value = defaults.flavor;
  elements.artistInput.value = defaults.artist;
  elements.collectorInput.value = getNextCollectorNumber(elements.setInput.value || "DEFAULT");
  elements.rarityInput.value = defaults.rarity;
  elements.fitInput.value = defaults.fit;
  elements.frameColor.value = defaults.frame;
  elements.accentColor.value = defaults.accent;
  elements.textColor.value = defaults.text;
  elements.panelColor.value = defaults.panel;
  elements.artInput.value = "";
  elements.artUrlInput.value = "";
  state.pendingArtUpload = null;
  clearArt();
  syncCard();
}

/** Reads an uploaded artwork file into the preview. */
function loadArt(event) {
  const [file] = event.target.files;
  if (!file) return;

  elements.artUrlInput.value = "";
  const reader = new FileReader();
  const pendingLoad = new Promise((resolve, reject) => {
    reader.addEventListener("load", async () => {
      state.pendingArtUpload = {
        dataUrl: reader.result,
        fileName: file.name,
        type: file.type,
      };
      try {
        await setArtSource(reader.result);
        resolve();
      } catch (error) {
        reject(error);
      }
    });
    reader.addEventListener("error", () => reject(new Error("The artwork file could not be read.")));
  });
  state.pendingArtLoad = pendingLoad;
  pendingLoad
    .catch((error) => setSaveStatus(error.message))
    .finally(() => {
      if (state.pendingArtLoad === pendingLoad) state.pendingArtLoad = null;
    });
  reader.readAsDataURL(file);
}

/** Builds the card payload sent to the backend. */
function collectCardData() {
  const typedArtUrl = elements.artUrlInput.value.trim();
  const hasDataUrlArt = String(state.artUrl || elements.art.src || "").startsWith("data:");
  let artUrl = typedArtUrl || state.pendingArtUpload?.dataUrl || (
    hasDataUrlArt ? state.artUrl || elements.art.src || "" : ""
  );
  if (artUrl.startsWith("data:") && artUrl.length > 300000) {
    artUrl = "";
    setSaveStatus("Design saved without art; uploaded image is too large for DynamoDB.");
  }

  const typeValue = getSelectedType();
  const isStatless = isStatlessType(typeValue);
  const statMode = ["combat", "loyalty"].includes(elements.statModeInput.value)
    ? elements.statModeInput.value
    : "combat";

  return {
    name: elements.nameInput.value.trim() || "Untitled Card",
    artUrl,
    cost: Number(elements.costInput.value || 0),
    type: typeValue,
    sub_type: elements.subtypeInput.value.trim(),
    statMode: isStatless ? "none" : statMode,
    attack: !isStatless && statMode === "combat" ? Number(elements.attackInput.value || 0) : null,
    health: !isStatless && statMode === "combat" ? Number(elements.healthInput.value || 0) : null,
    loyalty: !isStatless && statMode === "loyalty" ? Number(elements.loyaltyInput.value || 0) : null,
    setCode: elements.setInput.value || "DEFAULT",
    abilities: elements.abilityInput.value,
    flavorText: elements.flavorInput.value,
    artistName: elements.artistInput.value.trim(),
    collectorNumber: normalizeCollectorNumber(elements.collectorInput.value),
    rarity: elements.rarityInput.value,
    colors: {
      frame: elements.frameColor.value,
      accent: elements.accentColor.value,
      text: elements.textColor.value,
      panel: elements.panelColor.value,
    },
  };
}

/** Loads a saved card record into the editor controls and preview. */
function applyCardData(card) {
  state.currentCardId = card.cardId || "";
  elements.nameInput.value = card.name || defaults.name;
  setTypeControl(card.type || defaults.type);
  elements.subtypeInput.value = card.sub_type || card.subtype || "";
  elements.costInput.value = card.cost ?? defaults.cost;
  elements.statModeInput.value = card.statMode || "combat";
  elements.attackInput.value = card.attack ?? defaults.attack;
  elements.healthInput.value = card.health ?? defaults.health;
  elements.loyaltyInput.value = card.loyalty ?? defaults.loyalty;
  elements.abilityInput.value = card.abilities || "";
  elements.flavorInput.value = card.flavorText || "";
  elements.artistInput.value = card.artistName || "";
  elements.collectorInput.value = normalizeCollectorNumber(card.collectorNumber);
  elements.rarityInput.value = card.rarity || "common";
  elements.setInput.value = card.setCode || "DEFAULT";
  elements.cardSetsInput.value = card.setCode || "DEFAULT";
  renderSavedCards();
  elements.frameColor.value = card.colors?.frame || defaults.frame;
  elements.accentColor.value = card.colors?.accent || defaults.accent;
  elements.textColor.value = card.colors?.text || defaults.text;
  elements.panelColor.value = card.colors?.panel || defaults.panel;

  elements.artInput.value = "";
  elements.artUrlInput.value = card.artUrl && !card.artUrl.startsWith("data:") ? card.artUrl : "";
  if (card.artUrl) {
    setArtSource(card.artUrl);
  } else {
    clearArt();
  }

  syncCard();
}

/** Formats a stored history timestamp in the user's local date and time. */
function formatCardHistoryDate(recordedAt) {
  const numericTimestamp = Number(recordedAt);
  if (!Number.isFinite(numericTimestamp) || numericTimestamp <= 0) return "Unknown date";
  const timestamp = numericTimestamp < 1_000_000_000_000 ? numericTimestamp * 1000 : numericTimestamp;
  return new Intl.DateTimeFormat(undefined, {
    dateStyle: "short",
    timeStyle: "short",
  }).format(new Date(timestamp));
}

/** Formats one history value for display in the old/new value columns. */
function formatCardHistoryValue(value) {
  if (value === null || value === undefined || value === "") return "blank";
  if (Array.isArray(value)) return value.join(", ");
  if (typeof value === "object") {
    return Object.entries(value)
      .map(([key, nestedValue]) => `${cardHistoryFieldLabels[key] || key}: ${formatCardHistoryValue(nestedValue)}`)
      .join("; ");
  }
  return String(value);
}

/** Formats changed fields as aligned old/new value cell text. */
function formatCardHistoryValues(values) {
  const entries = Object.entries(values || {});
  if (!entries.length) return "Unavailable";
  return entries
    .map(([field, value]) => `${cardHistoryFieldLabels[field] || field}: ${formatCardHistoryValue(value)}`)
    .join("\n");
}

/** Appends one history row with optional old and new value columns.
 * @param {*} tableBody Table body receiving the row.
 * @param {*} entry History entry to render.
 * @param {*} includeValues Whether to include old and new value cells.
 */
function appendCardHistoryRow(tableBody, entry, includeValues) {
  const row = document.createElement("tr");
  const dateCell = document.createElement("td");
  const userCell = document.createElement("td");
  const descriptionCell = document.createElement("td");
  dateCell.textContent = formatCardHistoryDate(entry.recordedAt);
  userCell.textContent = entry.changedBy || "Unknown user";
  descriptionCell.textContent = entry.description || "Updated card.";
  row.append(dateCell, userCell, descriptionCell);
  if (includeValues) {
    const oldValueCell = document.createElement("td");
    const newValueCell = document.createElement("td");
    oldValueCell.className = "card-history-value";
    newValueCell.className = "card-history-value";
    oldValueCell.textContent = formatCardHistoryValues(entry.oldValues);
    newValueCell.textContent = formatCardHistoryValues(entry.newValues);
    row.append(oldValueCell, newValueCell);
  }
  tableBody.append(row);
}

/** Renders recent history entries into the compact table. */
function renderCardHistoryTable(tableBody, history) {
  tableBody.replaceChildren();
  if (!history.length) {
    const row = document.createElement("tr");
    const cell = document.createElement("td");
    cell.className = "card-history-empty";
    cell.colSpan = 3;
    cell.textContent = state.cardHistoryStatus || "No changes recorded for this card.";
    row.append(cell);
    tableBody.append(row);
    return;
  }

  history.forEach((entry) => appendCardHistoryRow(tableBody, entry, false));
}

/** Renders all history entries with old and new values in the modal. */
function renderFullCardHistoryTable(tableBody, history) {
  tableBody.replaceChildren();
  if (!history.length) {
    const row = document.createElement("tr");
    const cell = document.createElement("td");
    cell.className = "card-history-empty";
    cell.colSpan = 5;
    cell.textContent = state.cardHistoryStatus || "No changes recorded for this card.";
    row.append(cell);
    tableBody.append(row);
    return;
  }

  history.forEach((entry) => appendCardHistoryRow(tableBody, entry, true));
}

/** Refreshes the compact and full card-history tables from current state. */
function renderCardHistory() {
  renderCardHistoryTable(elements.recentCardHistoryRows, state.cardHistory.slice(0, 3));
  renderFullCardHistoryTable(elements.allCardHistoryRows, state.cardHistory);
  elements.viewAllCardHistoryButton.disabled = !state.currentCardId || state.cardHistoryLoading;
}

/** Clears history when no saved card is active. */
function clearCardHistory(message = "Load a saved card to view history.") {
  state.cardHistory = [];
  state.cardHistoryLoading = false;
  state.cardHistoryStatus = message;
  renderCardHistory();
}

/** Loads all history entries for the active saved card. */
async function refreshCardHistory(cardId = state.currentCardId, limit = 3) {
  if (!cardId || !state.idToken) {
    clearCardHistory();
    return;
  }

  state.cardHistoryLoading = true;
  state.cardHistory = [];
  state.cardHistoryStatus = "Loading card history...";
  renderCardHistory();
  try {
    const query = limit ? `?limit=${encodeURIComponent(limit)}` : "";
    const data = await apiFetch(`/cards/${encodeURIComponent(cardId)}/history${query}`);
    if (state.currentCardId !== cardId) return;
    state.cardHistory = data.history || [];
    state.cardHistoryStatus = state.cardHistory.length ? "" : "No changes recorded for this card.";
  } catch (error) {
    if (state.currentCardId !== cardId) return;
    state.cardHistory = [];
    state.cardHistoryStatus = "Card history could not be loaded.";
  } finally {
    if (state.currentCardId === cardId) {
      state.cardHistoryLoading = false;
      renderCardHistory();
    }
  }
}

/** Opens the full history modal for the active card. */
async function openCardHistoryDialog() {
  if (!state.currentCardId || state.cardHistoryLoading) return;
  elements.cardHistorySubtitle.textContent = elements.nameInput.value.trim() || "Untitled Card";
  elements.cardHistoryDialog.showModal();
  await refreshCardHistory(state.currentCardId, null);
}

/** Calls the Cognito API used by browser auth flows. */
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

  if (!response.ok) {
    throw new Error(data.message || data.__type || "Cognito request failed.");
  }

  return data;
}

/** Reads and validates the account credential fields. */
function getCredentials() {
  const email = elements.emailInput.value.trim();
  const password = elements.passwordInput.value;
  if (!email || !password) {
    throw new Error("Enter an email and password first.");
  }
  return { email, password };
}

/** Starts Cognito sign-up for the entered account. */
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

/** Returns cached settings status for the selected image provider. */
function getSelectedProviderStatus() {
  const provider = elements.imageProviderInput.value || "openai";
  return state.imageGenerationSettings?.providers?.[provider] || {
    label: getImageProviderLabel(provider),
    configured: false,
    apiKeyConfigured: false,
    endpointUrl: "",
    defaultEndpointUrl: "",
    modelId: "",
    requiresApiKey: !keylessImageProviders.has(provider),
    requiresEndpoint: endpointConfigProviders.has(provider) && provider !== "stability",
  };
}

/** Updates the provider settings controls for the currently selected provider. */
function syncImageProviderSettingsUi() {
  const provider = elements.imageProviderInput.value || "openai";
  const status = getSelectedProviderStatus();
  const label = status.label || getImageProviderLabel(provider);
  const isCollapsed = status.configured && status.apiKeyConfigured && !state.imageProviderCredentialsExpanded;
  const showApiKey = !isCollapsed && !keylessImageProviders.has(provider);
  const showEndpoint = !isCollapsed && endpointConfigProviders.has(provider);
  const showModel = !isCollapsed && modelConfigProviders.has(provider);
  const showSaveButton = !isCollapsed;

  elements.providerSelectRow.classList.toggle("has-replace-action", isCollapsed);
  elements.replaceProviderCredentialsButton.classList.toggle("hidden", !isCollapsed);
  elements.providerApiKeyLabel.classList.toggle("hidden", !showApiKey);
  elements.providerEndpointLabel.classList.toggle("hidden", !showEndpoint);
  elements.providerModelLabel.classList.toggle("hidden", !showModel);
  elements.saveImageGenerationSettingsButton.classList.toggle("hidden", !showSaveButton);
  elements.providerApiKeyLabel.querySelector("span").textContent = `${label} API key`;
  elements.providerEndpointLabel.querySelector("span").textContent = `${label} endpoint URL`;
  elements.providerModelLabel.querySelector("span").textContent = `${label} model or deployment`;
  elements.providerApiKeyInput.placeholder = status.apiKeyConfigured
    ? "Saved; enter a new key to replace it"
    : `Stored for ${label} generation`;
  elements.providerEndpointInput.placeholder = status.defaultEndpointUrl || "Provider-compatible API endpoint";
  elements.providerEndpointInput.value = status.endpointUrl || "";
  elements.providerModelInput.value = status.modelId || "";
}

/** Formats provider configuration status for the account panel. */
function formatImageGenerationStatus(data) {
  const provider = data.provider || elements.imageProviderInput.value || "openai";
  const status = data.providers?.[provider] || getSelectedProviderStatus();
  const label = status.label || getImageProviderLabel(provider);
  if (status.configured) return `${label} is ready for image generation.`;
  if (status.requiresEndpoint && status.requiresApiKey) return `${label} needs an endpoint and API key.`;
  if (status.requiresEndpoint) return `${label} needs an endpoint.`;
  if (status.requiresApiKey) return `${label} needs an API key.`;
  return `${label} is selected.`;
}

function getImageProviderLabel(provider) {
  return imageProviderLabels[provider] || provider || "OpenAI";
}

/** Refreshes provider controls and status after the provider selection changes. */
function handleImageProviderChange() {
  const provider = rememberImageProvider(elements.imageProviderInput.value || "openai");
  state.imageProviderCredentialsExpanded = false;
  elements.imageProviderInput.value = provider;
  syncImageProviderSettingsUi();
  elements.imageGenerationStatus.textContent = formatImageGenerationStatus({
    provider,
    providers: state.imageGenerationSettings?.providers || {},
  });
}

/** Focuses the first visible credential setting control. */
function focusFirstVisibleProviderSetting() {
  const settings = [
    [elements.providerApiKeyLabel, elements.providerApiKeyInput],
    [elements.providerEndpointLabel, elements.providerEndpointInput],
    [elements.providerModelLabel, elements.providerModelInput],
  ];
  const visibleSetting = settings.find(([label]) => !label.classList.contains("hidden"));
  visibleSetting?.[1].focus();
}

/** Reveals hidden credential fields so saved provider settings can be replaced. */
function replaceProviderCredentials() {
  state.imageProviderCredentialsExpanded = true;
  syncImageProviderSettingsUi();
  elements.imageGenerationStatus.textContent = formatImageGenerationStatus({
    provider: elements.imageProviderInput.value || "openai",
    providers: state.imageGenerationSettings?.providers || {},
  });
  focusFirstVisibleProviderSetting();
}

/** Loads the signed-in user's image generation settings. */
async function refreshImageGenerationSettings() {
  if (!state.idToken) return;
  try {
    const data = await apiFetch("/settings/image-generation");
    const provider = getStoredImageProvider() || data.provider || "openai";
    state.imageGenerationSettings = data;
    state.imageProviderCredentialsExpanded = false;
    elements.imageProviderInput.value = provider;
    syncImageProviderSettingsUi();
    elements.imageGenerationStatus.textContent = formatImageGenerationStatus({ ...data, provider });
  } catch (error) {
    elements.imageGenerationStatus.textContent = error.message;
  }
}

/** Saves the selected provider's image generation settings. */
async function saveImageGenerationSettings() {
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
    state.imageProviderCredentialsExpanded = false;
    rememberImageProvider(data.provider || elements.imageProviderInput.value || "openai");
    elements.providerApiKeyInput.value = "";
    syncImageProviderSettingsUi();
    elements.imageGenerationStatus.textContent = formatImageGenerationStatus(data);
  } catch (error) {
    elements.imageGenerationStatus.textContent = error.message;
  }
}

/** Signs in and refreshes saved cards and sets. */
async function signIn() {
  try {
    const { email, password } = getCredentials();
    const data = await cognitoRequest("InitiateAuth", {
      ClientId: backendConfig.userPoolClientId,
      AuthFlow: "USER_PASSWORD_AUTH",
      AuthParameters: {
        USERNAME: email,
        PASSWORD: password,
      },
    });

    state.idToken = data.AuthenticationResult.IdToken;
    state.refreshToken = data.AuthenticationResult.RefreshToken || state.refreshToken;
    state.email = email;
    sessionStorage.setItem("cardDesignerIdToken", state.idToken);
    sessionStorage.setItem("cardDesignerRefreshToken", state.refreshToken);
    sessionStorage.setItem("cardDesignerEmail", state.email);
    elements.passwordInput.value = "";
    updateAccountUi();
    setAuthStatus(`Signed in as ${email}`);
    setSaveStatus("Loading saved designs...");
    await Promise.all([refreshSavedCards(), refreshCardSets(), refreshImageGenerationSettings()]);
    await setSharing.checkSetShareResponses();
    await setSharing.checkIncomingSetShares();
  } catch (error) {
    setAuthStatus(error.message);
  }
}

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

/** Refreshes the short-lived ID token using the Cognito refresh token. */
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

/** Clears local auth/session state and saved library state. */
function clearAuthSession() {
  state.idToken = "";
  state.refreshToken = "";
  state.email = "";
  state.currentCardId = "";
  state.savedCards = [];
  clearCardHistory();
  state.savedSets = [];
  state.imageGenerationSettings = null;
  state.imageProviderCredentialsExpanded = false;
  sessionStorage.removeItem("cardDesignerIdToken");
  sessionStorage.removeItem("cardDesignerRefreshToken");
  sessionStorage.removeItem("cardDesignerEmail");
  updateAccountUi();
  renderSavedCards();
  renderCardSets();
}

/** Handles the signOut workflow. */
function signOut() {
  clearAuthSession();
  setAuthStatus("Signed out");
  setSaveStatus("Sign in to save designs");
}

/** Calls the authenticated backend API and normalizes errors. */
async function apiFetch(path, options = {}) {
  if (!state.idToken || (isJwtExpired(state.idToken) && !(await refreshAuthSession()))) {
    clearAuthSession();
    throw new Error("Your session expired. Sign in again to load saved designs.");
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
    throw new Error("Your session expired. Sign in again to load saved designs.");
  }

  if (!response.ok) {
    throw new Error(data.error || `API request failed with ${response.status}.`);
  }

  return data;
}

/**
 * Fills a set dropdown while preserving its selected set when possible.
 * @param {*} select Dropdown element to populate.
 * @param {*} sets Available set records.
 * @param {*} selectedSetCode Preferred selected set code.
 */
function populateSetSelect(select, sets, selectedSetCode) {
  select.innerHTML = "";

  for (const cardSet of sets) {
    const option = document.createElement("option");
    option.value = cardSet.code || "DEFAULT";
    option.textContent = `${option.value} - ${cardSet.name || "Untitled Set"}`;
    select.append(option);
  }

  select.value = [...select.options].some((option) => option.value === selectedSetCode)
    ? selectedSetCode
    : "DEFAULT";
}

/** Renders both set dropdowns from the saved set list. */
function renderCardSets() {
  const selectedFilterSetCode = elements.cardSetsInput.value || "DEFAULT";
  const selectedDesignSetCode = elements.setInput.value || "DEFAULT";
  const sets = getAvailableSets();

  populateSetSelect(elements.cardSetsInput, sets, selectedFilterSetCode);
  populateSetSelect(elements.setInput, sets, selectedDesignSetCode);
  updateMakeSetPublicButton();
}

/** Loads the signed-in user's sets from the backend. */
async function refreshCardSets() {
  try {
    const data = await apiFetch("/sets");
    state.savedSets = data.sets || [];
    renderCardSets();
  } catch (error) {
    setSaveStatus(error.message);
  }
}

function clearSetDialog() {
  elements.setDialogForm.reset();
  elements.setPublicInput.checked = false;
  elements.setDialogStatus.textContent = "";
}

/** Opens the modal for defining a new set. */
function openSetDialog() {
  clearSetDialog();
  elements.setDialog.showModal();
  elements.setCodeInput.focus();
}

function closeSetDialog() {
  clearSetDialog();
  elements.setDialog.close();
}

/** Saves a new set and updates linked dropdowns. */
async function saveSet() {
  try {
    const code = elements.setCodeInput.value.trim().toUpperCase();
    const name = elements.setNameInput.value.trim();
    const symbol = elements.setSymbolInput.value.trim();
    const copyrightInfo = elements.setCopyrightInput.value.trim();
    const isPublic = elements.setPublicInput.checked;
    if (!code || !name) throw new Error("Enter a set code and name.");

    const data = await apiFetch("/sets", {
      method: "POST",
      body: JSON.stringify({ code, name, symbol, copyrightInfo, isPublic }),
    });
    const savedSetCode = data.set?.code || code;
    await refreshCardSets();
    elements.cardSetsInput.value = savedSetCode;
    elements.setInput.value = savedSetCode;
    renderSavedCards();
    closeSetDialog();
    setSaveStatus(`Set ${savedSetCode} saved`);
  } catch (error) {
    elements.setDialogStatus.textContent = error.message;
  }
}

/** Handles the getAvailableSets workflow. */
function getAvailableSets() {
  return state.savedSets.length
    ? state.savedSets
    : [{ code: "DEFAULT", name: "Default", symbol: "", copyrightInfo: "" }];
}

function getSetByCode(setCode) {
  const normalizedSetCode = setCode || "DEFAULT";
  return getAvailableSets().find((cardSet) => (cardSet.code || "DEFAULT") === normalizedSetCode);
}

function getSignedInUserId() {
  return getJwtPayload(state.idToken)?.sub || "";
}

function getPublicSetUrl(cardSet) {
  const userId = getSignedInUserId();
  if (!userId || !cardSet) return "";

  const publicUrl = new URL("public/", window.location.href);
  publicUrl.search = new URLSearchParams({
    user: userId,
    set: cardSet.code || "DEFAULT",
  }).toString();
  return publicUrl.toString();
}

function updatePublicSetLink(cardSet) {
  const publicUrl = cardSet?.isPublic ? getPublicSetUrl(cardSet) : "";
  elements.publicSetLinkLine.classList.toggle("hidden", !publicUrl);
  elements.publicSetLink.href = publicUrl || "#";
  elements.publicSetLink.textContent = publicUrl;
}

function updateMakeSetPublicButton() {
  const cardSet = getSetByCode(elements.cardSetsInput.value || "DEFAULT");
  const isPublic = Boolean(cardSet?.isPublic);
  elements.makeSetPublicButton.disabled = isPublic;
  elements.makeSetPublicButton.textContent = isPublic ? "This set is public" : "Make this set public";
  updatePublicSetLink(cardSet);
}

/** Marks a set public in DynamoDB and updates the local set list. */
async function makeSetPublic(setCode) {
  const normalizedSetCode = setCode || "DEFAULT";
  const data = await apiFetch(`/sets/${encodeURIComponent(normalizedSetCode)}/public`, { method: "PUT" });
  const updatedSet = data.set || {};
  state.savedSets = getAvailableSets().map((cardSet) => {
    if ((cardSet.code || "DEFAULT") !== (updatedSet.code || normalizedSetCode)) return cardSet;
    return { ...cardSet, ...updatedSet, isPublic: true };
  });
  renderCardSets();
  renderSetLibraryList();
  setSaveStatus(`${updatedSet.code || normalizedSetCode} is public`);
}

/** Makes the selected Card set dropdown value public. */
async function makeSelectedSetPublic() {
  try {
    const setCode = elements.cardSetsInput.value || "DEFAULT";
    const cardSet = getSetByCode(setCode);
    if (cardSet?.isPublic) return;
    elements.makeSetPublicButton.disabled = true;
    await makeSetPublic(setCode);
  } catch (error) {
    setSaveStatus(error.message);
    updateMakeSetPublicButton();
  }
}

/** Builds the symbol cell for a set library row. */
function renderSetSymbolPreview(cardSet) {
  const symbol = document.createElement("div");
  symbol.className = "set-symbol-preview";
  if (cardSet.symbol) {
    const image = document.createElement("img");
    image.alt = "";
    image.src = cardSet.symbol;
    image.addEventListener("error", () => {
      symbol.replaceChildren(document.createElement("span"));
    });
    symbol.append(image);
  } else {
    symbol.append(document.createElement("span"));
  }
  return symbol;
}

/** Creates the one-way public visibility checkbox for a set row. */
function createSetPublicCheckbox(cardSet) {
  const checkbox = document.createElement("input");
  const setCode = cardSet.code || "DEFAULT";
  checkbox.className = "set-public-checkbox";
  checkbox.type = "checkbox";
  checkbox.checked = Boolean(cardSet.isPublic);
  checkbox.disabled = checkbox.checked;
  checkbox.setAttribute("aria-label", `${cardSet.name || setCode} is public`);
  checkbox.addEventListener("click", (event) => {
    if (cardSet.isPublic) {
      event.preventDefault();
      checkbox.checked = true;
    }
  });
  checkbox.addEventListener("change", async () => {
    if (!checkbox.checked) {
      checkbox.checked = true;
      return;
    }

    checkbox.disabled = true;
    try {
      await makeSetPublic(setCode);
    } catch (error) {
      checkbox.disabled = false;
      checkbox.checked = false;
      elements.setLibraryStatus.textContent = error.message;
    }
  });
  return checkbox;
}

/** Creates the red trash button used to delete a set row. */
function createSetDeleteButton(cardSet) {
  const button = document.createElement("button");
  const setCode = cardSet.code || "DEFAULT";
  button.className = "set-delete-button";
  button.type = "button";
  button.disabled = setCode === "DEFAULT";
  button.setAttribute("aria-label", `Delete ${cardSet.name || setCode} set`);
  button.title = "Delete this set permanently";
  button.innerHTML = `<span class="trash-icon" aria-hidden="true"></span>`;
  button.addEventListener("click", () => promptDeleteSet(cardSet));
  return button;
}

/** Shows the set list view in the fullscreen library modal. */
function renderSetLibraryList() {
  elements.setLibraryTitle.textContent = "My Sets";
  elements.setLibraryBackButton.classList.add("hidden");
  elements.setLibraryStatus.textContent = "";
  elements.setLibraryContent.innerHTML = "";
  const list = document.createElement("div");
  list.className = "set-list";

  for (const cardSet of getAvailableSets()) {
    const row = document.createElement("div");
    row.className = "set-row";
    const code = cardSet.code || "DEFAULT";
    const codeLink = document.createElement("a");
    codeLink.href = "#";
    codeLink.textContent = code;
    codeLink.addEventListener("click", (event) => {
      event.preventDefault();
      renderSetCardGrid(code);
    });
    const name = document.createElement("strong");
    name.textContent = cardSet.name || "Untitled Set";
    row.append(createSetPublicCheckbox(cardSet), renderSetSymbolPreview(cardSet), codeLink, name, createSetDeleteButton(cardSet));
    list.append(row);
  }

  elements.setLibraryContent.append(list);
}

/** Asks for confirmation before deleting a set and its cards. */
function promptDeleteSet(cardSet) {
  const setCode = cardSet.code || "DEFAULT";
  if (setCode === "DEFAULT") {
    elements.setLibraryStatus.textContent = "The default set cannot be deleted.";
    return;
  }

  const setName = cardSet.name || setCode;
  elements.deleteSetTitle.textContent = `Are you sure you want to delete the \"${setName}\" set?`;
  elements.deleteSetMessage.textContent = "This action cannot be undone";
  elements.confirmDeleteSetButton.dataset.setCode = setCode;
  elements.deleteSetDialog.showModal();
}

/** Deletes a set, its cards, and then refreshes the library UI. */
async function deleteSet(setCode) {
  try {
    const resetDeletedEditorCard = elements.setInput.value === setCode;
    await apiFetch(`/sets/${encodeURIComponent(setCode)}`, { method: "DELETE" });
    if (elements.cardSetsInput.value === setCode) elements.cardSetsInput.value = "DEFAULT";
    await Promise.all([refreshCardSets(), refreshSavedCards()]);
    if (resetDeletedEditorCard) resetCard();
    renderSetLibraryList();
    syncCard();
    setSaveStatus(`Deleted ${setCode} set`);
  } catch (error) {
    elements.setLibraryStatus.textContent = error.message;
  }
}

/** Swaps a failed card thumbnail for an empty card frame. */
function replaceMissingLibraryImage(image, card) {
  const empty = document.createElement("div");
  empty.className = "library-card-empty";
  empty.textContent = card.name || "Untitled Card";
  (image.closest(".library-card-art-frame") || image).replaceWith(empty);
}

/** Builds a draggable card tile for the set grid. */
function createLibraryCardTile(card, setCode) {
  const tile = document.createElement("button");
  tile.className = "library-card-tile";
  tile.draggable = true;
  tile.type = "button";
  tile.dataset.cardId = card.cardId;
  tile.addEventListener("click", () => {
    if (state.libraryDragMoved) {
      state.libraryDragMoved = false;
      return;
    }
    loadCardFromLibrary(card.cardId);
  });
  tile.addEventListener("dragstart", (event) => {
    state.libraryDraggedCardId = card.cardId;
    state.libraryDragMoved = false;
    tile.classList.add("is-dragging");
    event.dataTransfer.effectAllowed = "move";
    event.dataTransfer.setData("text/plain", card.cardId);
  });
  tile.addEventListener("dragend", () => {
    state.libraryDraggedCardId = "";
    document.querySelectorAll(".library-card-tile").forEach((cardTile) => {
      cardTile.classList.remove("is-dragging", "is-drop-target");
    });
  });
  tile.addEventListener("dragover", (event) => {
    if (!state.libraryDraggedCardId || state.libraryDraggedCardId === card.cardId) return;
    event.preventDefault();
    tile.classList.add("is-drop-target");
  });
  tile.addEventListener("dragleave", () => tile.classList.remove("is-drop-target"));
  tile.addEventListener("drop", (event) => {
    event.preventDefault();
    tile.classList.remove("is-drop-target");
    reorderCardsInSet(setCode, state.libraryDraggedCardId, card.cardId);
  });

  if (card.imageUrl) {
    const frame = document.createElement("div");
    const image = document.createElement("img");
    frame.className = "library-card-art-frame";
    image.className = "library-card-art";
    image.alt = card.name || "Saved card";
    image.addEventListener("error", () => replaceMissingLibraryImage(image, card));
    image.src = card.imageUrl;
    frame.append(image);
    tile.append(frame);
  } else {
    const empty = document.createElement("div");
    empty.className = "library-card-empty";
    empty.textContent = card.name || "Untitled Card";
    tile.append(empty);
  }

  const label = document.createElement("span");
  label.className = "library-card-name";
  label.textContent = `${formatCollectorNumber(card.collectorNumber, setCode)} ${card.name || "Untitled Card"}`;
  tile.append(label);
  return tile;
}

/** Shows the cards in a selected set as a five-column grid. */
function renderSetCardGrid(setCode) {
  const cardSet = getAvailableSets().find((set) => (set.code || "DEFAULT") === setCode);
  const cards = getCardsInSet(setCode);
  elements.setLibraryTitle.textContent = cardSet ? `${cardSet.code} - ${cardSet.name || "Untitled Set"}` : setCode;
  elements.setLibraryBackButton.classList.remove("hidden");
  elements.setLibraryStatus.textContent = cards.length ? "" : "No saved cards in this set.";
  elements.setLibraryContent.innerHTML = "";

  const grid = document.createElement("div");
  grid.className = "card-library-grid";
  for (const card of cards) {
    grid.append(createLibraryCardTile(card, setCode));
  }

  elements.setLibraryContent.append(grid);
}

/**
 * Persists drag-and-drop card order and collector numbers for a set.
 * @param {*} setCode Set whose cards are being reordered.
 * @param {*} draggedCardId Card id moved by drag/drop.
 * @param {*} targetCardId Card id where the dragged card was dropped.
 */
async function reorderCardsInSet(setCode, draggedCardId, targetCardId) {
  if (!draggedCardId || draggedCardId === targetCardId) return;
  const cards = getCardsInSet(setCode);
  const previousCollectorNumbers = new Map(
    cards.map((card) => [card.cardId, normalizeCollectorNumber(card.collectorNumber)]),
  );
  const draggedIndex = cards.findIndex((card) => card.cardId === draggedCardId);
  const targetIndex = cards.findIndex((card) => card.cardId === targetCardId);
  if (draggedIndex < 0 || targetIndex < 0) return;

  const [draggedCard] = cards.splice(draggedIndex, 1);
  cards.splice(targetIndex, 0, draggedCard);
  cards.forEach((card, index) => {
    card.collectorNumber = index + 1;
  });
  state.libraryDragMoved = true;
  renderSetCardGrid(setCode);

  try {
    const data = await apiFetch(`/sets/${encodeURIComponent(setCode)}/cards/reorder`, {
      method: "POST",
      body: JSON.stringify({ cardIds: cards.map((card) => card.cardId) }),
    });
    for (const updatedCard of data.cards || []) {
      const savedCard = state.savedCards.find((card) => card.cardId === updatedCard.cardId);
      if (savedCard) Object.assign(savedCard, updatedCard);
    }
    const cardsNeedingImageRegeneration = cards.filter(
      (card) => previousCollectorNumbers.get(card.cardId) !== normalizeCollectorNumber(card.collectorNumber),
    );
    await regenerateCardImages(cardsNeedingImageRegeneration, getSetTotal(setCode));
    renderSavedCards();
    renderSetCardGrid(setCode);
    syncCard();
    setSaveStatus("Collector order saved");
  } catch (error) {
    setSaveStatus(error.message);
    await refreshSavedCards();
    renderSetCardGrid(setCode);
  }
}

/** Opens the dedicated My Sets page. */
function openSetLibrary() {
  window.location.href = new URL("sets/", window.location.href).toString();
}

function closeSetLibrary() {
  elements.setLibraryDialog.close();
}

/** Loads a clicked library card into the editor. */
async function loadCardFromLibrary(cardId) {
  try {
    elements.savedCardsInput.value = cardId;
    const cardSummary = state.savedCards.find((card) => card.cardId === cardId);
    if (cardSummary) elements.cardSetsInput.value = cardSummary.setCode || "DEFAULT";
    closeSetLibrary();
    const data = await apiFetch(`/cards/${cardId}`);
    applyCardData(data.card);
    await refreshCardHistory(data.card.cardId, 3);
    setSaveStatus("Loaded design");
  } catch (error) {
    setSaveStatus(error.message);
  }
}

/** Loads a card requested by the URL query string, then clears the query. */
async function loadRequestedCardFromUrl() {
  const url = new URL(window.location.href);
  const cardId = url.searchParams.get("card") || "";
  if (!cardId || !state.idToken) return;

  try {
    const data = await apiFetch(`/cards/${encodeURIComponent(cardId)}`);
    applyCardData(data.card);
    await refreshCardHistory(data.card.cardId, 3);
    setSaveStatus("Loaded design");
    url.searchParams.delete("card");
    window.history.replaceState({}, "", url);
  } catch (error) {
    setSaveStatus(error.message);
  }
}

/** Renders the saved-card dropdown for the currently selected set. */
function renderSavedCards() {
  const selectedCardId = elements.savedCardsInput.value;
  const selectedSetCode = elements.cardSetsInput.value || "DEFAULT";
  const cardsInSet = getCardsInSet(selectedSetCode);
  elements.savedCardsInput.innerHTML = "";

  if (!state.savedCards.length) {
    const option = document.createElement("option");
    option.value = "";
    option.textContent = state.idToken ? "No saved cards yet" : "Sign in to load cards";
    elements.savedCardsInput.append(option);
    return;
  }

  if (!cardsInSet.length) {
    const option = document.createElement("option");
    option.value = "";
    option.textContent = "No saved cards in this set";
    elements.savedCardsInput.append(option);
    return;
  }

  for (const card of cardsInSet) {
    const option = document.createElement("option");
    option.value = card.cardId;
    option.textContent = `${card.name || "Untitled Card"} (${formatCollectorNumber(card.collectorNumber, selectedSetCode)})`;
    elements.savedCardsInput.append(option);
  }

  if (cardsInSet.some((card) => card.cardId === selectedCardId)) {
    elements.savedCardsInput.value = selectedCardId;
  }
}

function normalizeCardName(name) {
  return String(name || "").trim().replace(/\s+/g, " ").toLowerCase();
}

function findSavedCardByName(name) {
  const normalizedName = normalizeCardName(name);
  return state.savedCards.find((card) => normalizeCardName(card.name) === normalizedName);
}

/** Asks how to handle saving a card with a duplicate name. */
function promptDuplicateSave(cardName, existingCard) {
  if (!elements.duplicateSaveDialog) return Promise.resolve("save-new");

  elements.duplicateSaveMessage.textContent = `"${cardName}" already exists in your saved cards.`;

  return new Promise((resolve) => {
    const handleClose = () => {
      elements.duplicateSaveDialog.removeEventListener("close", handleClose);
      resolve(elements.duplicateSaveDialog.returnValue || "cancel");
    };

    elements.duplicateSaveDialog.addEventListener("close", handleClose);
    elements.duplicateSaveDialog.dataset.cardId = existingCard.cardId;
    elements.duplicateSaveDialog.showModal();
  });
}

/** Loads saved card summaries for the signed-in user. */
async function refreshSavedCards() {
  try {
    const data = await apiFetch("/cards");
    state.savedCards = data.cards || [];
    renderSavedCards();
    setSaveStatus(state.savedCards.length ? "Saved designs loaded" : "No saved designs yet");
  } catch (error) {
    setSaveStatus(error.message);
  }
}

/** Asks whether uploaded file art should be saved to the art library. */
function promptSaveArt() {
  if (!elements.saveArtDialog) return Promise.resolve(false);
  return new Promise((resolve) => {
    const handleClose = () => {
      elements.saveArtDialog.removeEventListener("close", handleClose);
      resolve(elements.saveArtDialog.returnValue === "yes");
    };
    elements.saveArtDialog.addEventListener("close", handleClose);
    elements.saveArtDialog.showModal();
  });
}

/** Uploads selected file art and swaps the editor to the returned app URL. */
async function savePendingArtForLater() {
  if (!state.pendingArtUpload) return;
  const shouldSaveArt = await promptSaveArt();
  if (!shouldSaveArt) return;

  const data = await apiFetch("/art", {
    method: "POST",
    body: JSON.stringify({
      artImage: state.pendingArtUpload.dataUrl,
      cardName: elements.nameInput.value.trim() || "Untitled Card",
      setCode: elements.setInput.value || "DEFAULT",
    }),
  });
  const artUrl = data.artUrl?.startsWith("http") ? data.artUrl : `${backendConfig.apiUrl}${data.artUrl}`;
  state.pendingArtUpload = null;
  elements.artUrlInput.value = artUrl;
  await setArtSource(artUrl, "Art saved for later");
}

/** Aligns the preview art with the Image URL field before saving. */
async function syncArtInputBeforeSave() {
  const typedArtUrl = elements.artUrlInput.value.trim();
  const currentArtUrl = String(state.artUrl || "").trim();
  if (typedArtUrl && typedArtUrl !== currentArtUrl) {
    elements.artInput.value = "";
    state.pendingArtUpload = null;
    await setArtSource(typedArtUrl);
    return;
  }

  if (!typedArtUrl && !state.pendingArtUpload && currentArtUrl && !currentArtUrl.startsWith("data:")) {
    clearArt();
  }
}

/** Clears editable art from the current card and saves the update. */
async function deleteCurrentCardArt() {
  const cardId = state.currentCardId || elements.savedCardsInput.value;
  if (!cardId) {
    setSaveStatus("Load a saved card before deleting art.");
    return;
  }

  elements.artUrlInput.value = "";
  elements.artInput.value = "";
  state.pendingArtUpload = null;
  clearArt();
  syncCard();
  await saveCard(cardId);
}

/** Saves or updates a card and uploads its rendered PNG. */
async function saveCard(cardId = "") {
  try {
    if (state.pendingArtLoad) await state.pendingArtLoad;
    await savePendingArtForLater();
    await syncArtInputBeforeSave();
    const card = collectCardData();
    card.cardImagePng = await getCardPngDataUrl();
    const data = await apiFetch(cardId ? `/cards/${cardId}` : "/cards", {
      method: cardId ? "PUT" : "POST",
      body: JSON.stringify(card),
    });
    state.currentCardId = data.card.cardId;
    elements.cardSetsInput.value = data.card.setCode || card.setCode || "DEFAULT";
    const imageStatus = data.card.imageKey ? " and uploaded PNG" : "";
    setSaveStatus(cardId ? `Saved changes${imageStatus}` : `Saved new design${imageStatus}`);
    await Promise.all([refreshSavedCards(), refreshCardSets()]);
    if (!cardId) {
      const cardsToRegenerate = getCardsInSet(data.card.setCode || card.setCode)
        .filter((savedCard) => savedCard.cardId !== state.currentCardId);
      try {
        await regenerateCardImages(cardsToRegenerate, getSetTotal(data.card.setCode || card.setCode));
      } catch (error) {
        setSaveStatus(`Saved new design${imageStatus}, but existing card images could not be regenerated: ${error.message}`);
      }
    }
    elements.savedCardsInput.value = state.currentCardId;
    await refreshCardHistory(state.currentCardId, 3);
  } catch (error) {
    setSaveStatus(error.message);
  }
}

/** Handles Save New, including duplicate-name decisions. */
async function saveNewCard() {
  const cardName = elements.nameInput.value.trim() || "Untitled Card";
  const existingCard = findSavedCardByName(cardName);

  if (existingCard) {
    const choice = await promptDuplicateSave(cardName, existingCard);
    if (choice === "update") {
      await saveCard(existingCard.cardId);
      return;
    }
    if (choice !== "save-new") return;
  }

  await saveCard();
}
/** Loads the selected saved-card dropdown item into the editor. */
async function loadSelectedCard() {
  try {
    const cardId = elements.savedCardsInput.value;
    if (!cardId) throw new Error("Choose a saved card first.");

    const data = await apiFetch(`/cards/${cardId}`);
    applyCardData(data.card);
    await refreshCardHistory(data.card.cardId, 3);
    setSaveStatus("Loaded design");
  } catch (error) {
    setSaveStatus(error.message);
  }
}

/** Deletes the selected saved card after confirmation. */
async function deleteSelectedCard() {
  try {
    const cardId = elements.savedCardsInput.value;
    if (!cardId) throw new Error("Choose a saved card first.");
    if (!window.confirm("Delete this saved design?")) return;

    await apiFetch(`/cards/${cardId}`, { method: "DELETE" });
    if (state.currentCardId === cardId) {
      state.currentCardId = "";
      clearCardHistory();
    }
    setSaveStatus("Deleted design");
    await Promise.all([refreshSavedCards(), refreshCardSets()]);
  } catch (error) {
    setSaveStatus(error.message);
  }
}

/** Waits for the hidden card renderer used by image-only updates. */
async function getCardRendererWindow() {
  if (!state.cardRendererReadyPromise) {
    state.cardRendererReadyPromise = new Promise((resolve, reject) => {
      const frame = elements.cardRenderFrame;
      if (!frame) {
        reject(new Error("Card renderer is unavailable."));
        return;
      }

      const finishLoading = async () => {
        try {
          const renderer = frame.contentWindow;
          if (!renderer) throw new Error("Card renderer is unavailable.");
          if (renderer.cardDesignerReady) await renderer.cardDesignerReady;
          if (!renderer.applyCardData || !renderer.getCardPngDataUrl || !renderer.setArtSource || !renderer.setCardRenderTotal) {
            throw new Error("Card renderer did not finish loading.");
          }
          resolve(renderer);
        } catch (error) {
          reject(error);
        }
      };

      frame.addEventListener("load", finishLoading, { once: true });
      frame.addEventListener("error", () => reject(new Error("Card renderer failed to load.")), { once: true });
      if (!frame.getAttribute("src")) frame.src = "?render=card";
    });
  }

  return state.cardRendererReadyPromise;
}

/** Returns current preview CSS variables so the SVG snapshot inherits live colors. */
function getSnapshotCssVariables() {
  const rootStyle = getComputedStyle(document.documentElement);
  return ["--accent", "--card-ratio", "--card-text", "--frame", "--panel", "--rarity-color"]
    .map((name) => `${name}: ${rootStyle.getPropertyValue(name).trim()};`)
    .join(" ");
}

/** Copies resolved browser styles from the live preview into its clone. */
function inlineSnapshotStyles(source, target) {
  const sourceElements = [source, ...source.querySelectorAll("*")];
  const targetElements = [target, ...target.querySelectorAll("*")];
  sourceElements.forEach((sourceElement, index) => {
    const targetElement = targetElements[index];
    if (!targetElement) return;

    const computedStyle = getComputedStyle(sourceElement);
    const inlineStyle = [...computedStyle]
      .map((property) => `${property}: ${computedStyle.getPropertyValue(property)};`)
      .join(" ");
    targetElement.setAttribute("style", `${targetElement.getAttribute("style") || ""}; ${inlineStyle}`);
  });
}

/** Reads a Blob or fetched image response into a data URL. */
function readBlobAsDataUrl(blob) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.addEventListener("load", () => resolve(reader.result));
    reader.addEventListener("error", () => reject(new Error("Image could not be embedded in the PNG.")));
    reader.readAsDataURL(blob);
  });
}

/** Converts an image source to an embeddable data URL for SVG snapshotting. */
async function getEmbeddableImageSource(src) {
  if (!src || src.startsWith("data:")) return src;

  const response = await fetch(src);
  if (!response.ok) throw new Error("Image could not be embedded in the PNG.");
  const blob = await response.blob();
  if (!blob.type.startsWith("image/")) throw new Error("Image URL did not return an image.");
  return readBlobAsDataUrl(blob);
}

/** Embeds preview images in a cloned card before serializing it to SVG. */
async function embedSnapshotImages(cardClone) {
  const originalImages = [...elements.card.querySelectorAll("img")];
  const clonedImages = [...cardClone.querySelectorAll("img")];
  await Promise.all(clonedImages.map(async (image, index) => {
    const originalImage = originalImages[index];
    const source = originalImage?.currentSrc || originalImage?.src || image.src;
    if (!source) return;
    image.setAttribute("src", await getEmbeddableImageSource(source));
  }));
}

/** Flattens transparent PNG regions onto the current card frame color. */
function flattenCardCanvas(canvas) {
  const flattenedCanvas = document.createElement("canvas");
  flattenedCanvas.width = canvas.width;
  flattenedCanvas.height = canvas.height;
  const ctx = flattenedCanvas.getContext("2d");
  ctx.fillStyle = elements.frameColor.value || "#263a31";
  ctx.fillRect(0, 0, flattenedCanvas.width, flattenedCanvas.height);
  ctx.drawImage(canvas, 0, 0);
  return flattenedCanvas;
}

/** Waits for updated card layout to reach the browser's paint pipeline. */
function waitForRenderPaint() {
  return new Promise((resolve) => {
    const timeoutId = window.setTimeout(resolve, 250);
    window.requestAnimationFrame(() => {
      window.requestAnimationFrame(() => {
        window.clearTimeout(timeoutId);
        resolve();
      });
    });
  });
}

/** Renders the actual preview DOM to a canvas so PNG output matches the card. */
async function createCardCanvas(scale = 3) {
  syncCard();
  if (elements.art.src && !elements.art.complete) {
    await elements.art.decode().catch(() => {});
  }
  if (document.fonts?.ready) await document.fonts.ready;
  await waitForRenderPaint();

  if (window.html2canvas) {
    const canvas = await window.html2canvas(elements.card, {
      allowTaint: false,
      backgroundColor: null,
      logging: false,
      scale,
      useCORS: true,
    });
    return flattenCardCanvas(canvas);
  }

  const bounds = elements.card.getBoundingClientRect();
  const width = Math.ceil(bounds.width);
  const height = Math.ceil(bounds.height);
  const cardClone = elements.card.cloneNode(true);
  inlineSnapshotStyles(elements.card, cardClone);
  cardClone.style.height = `${height}px`;
  cardClone.style.width = `${width}px`;
  await embedSnapshotImages(cardClone);

  const snapshot = document.createElement("div");
  snapshot.setAttribute("xmlns", "http://www.w3.org/1999/xhtml");
  snapshot.setAttribute("style", `${getSnapshotCssVariables()} width: ${width}px; height: ${height}px;`);
  snapshot.append(cardClone);

  const serializedSnapshot = new XMLSerializer().serializeToString(snapshot);
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}"><foreignObject width="100%" height="100%">${serializedSnapshot}</foreignObject></svg>`;
  const image = new Image();
  const imageUrl = URL.createObjectURL(new Blob([svg], { type: "image/svg+xml;charset=utf-8" }));

  try {
    image.src = imageUrl;
    await image.decode();
    const canvas = document.createElement("canvas");
    canvas.width = width * scale;
    canvas.height = height * scale;
    const ctx = canvas.getContext("2d");
    ctx.scale(scale, scale);
    ctx.drawImage(image, 0, 0, width, height);
    return flattenCardCanvas(canvas);
  } finally {
    URL.revokeObjectURL(imageUrl);
  }
}

/** Creates the PNG data URL sent to the backend. */
async function getCardPngDataUrl() {
  const canvas = await createCardCanvas(2);
  try {
    return canvas.toDataURL("image/png");
  } catch (error) {
    throw new Error(error.message || "Card image could not be saved.");
  }
}

/** Sets or clears the total used by the dedicated card-render workspace. */
function setCardRenderTotal(setTotal) {
  const normalizedTotal = Number(setTotal);
  state.renderSetTotal = Number.isFinite(normalizedTotal) && normalizedTotal > 0 ? normalizedTotal : null;
}

/** Renders a complete card PNG through the hidden designer workspace. */
async function renderUpdatedCardPng(card, setTotal) {
  const renderer = await getCardRendererWindow();
  renderer.setCardRenderTotal(setTotal);
  try {
    renderer.applyCardData({ ...card, artUrl: "" });
    if (card.artUrl) await renderer.setArtSource(card.artUrl);
    renderer.syncCard();
    return renderer.getCardPngDataUrl();
  } finally {
    renderer.setCardRenderTotal(null);
  }
}

/** Regenerates complete saved-card images after collector data changes. */
async function regenerateCardImages(cards, setTotal) {
  return window.cardImageTools.regenerateCardImages({
    cards,
    apiFetch,
    onProgress: setSaveStatus,
    renderCardPng: renderUpdatedCardPng,
    setTotal,
  });
}

/** Downloads the current card front as a PNG. */
async function exportPng() {
  try {
    const canvas = await createCardCanvas(3);
    const link = document.createElement("a");
    link.download = `${(elements.nameInput.value || "card").trim().replace(/\W+/g, "-").toLowerCase()}-front.png`;
    link.href = canvas.toDataURL("image/png");
    link.click();
  } catch (error) {
    setSaveStatus(`PNG export failed: ${error.message}`);
  }
}

/** Registers UI event handlers for the app. */
function attachEvents() {
  document.querySelectorAll("input, textarea, select").forEach((control) => {
    control.addEventListener("input", syncCard);
  });

  elements.generateImageButton.addEventListener("click", generateImage);
  elements.artInput.addEventListener("change", loadArt);
  elements.artUrlInput.addEventListener("change", loadArtUrl);
  elements.deleteArtButton.addEventListener("click", deleteCurrentCardArt);
  elements.viewAllCardHistoryButton.addEventListener("click", openCardHistoryDialog);
  elements.cardSetsInput.addEventListener("change", () => {
    renderSavedCards();
    updateMakeSetPublicButton();
  });
  elements.makeSetPublicButton.addEventListener("click", makeSelectedSetPublic);
  elements.setInput.addEventListener("change", () => {
    elements.collectorInput.value = getNextCollectorNumber(elements.setInput.value || "DEFAULT");
    syncCard();
  });
  elements.addSetButton.addEventListener("click", openSetDialog);
  elements.viewSetsButton.addEventListener("click", openSetLibrary);
  elements.setLibraryBackButton.addEventListener("click", renderSetLibraryList);
  elements.setLibraryCloseButton.addEventListener("click", closeSetLibrary);
  elements.deleteSetDialog.addEventListener("close", () => {
    if (elements.deleteSetDialog.returnValue === "delete") {
      deleteSet(elements.confirmDeleteSetButton.dataset.setCode);
    }
    elements.confirmDeleteSetButton.dataset.setCode = "";
  });
  elements.cancelSetButton.addEventListener("click", closeSetDialog);
  elements.saveSetButton.addEventListener("click", saveSet);
  elements.setDialogForm.addEventListener("submit", (event) => {
    event.preventDefault();
    saveSet();
  });
  elements.setDialog.addEventListener("close", clearSetDialog);
  elements.resetCard.addEventListener("click", resetCard);
  elements.exportPng.addEventListener("click", () => exportPng());
  elements.signUpButton.addEventListener("click", signUp);
  elements.confirmButton.addEventListener("click", confirmAccount);
  elements.signInButton.addEventListener("click", signIn);
  elements.imageProviderInput.addEventListener("change", handleImageProviderChange);
  elements.replaceProviderCredentialsButton.addEventListener("click", replaceProviderCredentials);
  elements.saveImageGenerationSettingsButton.addEventListener("click", saveImageGenerationSettings);
  elements.accountMenuButton.addEventListener("click", toggleAccountMenu);
  elements.signOutButton.addEventListener("click", signOut);
  setSharing.attachEvents();
  document.addEventListener("click", (event) => {
    if (!elements.signedInPanel.contains(event.target)) closeAccountMenu();
  });
  elements.saveNewButton.addEventListener("click", saveNewCard);
  elements.updateSavedButton.addEventListener("click", () => {
    const cardId = state.currentCardId || elements.savedCardsInput.value;
    if (!cardId) {
      setSaveStatus("Load a saved card or use Save New first.");
      return;
    }
    saveCard(cardId);
  });
  elements.loadSavedButton.addEventListener("click", loadSelectedCard);
  elements.deleteSavedButton.addEventListener("click", deleteSelectedCard);
  window.addEventListener("resize", () => {
    fitCardName();
    fitRulesText();
    rememberCardRenderProfile();
  });
}

/** Loads defaults and starts the app. */
async function initialize() {
  try {
    await Promise.all([loadCardDefaults(), loadCardTypes(), loadRarityInfo()]);
  } catch (error) {
    setSaveStatus(error.message);
  }

  if (defaults.name) resetCard();
  attachEvents();
  applyCardRenderProfile();
  syncCard();
  if (!isRenderWorkspace) rememberCardRenderProfile();
  renderSavedCards();
  renderCardSets();
  renderCardHistory();
  updateAccountUi();
  if (state.refreshToken && (!state.idToken || isJwtExpired(state.idToken))) {
    await refreshAuthSession();
  }
  if (state.idToken && !isJwtExpired(state.idToken)) {
    setAuthStatus(state.email ? `Signed in as ${state.email}` : "Signed in from this tab session");
    await Promise.all([refreshImageGenerationSettings(), refreshSavedCards(), refreshCardSets()]);
    if (!isRenderWorkspace) {
      await setSharing.checkSetShareResponses();
      await setSharing.checkIncomingSetShares();
      await loadRequestedCardFromUrl();
    }
  } else if (sessionStorage.getItem("cardDesignerIdToken") || sessionStorage.getItem("cardDesignerRefreshToken")) {
    clearAuthSession();
    setAuthStatus("Your session expired. Sign in again.");
  }
}

window.cardDesignerReady = initialize();
