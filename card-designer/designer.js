const backendConfig = window.backendConfig;

let defaults = {};
let rarityColors = {};
let rarityLabels = {};

const imageProviderStorageKey = "cardDesignerImageProvider";
const pageParams = new URLSearchParams(window.location.search);
const isRenderWorkspace = pageParams.get("render") === "card";
const isNewCardRequest = pageParams.get("new") === "card";
const cardRenderProfileStorageKey = "cardDesignerRenderProfile";
const lastLoadedCardStoragePrefix = "cardDesignerLastLoaded";

const cardHistoryFieldLabels = {
  name: "Name",
  artUrl: "Art",
  artFit: "Art fit",
  frameUrl: "Card frame",
  frameFit: "Background fit",
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
  templateId: "Template",
  templateName: "Template name",
  templateSections: "Template fields",
  templateCustomFields: "Custom template fields",
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

/** Builds a user-scoped key for the last loaded set and card. */
function getLastLoadedCardStorageKey() {
  const userKey = String(state.email || getJwtPayload(state.idToken)?.email || "guest")
    .trim()
    .toLowerCase();
  return `${lastLoadedCardStoragePrefix}:${userKey || "guest"}`;
}

/** Reads the last loaded set/card selection for the current signed-in user. */
function getLastLoadedCardSelection() {
  try {
    const selection = JSON.parse(localStorage.getItem(getLastLoadedCardStorageKey()) || "{}");
    return {
      setCode: selection.setCode || "DEFAULT",
      cardId: selection.cardId || "",
    };
  } catch (error) {
    return { setCode: "DEFAULT", cardId: "" };
  }
}

/** Stores the latest set/card selection without affecting hidden render workspaces. */
function rememberLastLoadedCardSelection(setCode = "DEFAULT", cardId = "") {
  if (isRenderWorkspace) return;

  try {
    localStorage.setItem(getLastLoadedCardStorageKey(), JSON.stringify({ setCode, cardId }));
  } catch (error) {
    // Storage can be unavailable in private or locked-down browser modes.
  }
}

/** Clears the one-time new-card route flag after an existing card is loaded. */
function clearNewCardRequest() {
  if (!isNewCardRequest || isRenderWorkspace) return;

  const url = new URL(window.location.href);
  url.searchParams.delete('new');
  window.history.replaceState({}, '', url);
}

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
  templates: [],
  currentTemplateId: "",
  currentTemplateName: "",
  templateSections: [],
  templateCustomFields: [],
  customFieldObjectUrls: [],
  customFieldPreviewToken: 0,
  customFieldImageLoad: Promise.resolve(),
  setSymbolMaskSource: "",
  setSymbolMaskDataUrl: "",
  setSymbolMaskLoadToken: 0,
  setSymbolMaskLoad: Promise.resolve(),
  artObjectUrl: "",
  artUrl: "",
  pendingArtUpload: null,
  pendingArtLoad: null,
  frameObjectUrl: "",
  frameUrl: "",
  pendingFrameUpload: null,
  pendingFrameLoad: null,
  previewTouchStart: null,
  libraryDraggedCardId: "",
  libraryDragMoved: false,
  cardRendererReadyPromise: null,
  imageGenerationSettings: null,
  renderSetTotal: null,
  imageProviderCredentialsExpanded: false,
  cardNavigationPending: false,
  currentCardSnapshot: "",
};

const elements = {
  card: document.querySelector("#card"),
  cardFrameImage: document.querySelector("#cardFrameImage"),
  cardCustomFieldPreview: document.querySelector("#cardCustomFieldPreview"),
  cardRenderFrame: document.querySelector("#cardRenderFrame"),
  previewStage: document.querySelector(".preview-stage"),
  previousCardButton: document.querySelector("#previousCardButton"),
  nextCardButton: document.querySelector("#nextCardButton"),
  artWindow: document.querySelector(".art-window"),
  art: document.querySelector("#cardArt"),
  rulesPanel: document.querySelector(".rules-panel"),
  cardName: document.querySelector("#cardName"),
  cardType: document.querySelector("#cardType"),
  cardTypeValue: document.querySelector("#cardTypeValue"),
  cardTypeSeparator: document.querySelector("#cardTypeSeparator"),
  cardSubtypeValue: document.querySelector("#cardSubtypeValue"),
  cardSubtypeText: document.querySelector("#cardSubtypeText"),
  cardCost: document.querySelector("#cardCost"),
  cardAttack: document.querySelector("#cardAttack"),
  cardHealth: document.querySelector("#cardHealth"),
  cardLoyalty: document.querySelector("#cardLoyalty"),
  combatStats: document.querySelector("#combatStats"),
  attackStat: document.querySelector("#attackStat"),
  healthStat: document.querySelector("#healthStat"),
  loyaltyStat: document.querySelector("#loyaltyStat"),
  cardAbility: document.querySelector("#cardAbility"),
  cardFlavor: document.querySelector("#cardFlavor"),
  cardArtist: document.querySelector("#cardArtist"),
  cardCollector: document.querySelector("#cardCollector"),
  cardRarity: document.querySelector("#cardRarity"),
  setSymbol: document.querySelector("#setSymbol"),
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
  frameInput: document.querySelector("#frameInput"),
  frameUrlInput: document.querySelector("#frameUrlInput"),
  deleteFrameButton: document.querySelector("#deleteFrameButton"),
  frameFitInput: document.querySelector("#frameFitInput"),
  frameColor: document.querySelector("#frameColor"),
  accentColor: document.querySelector("#accentColor"),
  textColor: document.querySelector("#textColor"),
  panelColor: document.querySelector("#panelColor"),
  recentCardHistoryRows: document.querySelector("#recentCardHistoryRows"),
  allCardHistoryRows: document.querySelector("#allCardHistoryRows"),
  viewAllCardHistoryButton: document.querySelector("#viewAllCardHistoryButton"),
  cardHistoryDialog: document.querySelector("#cardHistoryDialog"),
  cardHistorySubtitle: document.querySelector("#cardHistorySubtitle"),
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
  templatesPanel: document.querySelector("#templatesPanel"),
  viewSetTemplatesButton: document.querySelector("#viewSetTemplatesButton"),
  cardTemplatesInput: document.querySelector("#cardTemplatesInput"),
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
  templateStatInputs: document.querySelector("#templateStatInputs"),
  templateCustomFieldsPanel: document.querySelector("#templateCustomFieldsPanel"),
  templateCustomFields: document.querySelector("#templateCustomFields"),
  signUpButton: document.querySelector("#signUpButton"),
  cancelSignUpButton: document.querySelector("#cancelSignUpButton"),
  signUpStatus: document.querySelector("#signUpStatus"),
  confirmButton: document.querySelector("#confirmButton"),
  signInButton: document.querySelector("#signInButton"),
  signOutButton: document.querySelector("#signOutButton"),
  saveNewButton: document.querySelector("#saveNewButton"),
  updateSavedButton: document.querySelector("#updateSavedButton"),
  loadSavedButton: document.querySelector("#loadSavedButton"),
  deleteSavedButton: document.querySelector("#deleteSavedButton"),
  resetCard: document.querySelector("#resetCard"),
  homeButton: document.querySelector("#homeButton"),
  exportPng: document.querySelector("#exportPng"),
  duplicateSaveDialog: document.querySelector("#duplicateSaveDialog"),
  duplicateSaveForm: document.querySelector("#duplicateSaveForm"),
  duplicateSaveMessage: document.querySelector("#duplicateSaveMessage"),
  duplicateUpdateButton: document.querySelector("#duplicateUpdateButton"),
  duplicateSaveAsButton: document.querySelector("#duplicateSaveAsButton"),
  duplicateCancelButton: document.querySelector("#duplicateCancelButton"),
  duplicateNewNameFields: document.querySelector("#duplicateNewNameFields"),
  duplicateNewNameInput: document.querySelector("#duplicateNewNameInput"),
  duplicateNewNameStatus: document.querySelector("#duplicateNewNameStatus"),
  duplicateConfirmNewNameButton: document.querySelector("#duplicateConfirmNewNameButton"),
  unsavedChangesDialog: document.querySelector("#unsavedChangesDialog"),
  unsavedChangesMessage: document.querySelector("#unsavedChangesMessage"),
  deleteSetDialog: document.querySelector("#deleteSetDialog"),
  deleteSetTitle: document.querySelector("#deleteSetTitle"),
  deleteSetMessage: document.querySelector("#deleteSetMessage"),
  confirmDeleteSetButton: document.querySelector("#confirmDeleteSetButton"),
  saveArtDialog: document.querySelector("#saveArtDialog"),
  saveFrameDialog: document.querySelector("#saveFrameDialog"),
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

const accountAuth = new AccountAuthController({
  backendConfig,
  state,
  elements,
  renderAuthUi: updateAccountUi,
  setAuthStatus,
  onSignedIn: async () => {
    setSaveStatus("Loading saved designs...");
    await Promise.all([refreshImageGenerationSettings(), refreshSavedCards(), refreshCardSets(), refreshCardTemplates()]);
    if (!isNewCardRequest) await restoreLastLoadedCardSelection();
    await setSharing.checkSetShareResponses();
    await setSharing.checkIncomingSetShares();
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
  const response = await fetch("../defaults/card-defaults.json");
  if (!response.ok) throw new Error("Card defaults failed to load.");

  defaults = await response.json();
}

/** Loads rarity labels and colors used by the preview. */
async function loadRarityInfo() {
  const response = await fetch("../defaults/rarity-info.json");
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

/** Renders rules text line breaks and parenthetical emphasis.
 * @param {*} target Element that receives the rendered rules text.
 * @param {*} value Rules text entered by the user.
 * @param {*} fallback Text to render when the rules field is empty.
 */
function updateRulesText(target, value, fallback) {
  const text = String(value || "").trim() || fallback;
  target.replaceChildren();
  if (!text) return;

  for (const line of text.split(/\r?\n/)) {
    const lineElement = document.createElement("span");
    lineElement.className = "card-text-line";
    appendRuleTextWithParentheses(lineElement, line);
    target.append(lineElement);
  }
}

/** Appends one rules line while italicizing parenthetical text. */
function appendRuleTextWithParentheses(lineElement, line) {
  if (!line) {
    lineElement.textContent = "\u00a0";
    return;
  }

  const parentheticalPattern = /\(([^)]*)\)/g;
  let cursor = 0;
  let match = parentheticalPattern.exec(line);
  while (match) {
    lineElement.append(document.createTextNode(line.slice(cursor, match.index)));
    const emphasis = document.createElement("em");
    emphasis.textContent = match[0];
    lineElement.append(emphasis);
    cursor = match.index + match[0].length;
    match = parentheticalPattern.exec(line);
  }

  lineElement.append(document.createTextNode(line.slice(cursor)));
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
  elements.templatesPanel.classList.toggle("hidden", !signedIn);
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
    state.templates = [];
    renderCardTemplates();
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
  const response = await fetch("../defaults/card-types.json");
  if (!response.ok) throw new Error("Card type defaults failed to load.");

  standardTypes = await response.json();
}

function syncTypeMode() {
  const isCustom = elements.typeInput.value === "__custom";
  elements.customTypeLabel.classList.toggle("hidden", !isCustom || !hasTemplateField("type"));
}

/** Returns either the selected standard type or the custom type text. */
function getSelectedType() {
  if (elements.typeInput.value === "__custom") {
    return elements.customTypeInput.value.trim();
  }

  return elements.typeInput.value.trim();
}

const defaultDesignerFieldLabels = {
  name: "Name",
  type: "Type",
  subtype: "Subtype",
  cost: "Cost",
  statMode: "Stat mode",
  attack: "Attack",
  health: "Health",
  loyalty: "Loyalty",
  ability: "Rules",
  flavor: "Flavor",
  fit: "Art fit",
  artwork: "Artwork",
  frame: "Frame",
  accent: "Accent",
  text: "Text",
  panel: "Panel",
  frameUrl: "Image URL",
  frameFit: "Background fit",
  artist: "Artist name",
  collector: "Collector number",
  rarity: "Rarity",
  setSymbol: "Set symbol",
};

function getTemplateField(fieldId, sections = state.templateSections) {
  for (const section of sections || []) {
    const field = (section.fields || []).find((item) => item.id === fieldId);
    if (field) return field;
  }
  return null;
}

function hasTemplateField(fieldId) {
  return !state.currentTemplateId || Boolean(getTemplateField(fieldId));
}

function getStandardTemplateInput(fieldId) {
  return {
    name: elements.nameInput,
    type: elements.typeInput,
    subtype: elements.subtypeInput,
    cost: elements.costInput,
    statMode: elements.statModeInput,
    attack: elements.attackInput,
    health: elements.healthInput,
    loyalty: elements.loyaltyInput,
    ability: elements.abilityInput,
    flavor: elements.flavorInput,
    fit: elements.fitInput,
    frame: elements.frameColor,
    accent: elements.accentColor,
    text: elements.textColor,
    panel: elements.panelColor,
    frameUrl: elements.frameUrlInput,
    frameFit: elements.frameFitInput,
    artist: elements.artistInput,
    collector: elements.collectorInput,
    rarity: elements.rarityInput,
  }[fieldId] || null;
}

function getStandardTemplateLabel(fieldId) {
  return getStandardTemplateInput(fieldId)?.closest("label")?.querySelector("span") || null;
}

function setSelectItems(select, options, selectedValue = "") {
  select.replaceChildren();
  for (const item of options || []) {
    const option = document.createElement("option");
    option.value = item.value;
    option.textContent = item.label;
    select.append(option);
  }
  select.value = [...select.options].some((option) => option.value === selectedValue)
    ? selectedValue
    : select.options[0]?.value || "";
}

function getBuiltInAppearanceCapabilities(field) {
  const isDynamicStat = Boolean(field?.dynamicStat) || String(field?.id || "").startsWith("stat_");
  const positionedTextIds = new Set([
    "name", "type", "subtype", "cost", "attack", "health", "loyalty", "artist", "collector",
  ]);
  const flowTextIds = new Set(["ability", "flavor"]);
  const imageIds = new Set(["artwork", "setSymbol"]);
  const fieldId = field?.id || "";
  return {
    hasPosition: positionedTextIds.has(fieldId) || imageIds.has(fieldId) || isDynamicStat,
    hasColor: positionedTextIds.has(fieldId) || flowTextIds.has(fieldId) || fieldId === "setSymbol" || isDynamicStat,
    isImage: imageIds.has(fieldId),
  };
}

function getLegacyBuiltInAppearance(fieldId) {
  const textColor = defaults.text || "#f8f4e8";
  const accentColor = defaults.accent || "#d69d42";
  const appearances = {
    name: { position: { x: 29, y: 29 }, size: { fontSize: 22 }, color: textColor },
    type: { position: { x: 29, y: 55 }, size: { fontSize: 11 }, color: accentColor },
    subtype: { position: { x: 105, y: 55 }, size: { fontSize: 11 }, color: accentColor },
    cost: { position: { x: 350, y: 29 }, size: { fontSize: 18 }, color: "#191510" },
    attack: { position: { x: 246, y: 503 }, size: { fontSize: 20 }, color: textColor },
    health: { position: { x: 326, y: 503 }, size: { fontSize: 20 }, color: textColor },
    loyalty: { position: { x: 264, y: 503 }, size: { fontSize: 20 }, color: textColor },
    ability: { size: { fontSize: 17 }, color: "#242014" },
    flavor: { size: { fontSize: 14 }, color: "#66573b" },
    artwork: { position: { x: 29, y: 82 }, size: { width: 362, height: 218 } },
    artist: { position: { x: 296, y: 552 }, size: { fontSize: 11 }, color: textColor },
    collector: { position: { x: 65, y: 552 }, size: { fontSize: 11 }, color: textColor },
    setSymbol: { position: { x: 27, y: 551 }, size: { width: 14, height: 14 }, color: accentColor },
  };
  return fieldId.startsWith("stat_") ? appearances.loyalty : appearances[fieldId];
}

function hasExplicitBuiltInAppearance(field) {
  if (!field?.size) return false;
  const legacy = getLegacyBuiltInAppearance(field.id);
  if (!legacy) return true;
  const fieldX = Number(field.position?.x);
  const fieldY = Number(field.position?.y);
  const samePosition = !legacy.position || (
    fieldY === legacy.position.y
    && (fieldX === legacy.position.x || (field.id === "subtype" && fieldX === 70))
  );
  const sameSize = legacy.size.fontSize !== undefined
    ? Number(field.size?.fontSize) === legacy.size.fontSize
    : Number(field.size?.width) === legacy.size.width && Number(field.size?.height) === legacy.size.height;
  const sameColor = !legacy.color || String(field.color || "").toLowerCase() === legacy.color.toLowerCase();
  return !(samePosition && sameSize && sameColor);
}

const builtInCoordinateBounds = {
  width: 420,
  height: Math.round((420 * 88) / 63),
};

function getBuiltInRenderScale() {
  const bounds = elements.card.getBoundingClientRect();
  return {
    x: bounds.width / builtInCoordinateBounds.width,
    y: bounds.height / builtInCoordinateBounds.height,
    font: Math.min(
      bounds.width / builtInCoordinateBounds.width,
      bounds.height / builtInCoordinateBounds.height,
    ),
  };
}

function getBuiltInPreviewElement(fieldId) {
  return {
    name: elements.cardName,
    type: elements.cardTypeValue,
    subtype: elements.cardSubtypeValue,
    cost: elements.cardCost,
    attack: elements.attackStat,
    health: elements.healthStat,
    loyalty: elements.loyaltyStat,
    ability: elements.cardAbility,
    flavor: elements.cardFlavor,
    artwork: elements.artWindow,
    artist: elements.cardArtist,
    collector: elements.cardCollector,
    setSymbol: elements.setSymbol,
  }[fieldId] || (fieldId.startsWith("stat_") ? elements.loyaltyStat : null);
}

function resetBuiltInAppearanceStyles() {
  const fieldIds = [
    "name", "type", "subtype", "cost", "attack", "health", "loyalty", "ability", "flavor",
    "artwork", "artist", "collector", "setSymbol",
  ];
  for (const fieldId of fieldIds) {
    const target = getBuiltInPreviewElement(fieldId);
    if (!target) continue;
    target.style.removeProperty("transform");
    target.style.removeProperty("transform-origin");
    target.style.removeProperty("color");
    target.style.removeProperty("font-size");
    target.style.removeProperty("width");
    target.style.removeProperty("height");
    target.querySelectorAll?.(".stat-label, strong").forEach((item) => {
      item.style.removeProperty("color");
      item.style.removeProperty("font-size");
    });
  }
  elements.setSymbol.style.removeProperty("background-color");
  elements.setSymbol.style.removeProperty("mask-image");
  elements.setSymbol.style.removeProperty("-webkit-mask-image");
  elements.setSymbol.classList.remove("has-set-symbol-image");
}

function resetTemplateDrivenControls() {
  state.currentTemplateId = "";
  state.currentTemplateName = "";
  state.templateSections = [];
  state.templateCustomFields = [];
  resetBuiltInAppearanceStyles();
  for (const [fieldId, labelText] of Object.entries(defaultDesignerFieldLabels)) {
    const input = getStandardTemplateInput(fieldId);
    const label = input?.closest("label");
    if (label) label.classList.remove("hidden");
    const labelTextElement = getStandardTemplateLabel(fieldId);
    if (labelTextElement) labelTextElement.textContent = labelText;
  }
  elements.frameInput.closest("label")?.classList.remove("hidden");
  elements.costInput.type = "number";
  elements.costInput.min = "0";
  elements.costInput.max = "99";
  elements.collectorInput.readOnly = true;
  setSelectItems(elements.statModeInput, [
    { value: "combat", label: "Attack / Health" },
    { value: "loyalty", label: "Loyalty" },
  ], defaults.statMode || "combat");
  setSelectItems(
    elements.rarityInput,
    Object.entries(rarityLabels).map(([value, label]) => ({ value, label })),
    defaults.rarity || "common",
  );
  document.querySelectorAll("[data-card-section]").forEach((section) => section.classList.remove("hidden"));
  elements.templateStatInputs.replaceChildren();
  elements.templateCustomFields.replaceChildren();
  elements.templateCustomFieldsPanel.classList.add("hidden");
  elements.cardCustomFieldPreview.replaceChildren();
}

function getTemplateFieldValue(fieldId, fallback = "") {
  return getTemplateField(fieldId)?.value ?? fallback;
}

function renderTemplateStatInputs() {
  elements.templateStatInputs.replaceChildren();
  const numbersSection = state.templateSections.find((section) => section.id === "numbers");
  for (const field of numbersSection?.fields || []) {
    if (!field.dynamicStat) continue;
    const label = document.createElement("label");
    const labelText = document.createElement("span");
    labelText.textContent = field.label;
    const input = document.createElement("input");
    input.type = "number";
    input.min = "0";
    input.max = "99";
    input.value = field.value ?? "0";
    input.dataset.templateStatId = field.id;
    label.append(labelText, input);
    elements.templateStatInputs.append(label);
  }
}

function createTemplateCustomFieldInput(field) {
  let input;
  if (field.dataType === "dropdown") {
    input = document.createElement("select");
    setSelectItems(
      input,
      (field.options || []).map((option) => ({ value: option, label: option })),
      field.value || field.options?.[0] || "",
    );
  } else {
    input = document.createElement("input");
    input.type = field.dataType === "number" ? "number" : "text";
    if (field.dataType === "symbol" || field.dataType === "art") {
      input.type = "url";
      input.inputMode = "url";
      input.placeholder = "Image URL";
    }
    input.value = field.value || "";
  }
  input.dataset.templateCustomName = field.name;
  input.setAttribute("aria-label", field.name);
  return input;
}

function renderTemplateCustomFieldInputs() {
  elements.templateCustomFields.replaceChildren();
  elements.templateCustomFieldsPanel.classList.toggle("hidden", !state.templateCustomFields.length);
  for (const field of state.templateCustomFields) {
    const label = document.createElement("label");
    const labelText = document.createElement("span");
    labelText.textContent = field.name;
    label.append(labelText, createTemplateCustomFieldInput(field));
    elements.templateCustomFields.append(label);
  }
}

function renderCardCustomFields() {
  state.customFieldPreviewToken += 1;
  for (const objectUrl of state.customFieldObjectUrls) URL.revokeObjectURL(objectUrl);
  state.customFieldObjectUrls = [];
  const previewToken = state.customFieldPreviewToken;
  const imageLoads = [];
  elements.cardCustomFieldPreview.replaceChildren();
  for (const field of state.templateCustomFields) {
    const item = document.createElement("div");
    const isImage = field.dataType === "symbol" || field.dataType === "art";
    item.className = `custom-field-preview-item ${isImage ? "image-value" : "text-value"} ${field.dataType === "symbol" ? "symbol-value" : ""}`.trim();
    item.style.left = `${field.position.x}px`;
    item.style.top = `${field.position.y}px`;
    if (isImage) {
      item.style.width = `${field.size.width}px`;
      item.style.height = `${field.size.height}px`;
      if (field.value) {
        const image = document.createElement("img");
        image.alt = field.name;
        imageLoads.push(loadTemplateCustomFieldImage(image, field.value, previewToken));
        item.replaceChildren(image);
      } else {
        item.textContent = field.name;
      }
    } else {
      item.style.color = field.color;
      item.style.fontSize = `${field.size.fontSize}px`;
      item.textContent = field.value || "";
    }
    elements.cardCustomFieldPreview.append(item);
  }
  state.customFieldImageLoad = Promise.allSettled(imageLoads);
}

async function loadTemplateCustomFieldImage(image, source, previewToken) {
  try {
    if (source.startsWith("data:") || source.startsWith("blob:")) {
      image.src = source;
      return;
    }
    const blob = await fetchCardImageBlob(source);
    if (previewToken !== state.customFieldPreviewToken || !image.isConnected) return;
    const objectUrl = URL.createObjectURL(blob);
    state.customFieldObjectUrls.push(objectUrl);
    image.src = objectUrl;
  } catch (error) {
    image.replaceWith(document.createTextNode("Image unavailable"));
  }
}

function syncTemplateValuesFromControls() {
  if (!state.currentTemplateId) return;
  for (const section of state.templateSections) {
    for (const field of section.fields || []) {
      const standardInput = getStandardTemplateInput(field.id);
      const dynamicInput = elements.templateStatInputs.querySelector(`[data-template-stat-id="${field.id}"]`);
      if (field.id === "type") field.value = getSelectedType();
      else if (standardInput) field.value = standardInput.value;
      else if (dynamicInput) field.value = dynamicInput.value;
    }
  }
  for (const field of state.templateCustomFields) {
    const input = [...elements.templateCustomFields.querySelectorAll("[data-template-custom-name]")]
      .find((item) => item.dataset.templateCustomName === field.name);
    if (input) field.value = input.value;
  }
}

function configureTemplateDrivenControls() {
  for (const [fieldId, defaultLabel] of Object.entries(defaultDesignerFieldLabels)) {
    const field = getTemplateField(fieldId);
    const input = getStandardTemplateInput(fieldId);
    const label = input?.closest("label");
    if (label) label.classList.toggle("hidden", !field);
    const labelText = getStandardTemplateLabel(fieldId);
    if (labelText) {
      labelText.textContent = fieldId === "fit" && field
        ? "Default Art Fit"
        : field?.label || defaultLabel;
    }
  }
  elements.frameInput.closest("label")?.classList.toggle("hidden", !getTemplateField("frameUrl"));

  const costField = getTemplateField("cost");
  if (costField) {
    elements.costInput.type = costField.mustBeNumber === false ? "text" : "number";
    if (elements.costInput.type === "number") {
      elements.costInput.min = "0";
      elements.costInput.max = "99";
    } else {
      elements.costInput.removeAttribute("min");
      elements.costInput.removeAttribute("max");
    }
  }
  const collectorField = getTemplateField("collector");
  if (collectorField) elements.collectorInput.readOnly = !collectorField.canEdit;

  const statModeField = getTemplateField("statMode");
  if (statModeField) {
    const statOptions = Array.isArray(statModeField.options) ? statModeField.options : [
      { value: "combat", label: "Attack / Health" },
      { value: "loyalty", label: "Loyalty" },
    ];
    statModeField.options = statOptions;
    setSelectItems(elements.statModeInput, statOptions, statModeField.value);
  }
  const rarityField = getTemplateField("rarity");
  if (rarityField) {
    const rarityOptions = Array.isArray(rarityField.options)
      ? rarityField.options
      : Object.entries(rarityLabels).map(([value, label]) => ({ value, label }));
    rarityField.options = rarityOptions;
    setSelectItems(elements.rarityInput, rarityOptions, rarityField.value);
  }

  for (const section of document.querySelectorAll("[data-card-section]")) {
    const sectionId = section.dataset.cardSection;
    const templateSection = state.templateSections.find((item) => item.id === sectionId);
    const preservePerCardControls = sectionId === "identity";
    const hasSectionFields = sectionId === "artwork"
      ? Boolean(getTemplateField("artwork") || getTemplateField("fit"))
      : Boolean((templateSection?.fields || []).length);
    section.classList.toggle("hidden", !preservePerCardControls && !hasSectionFields);
  }
  renderTemplateStatInputs();
  renderTemplateCustomFieldInputs();
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

function applyTemplateBuiltInTypographyAndSize() {
  if (!state.currentTemplateId) return;
  const scale = getBuiltInRenderScale();
  for (const section of state.templateSections) {
    for (const field of section.fields || []) {
      if (!hasExplicitBuiltInAppearance(field)) continue;
      if (field.dynamicStat) {
        const selectedOption = getTemplateField("statMode")?.options?.find(
          (option) => option.value === elements.statModeInput.value,
        );
        if (selectedOption?.fieldId !== field.id) continue;
      }
      const target = getBuiltInPreviewElement(field.id);
      if (!target || !field.size) continue;
      const capabilities = getBuiltInAppearanceCapabilities(field);
      if (capabilities.hasColor && field.color) {
        target.style.color = field.color;
        target.querySelectorAll?.(".stat-label, strong").forEach((item) => { item.style.color = field.color; });
      }
      if (capabilities.isImage) {
        target.style.width = "";
        target.style.height = "";
      } else {
        const scaledFontSize = field.size.fontSize * scale.font;
        target.style.fontSize = `${scaledFontSize}px`;
        target.querySelectorAll?.("strong").forEach((item) => { item.style.fontSize = `${scaledFontSize}px`; });
        target.querySelectorAll?.(".stat-label").forEach((item) => {
          item.style.fontSize = `${Math.max(1, scaledFontSize * 0.55)}px`;
        });
      }
    }
  }
}

function applyTemplateBuiltInPositions() {
  if (!state.currentTemplateId) return;
  const cardBounds = elements.card.getBoundingClientRect();
  const scale = getBuiltInRenderScale();
  for (const section of state.templateSections) {
    for (const field of section.fields || []) {
      if (!hasExplicitBuiltInAppearance(field)) continue;
      if (field.dynamicStat) {
        const selectedOption = getTemplateField("statMode")?.options?.find(
          (option) => option.value === elements.statModeInput.value,
        );
        if (selectedOption?.fieldId !== field.id) continue;
      }
      if (!field.position) continue;
      const target = getBuiltInPreviewElement(field.id);
      if (!target) continue;
      target.style.transform = "";
      const targetBounds = target.getBoundingClientRect();
      const currentX = targetBounds.left - cardBounds.left;
      const currentY = targetBounds.top - cardBounds.top;
      let transform = `translate(${field.position.x * scale.x - currentX}px, ${field.position.y * scale.y - currentY}px)`;
      const capabilities = getBuiltInAppearanceCapabilities(field);
      if (capabilities.isImage && targetBounds.width && targetBounds.height) {
        transform += ` scale(${(field.size.width * scale.x) / targetBounds.width}, ${(field.size.height * scale.y) / targetBounds.height})`;
        target.style.transformOrigin = "top left";
      }
      target.style.transform = transform;
    }
  }
}

function updateCardSetSymbol() {
  const symbolField = getTemplateField("setSymbol");
  const cardSet = getSetByCode(elements.setInput.value || "DEFAULT");
  const symbolUrl = String(cardSet?.symbol || "").trim();
  elements.setSymbol.classList.toggle("hidden", state.currentTemplateId && !symbolField);
  if (!state.currentTemplateId) return;
  elements.setSymbol.style.backgroundColor = hasExplicitBuiltInAppearance(symbolField)
    ? symbolField.color
    : "";
  if (symbolUrl !== state.setSymbolMaskSource) {
    const loadToken = ++state.setSymbolMaskLoadToken;
    state.setSymbolMaskSource = symbolUrl;
    state.setSymbolMaskDataUrl = "";
    state.setSymbolMaskLoad = symbolUrl
      ? fetchCardImageBlob(symbolUrl)
          .then((blob) => readBlobAsDataUrl(blob))
          .then((dataUrl) => {
            if (loadToken !== state.setSymbolMaskLoadToken) return;
            state.setSymbolMaskDataUrl = dataUrl;
            elements.setSymbol.style.maskImage = `url("${dataUrl}")`;
            elements.setSymbol.style.webkitMaskImage = `url("${dataUrl}")`;
          })
          .catch(() => {})
      : Promise.resolve();
  }
  const maskUrl = state.setSymbolMaskDataUrl;
  elements.setSymbol.style.maskImage = maskUrl ? `url("${maskUrl}")` : "";
  elements.setSymbol.style.webkitMaskImage = maskUrl ? `url("${maskUrl}")` : "";
  elements.setSymbol.classList.toggle("has-set-symbol-image", Boolean(symbolUrl));
}

/** Shrinks or wraps the preview name so it stays inside the card header. */
function fitCardName() {
  const name = elements.cardName;
  name.classList.remove("is-wrapped");
  const nameField = getTemplateField("name");
  const configuredSize = hasExplicitBuiltInAppearance(nameField) ? nameField.size.fontSize : 0;
  const scale = getBuiltInRenderScale();
  name.style.fontSize = configuredSize ? `${configuredSize * scale.font}px` : "";

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
  panel.classList.remove("is-short-split");
  const abilityField = getTemplateField("ability");
  const flavorField = getTemplateField("flavor");
  const configuredAbilitySize = hasExplicitBuiltInAppearance(abilityField) ? abilityField.size.fontSize : 0;
  const configuredFlavorSize = hasExplicitBuiltInAppearance(flavorField) ? flavorField.size.fontSize : 0;
  const scale = getBuiltInRenderScale();
  ability.style.fontSize = configuredAbilitySize ? `${configuredAbilitySize * scale.font}px` : "";
  ability.style.lineHeight = "";
  flavor.style.fontSize = configuredFlavorSize ? `${configuredFlavorSize * scale.font}px` : "";
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

  panel.classList.toggle("is-short-split", shouldCenterShortRulesText());
}

/** Returns whether rules and flavor text are short enough for a centered split layout. */
function shouldCenterShortRulesText() {
  const hasAbility = Boolean(elements.abilityInput.value.trim());
  const hasFlavor = Boolean(elements.flavorInput.value.trim());
  if (!hasAbility || !hasFlavor) return false;

  const panel = elements.rulesPanel;
  const abilityHeight = elements.cardAbility.scrollHeight;
  const flavorHeight = elements.cardFlavor.scrollHeight;
  return abilityHeight + flavorHeight <= panel.clientHeight * 0.48;
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

/** Updates the previous and next card controls for the current set position. */
function updateCardNavigationControls() {
  const currentCardId = state.currentCardId || elements.savedCardsInput.value;
  const currentCard = state.savedCards.find((card) => card.cardId === currentCardId);
  const setCode = currentCard?.setCode || elements.cardSetsInput.value || "DEFAULT";
  const cardsInSet = getCardsInSet(setCode);
  const currentIndex = cardsInSet.findIndex((card) => card.cardId === currentCardId);
  const hasPreviousCard = currentIndex > 0;
  const hasNextCard = currentIndex >= 0 && currentIndex < cardsInSet.length - 1;

  elements.previousCardButton.disabled = state.cardNavigationPending || !hasPreviousCard;
  elements.nextCardButton.disabled = state.cardNavigationPending || !hasNextCard;
}

/** Navigates to an another card in the set by offset amount after resolving any unsaved changes. */
async function navigateToCard(offset) {
  if (state.cardNavigationPending) return;

  const currentCardId = state.currentCardId || elements.savedCardsInput.value;
  const currentCard = state.savedCards.find((card) => card.cardId === currentCardId);
  const setCode = currentCard?.setCode || elements.cardSetsInput.value || "DEFAULT";
  const cardsInSet = getCardsInSet(setCode);
  const currentIndex = cardsInSet.findIndex((card) => card.cardId === currentCardId);
  const targetCard = cardsInSet[currentIndex + offset];
  if (!targetCard) return;

  state.cardNavigationPending = true;
  updateCardNavigationControls();
  try {
    elements.savedCardsInput.value = targetCard.cardId;
    await handleSavedCardSelectionChange();
  } finally {
    state.cardNavigationPending = false;
    updateCardNavigationControls();
  }
}

/** Handles horizontal preview swipes as previous or next card navigation. */
function handlePreviewSwipeStart(event) {
  if (event.touches.length !== 1) return;
  state.previewTouchStart = {
    x: event.touches[0].clientX,
    y: event.touches[0].clientY,
  };
}

/** Navigates on a deliberate horizontal swipe without blocking vertical scrolling. */
function handlePreviewSwipeEnd(event) {
  if (!state.previewTouchStart || event.changedTouches.length !== 1) return;

  const start = state.previewTouchStart;
  state.previewTouchStart = null;
  const deltaX = event.changedTouches[0].clientX - start.x;
  const deltaY = event.changedTouches[0].clientY - start.y;
  if (Math.abs(deltaX) < 40 || Math.abs(deltaX) <= Math.abs(deltaY)) return;

  navigateToCard(deltaX < 0 ? 1 : -1);
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
  const collectorIsEditable = state.currentTemplateId && getTemplateField("collector")?.canEdit;
  if (!state.currentCardId && !collectorIsEditable) {
    elements.collectorInput.value = getNextCollectorNumber(elements.setInput.value || "DEFAULT");
  }
}

/** Copies form state into the live card preview. */
function syncCard() {
  syncTypeMode();
  syncTemplateValuesFromControls();
  elements.card.classList.toggle(
    "has-built-in-layout",
    Boolean(state.currentTemplateId) && state.templateSections.some(
      (section) => (section.fields || []).some((field) => hasExplicitBuiltInAppearance(field)),
    ),
  );
  const subtype = elements.subtypeInput.value.trim();
  const typeValue = getSelectedType();
  const statModeField = getTemplateField("statMode");
  const hasCombatStats = hasTemplateField("attack") || hasTemplateField("health");
  const activeStatMode = statModeField
    ? elements.statModeInput.value
    : (hasCombatStats ? "combat" : (hasTemplateField("loyalty") ? "loyalty" : "none"));
  const selectedStatOption = statModeField?.options?.find(
    (option) => option.value === activeStatMode,
  );
  const customStatField = selectedStatOption?.fieldId ? getTemplateField(selectedStatOption.fieldId) : null;
  const isTypeStatless = !state.currentTemplateId && isStatlessType(typeValue);
  const isLoyalty = !isTypeStatless && activeStatMode === "loyalty" && hasTemplateField("loyalty");
  const showCustomStat = !isTypeStatless && Boolean(customStatField);
  const showSingleStat = isLoyalty || showCustomStat;
  const isStatless = isTypeStatless || (state.currentTemplateId && !showSingleStat && !hasCombatStats);
  const rarity = elements.rarityInput.value;
  syncCollectorInputForCurrentSet();

  updateText(elements.cardName, elements.nameInput.value, "Untitled Card");
  elements.cardName.classList.toggle("hidden", !hasTemplateField("name"));
  fitCardName();
  const hasType = hasTemplateField("type");
  const hasSubtype = hasTemplateField("subtype");
  elements.cardTypeValue.textContent = hasType ? typeValue || "Card" : "";
  elements.cardSubtypeText.textContent = hasSubtype ? subtype : "";
  elements.cardTypeSeparator.classList.toggle("hidden", !hasType || !hasSubtype || !typeValue || !subtype);
  elements.cardType.classList.toggle("hidden", !hasTemplateField("type") && !hasTemplateField("subtype"));
  elements.cardCost.textContent = formatCost(elements.costInput.value);
  elements.cardCost.classList.toggle("hidden", !hasTemplateField("cost"));
  updateText(elements.cardAttack, elements.attackInput.value, "0");
  updateText(elements.cardHealth, elements.healthInput.value, "0");
  updateText(elements.cardLoyalty, customStatField?.value ?? elements.loyaltyInput.value, "0");
  elements.cardAttack.closest("div").classList.toggle("hidden", !hasTemplateField("attack"));
  elements.cardHealth.closest("div").classList.toggle("hidden", !hasTemplateField("health"));
  const attackLabel = getTemplateField("attack")?.label || "Attack";
  const healthLabel = getTemplateField("health")?.label || "Health";
  elements.cardAttack.previousElementSibling.textContent = attackLabel === "Attack" ? "ATK" : attackLabel.toUpperCase();
  elements.cardHealth.previousElementSibling.textContent = healthLabel === "Health" ? "HP" : healthLabel.toUpperCase();
  elements.cardLoyalty.previousElementSibling.textContent = (
    customStatField?.label || getTemplateField("loyalty")?.label || "Loyalty"
  ).toUpperCase();
  updateRulesText(elements.cardAbility, elements.abilityInput.value, "");
  updateMultilineText(elements.cardFlavor, elements.flavorInput.value, "");
  elements.cardAbility.classList.toggle("hidden", !hasTemplateField("ability"));
  elements.cardFlavor.classList.toggle("hidden", !hasTemplateField("flavor"));
  elements.rulesPanel.classList.toggle("hidden", !hasTemplateField("ability") && !hasTemplateField("flavor"));
  elements.cardFlavor.classList.toggle(
    "has-separator",
    Boolean(
      hasTemplateField("ability")
      && hasTemplateField("flavor")
      && elements.abilityInput.value.trim()
      && elements.flavorInput.value.trim()
    ),
  );
  const artistLabel = getTemplateField("artist")?.label || "Art";
  updateText(
    elements.cardArtist,
    elements.artistInput.value ? `${artistLabel}: ${elements.artistInput.value}` : "",
    `${artistLabel}: Unknown`,
  );
  updateText(elements.cardCollector, formatPreviewCollectorNumber(), "1/1");
  const rarityOption = getTemplateField("rarity")?.options?.find((option) => option.value === rarity);
  updateText(elements.cardRarity, rarityOption?.label || getRarityLabel(rarity), getRarityLabel("common"));
  elements.cardArtist.classList.toggle("hidden", !hasTemplateField("artist"));
  elements.cardCollector.classList.toggle("hidden", !hasTemplateField("collector"));
  elements.cardRarity.classList.toggle("hidden", !hasTemplateField("rarity"));

  elements.card.classList.toggle("is-loyalty", showSingleStat);
  elements.card.classList.toggle("is-statless", isStatless);
  elements.statModeInput.closest("label").classList.toggle("hidden", isStatless || !hasTemplateField("statMode"));
  elements.combatInputs.classList.toggle("hidden", isStatless || showSingleStat || !hasCombatStats);
  elements.loyaltyInputs.classList.toggle("hidden", isStatless || !isLoyalty);
  elements.combatStats.classList.toggle("hidden", isStatless || showSingleStat || !hasCombatStats);
  elements.loyaltyStat.classList.toggle("hidden", isStatless || !showSingleStat);
  elements.artWindow.classList.toggle(
    "hidden",
    Boolean(state.currentTemplateId) && !getTemplateField("artwork") && !getTemplateField("fit"),
  );
  updateArtFit();
  updateFrameFit();
  document.documentElement.style.setProperty("--frame", elements.frameColor.value);
  document.documentElement.style.setProperty("--accent", elements.accentColor.value);
  document.documentElement.style.setProperty("--card-text", elements.textColor.value);
  document.documentElement.style.setProperty("--panel", elements.panelColor.value);
  document.documentElement.style.setProperty("--rarity-color", getRarityColor(rarity));
  updateCardSetSymbol();
  applyTemplateBuiltInTypographyAndSize();
  renderCardCustomFields();
  fitRulesText();
  applyTemplateBuiltInPositions();
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

/** Applies the selected object fit to the card frame background image. */
function updateFrameFit() {
  elements.cardFrameImage.style.objectFit = elements.frameFitInput.value || "fill";
}

/** Releases the current object URL used for a proxied frame background. */
function revokeFrameObjectUrl() {
  if (state.frameObjectUrl) {
    URL.revokeObjectURL(state.frameObjectUrl);
    state.frameObjectUrl = "";
  }
}

/** Removes the frame background from the preview and resets its image state. */
function clearFrame() {
  revokeFrameObjectUrl();
  state.frameUrl = "";
  state.pendingFrameUpload = null;
  elements.cardFrameImage.removeAttribute("src");
  elements.cardFrameImage.removeAttribute("crossorigin");
}

/** Fetches a remote image through the authenticated image proxy. */
async function getProxiedImageSource(imageUrl) {
  if (!state.idToken || isJwtExpired(state.idToken)) {
    throw new Error("Sign in to load image URLs through the CORS-safe proxy.");
  }

  const isSavedImageUrl = ["/art?", "/frame?"].some((path) => imageUrl.startsWith(`${backendConfig.apiUrl}${path}`));
  const imageRequestUrl = isSavedImageUrl
    ? imageUrl
    : `${backendConfig.apiUrl}/image-proxy?url=${encodeURIComponent(imageUrl)}`;
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

/** Loads the card frame image element and resolves when its pixels are ready. */
function loadFrameElement(src) {
  return new Promise((resolve, reject) => {
    const handleLoad = () => {
      cleanup();
      resolve();
    };
    const handleError = () => {
      cleanup();
      reject(new Error("Frame image URL did not load as an image."));
    };
    const cleanup = () => {
      elements.cardFrameImage.removeEventListener("load", handleLoad);
      elements.cardFrameImage.removeEventListener("error", handleError);
    };

    elements.cardFrameImage.addEventListener("load", handleLoad);
    elements.cardFrameImage.addEventListener("error", handleError);
    elements.cardFrameImage.src = src;
    if (elements.cardFrameImage.complete) {
      if (elements.cardFrameImage.naturalWidth > 0) handleLoad();
      else handleError();
    }
  });
}

/** Loads a frame background from a file, data URL, proxied URL, or direct fallback. */
async function setFrameSource(src, statusMessage = "") {
  const frameUrl = String(src || "").trim();
  revokeFrameObjectUrl();
  state.frameUrl = frameUrl;
  if (!frameUrl) {
    clearFrame();
    return;
  }

  if (!isValidImageUri(frameUrl)) {
    clearFrame();
    setSaveStatus("Enter a valid frame image URL.");
    return;
  }

  elements.cardFrameImage.removeAttribute("crossorigin");
  if (frameUrl.startsWith("data:")) {
    try {
      await loadFrameElement(frameUrl);
      if (statusMessage) setSaveStatus(statusMessage);
    } catch (error) {
      clearFrame();
      setSaveStatus(error.message);
    }
    return;
  }

  try {
    const objectUrl = await getProxiedImageSource(frameUrl);
    state.frameObjectUrl = objectUrl;
    await loadFrameElement(objectUrl);
    if (statusMessage) setSaveStatus(statusMessage);
  } catch (error) {
    try {
      await loadFrameElement(frameUrl);
      if (statusMessage) setSaveStatus(statusMessage);
    } catch (loadError) {
      clearFrame();
      setSaveStatus(loadError.message);
      return;
    }
    setSaveStatus(`${error.message} Preview may work, but PNG export may fail.`);
  }
}

/** Loads a changed frame URL and clears any pending file upload. */
function loadFrameUrl() {
  elements.frameInput.value = "";
  state.pendingFrameUpload = null;
  setFrameSource(elements.frameUrlInput.value, "Frame image URL loaded");
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
  resetTemplateDrivenControls();
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
  elements.frameFitInput.value = defaults.frameFit;
  elements.frameColor.value = defaults.frame;
  elements.accentColor.value = defaults.accent;
  elements.textColor.value = defaults.text;
  elements.panelColor.value = defaults.panel;
  elements.artInput.value = "";
  elements.artUrlInput.value = "";
  state.pendingArtUpload = null;
  clearArt();
  elements.frameInput.value = "";
  elements.frameUrlInput.value = "";
  state.pendingFrameUpload = null;
  clearFrame();
  renderCardTemplates();
  syncCard();
  updateCurrentCardSnapshot();
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

/** Reads an uploaded frame background file into the preview. */
function loadFrame(event) {
  const [file] = event.target.files;
  if (!file) return;

  elements.frameUrlInput.value = "";
  const reader = new FileReader();
  const pendingLoad = new Promise((resolve, reject) => {
    reader.addEventListener("load", async () => {
      state.pendingFrameUpload = {
        dataUrl: reader.result,
        fileName: file.name,
        type: file.type,
      };
      try {
        await setFrameSource(reader.result);
        resolve();
      } catch (error) {
        reject(error);
      }
    });
    reader.addEventListener("error", () => reject(new Error("The frame image file could not be read.")));
  });
  state.pendingFrameLoad = pendingLoad;
  pendingLoad
    .catch((error) => setSaveStatus(error.message))
    .finally(() => {
      if (state.pendingFrameLoad === pendingLoad) state.pendingFrameLoad = null;
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
    setSaveStatus("Design saved without art. The uploaded image is too large for DynamoDB.");
  }

  const typedFrameUrl = elements.frameUrlInput.value.trim();
  const hasDataUrlFrame = String(state.frameUrl || elements.cardFrameImage.src || "").startsWith("data:");
  let frameUrl = typedFrameUrl || state.pendingFrameUpload?.dataUrl || (
    hasDataUrlFrame ? state.frameUrl || elements.cardFrameImage.src || "" : ""
  );
  if (frameUrl.startsWith("data:") && frameUrl.length > 300000) {
    frameUrl = "";
    setSaveStatus("Design saved without its frame image. The uploaded image is too large for DynamoDB.");
  }

  const typeValue = getSelectedType();
  const isStatless = isStatlessType(typeValue);
  const cardIsStatless = isStatless && !state.currentTemplateId;
  const statMode = elements.statModeInput.value || "combat";
  const costField = getTemplateField("cost");
  syncTemplateValuesFromControls();

  const card = {
    name: elements.nameInput.value.trim() || "Untitled Card",
    artUrl,
    artFit: elements.fitInput.value || "cover",
    frameUrl,
    frameFit: elements.frameFitInput.value || "fill",
    cost: state.currentTemplateId && costField?.mustBeNumber === false
      ? elements.costInput.value
      : Number(elements.costInput.value || 0),
    type: typeValue,
    sub_type: elements.subtypeInput.value.trim(),
    statMode: cardIsStatless ? "none" : statMode,
    attack: !cardIsStatless && statMode === "combat" ? Number(elements.attackInput.value || 0) : null,
    health: !cardIsStatless && statMode === "combat" ? Number(elements.healthInput.value || 0) : null,
    loyalty: !cardIsStatless && statMode === "loyalty" ? Number(elements.loyaltyInput.value || 0) : null,
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
  if (state.currentTemplateId) {
    card.templateId = state.currentTemplateId;
    card.templateName = state.currentTemplateName;
    card.templateSections = structuredClone(state.templateSections);
    card.templateCustomFields = structuredClone(state.templateCustomFields);
  }
  return card;
}

/** Normalizes card fields so dirty checking ignores backend/default shape differences. */
function normalizeCardForSnapshot(card) {
  const typeValue = String(card.type || defaults.type || "").trim();
  const isStatless = isStatlessType(typeValue);
  const hasTemplate = Boolean(card.templateId);
  const statMode = isStatless && !hasTemplate
    ? "none"
    : String(card.statMode || "combat");
  const costField = getTemplateField("cost", card.templateSections || []);

  return {
    name: String(card.name || "Untitled Card").trim() || "Untitled Card",
    artUrl: String(card.artUrl || "").trim(),
    artFit: ["cover", "contain", "fill"].includes(card.artFit) ? card.artFit : defaults.fit,
    frameUrl: String(card.frameUrl || "").trim(),
    frameFit: ["cover", "contain", "fill"].includes(card.frameFit) ? card.frameFit : defaults.frameFit,
    cost: hasTemplate && costField?.mustBeNumber === false
      ? String(card.cost ?? "")
      : Number(card.cost || 0),
    type: typeValue,
    sub_type: String(card.sub_type || card.subtype || "").trim(),
    statMode,
    attack: (!isStatless || hasTemplate) && statMode === "combat" ? Number(card.attack || 0) : null,
    health: (!isStatless || hasTemplate) && statMode === "combat" ? Number(card.health || 0) : null,
    loyalty: (!isStatless || hasTemplate) && statMode === "loyalty" ? Number(card.loyalty || 0) : null,
    setCode: card.setCode || "DEFAULT",
    abilities: String(card.abilities || ""),
    flavorText: String(card.flavorText || ""),
    artistName: String(card.artistName || "").trim(),
    collectorNumber: normalizeCollectorNumber(card.collectorNumber),
    rarity: card.rarity || defaults.rarity,
    colors: {
      frame: card.colors?.frame || defaults.frame,
      accent: card.colors?.accent || defaults.accent,
      text: card.colors?.text || defaults.text,
      panel: card.colors?.panel || defaults.panel,
    },
    templateId: String(card.templateId || ""),
    templateName: String(card.templateName || ""),
    templateSections: card.templateId ? card.templateSections || [] : [],
    templateCustomFields: card.templateId ? card.templateCustomFields || [] : [],
  };
}

/** Creates the comparable snapshot used to detect unsaved card changes. */
function createCardSnapshot(card) {
  return JSON.stringify(normalizeCardForSnapshot(card));
}

/** Marks the current editor values as the saved baseline. */
function updateCurrentCardSnapshot(card = collectCardData()) {
  state.currentCardSnapshot = createCardSnapshot(card);
}

/** Returns whether the current editor differs from its last saved or loaded baseline. */
function hasUnsavedCardChanges() {
  return Boolean(state.currentCardSnapshot) && createCardSnapshot(collectCardData()) !== state.currentCardSnapshot;
}

/** Loads a saved card record into the editor controls and preview. */
function applyCardData(card) {
  resetTemplateDrivenControls();
  if (card.templateId && Array.isArray(card.templateSections)) {
    state.currentTemplateId = card.templateId;
    state.currentTemplateName = card.templateName || "";
    state.templateSections = structuredClone(card.templateSections);
    state.templateCustomFields = structuredClone(card.templateCustomFields || []);
    configureTemplateDrivenControls();
  }
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
  elements.fitInput.value = ["cover", "contain", "fill"].includes(card.artFit) ? card.artFit : defaults.fit;
  elements.frameFitInput.value = ["cover", "contain", "fill"].includes(card.frameFit) ? card.frameFit : defaults.frameFit;

  elements.artInput.value = "";
  elements.artUrlInput.value = card.artUrl && !card.artUrl.startsWith("data:") ? card.artUrl : "";
  if (card.artUrl) {
    setArtSource(card.artUrl);
  } else {
    clearArt();
  }

  elements.frameInput.value = "";
  elements.frameUrlInput.value = card.frameUrl && !card.frameUrl.startsWith("data:") ? card.frameUrl : "";
  if (card.frameUrl) {
    setFrameSource(card.frameUrl);
  } else {
    clearFrame();
  }

  syncCard();
  renderCardTemplates(state.currentTemplateId);
  updateCurrentCardSnapshot();
  if (state.currentCardId) rememberLastLoadedCardSelection(card.setCode || "DEFAULT", state.currentCardId);
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
    await refreshCardTemplates(savedSetCode);
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

  const publicUrl = new URL("../public/", window.location.href);
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
  window.location.href = new URL("../sets/", window.location.href).toString();
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
    await refreshCardTemplates(data.card.setCode || "DEFAULT");
    clearNewCardRequest();
    await refreshCardHistory(data.card.cardId, 3);
    setSaveStatus("Loaded design");
  } catch (error) {
    setSaveStatus(error.message);
  }
}

/** Restores the last set/card loaded by the current signed-in user. */
async function restoreLastLoadedCardSelection() {
  const selection = getLastLoadedCardSelection();
  const hasSet = getAvailableSets().some((cardSet) => (cardSet.code || "DEFAULT") === selection.setCode);
  const setCode = hasSet ? selection.setCode : "DEFAULT";
  elements.cardSetsInput.value = setCode;
  elements.setInput.value = setCode;
  renderSavedCards();
  await refreshCardTemplates(setCode);
  updateMakeSetPublicButton();

  const cardExists = selection.cardId && state.savedCards.some((card) => card.cardId === selection.cardId);
  if (!cardExists) return;

  await loadSelectedCard(selection.cardId);
}

/** Loads a card requested by the URL query string, then clears the query. */
async function loadRequestedCardFromUrl() {
  const url = new URL(window.location.href);
  const cardId = url.searchParams.get("card") || "";
  if (!cardId || !state.idToken) return;

  try {
    const data = await apiFetch(`/cards/${encodeURIComponent(cardId)}`);
    applyCardData(data.card);
    await refreshCardTemplates(data.card.setCode || "DEFAULT");
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
  updateCardNavigationControls();

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

function renderCardTemplates(selectedTemplateId = state.currentTemplateId) {
  elements.cardTemplatesInput.replaceChildren();
  const placeholder = document.createElement("option");
  placeholder.value = "";
  placeholder.textContent = state.templates.length ? "Choose a template" : "No templates in this set";
  elements.cardTemplatesInput.append(placeholder);
  for (const template of state.templates) {
    const option = document.createElement("option");
    option.value = template.templateId;
    option.textContent = template.name || "Untitled Template";
    elements.cardTemplatesInput.append(option);
  }
  elements.cardTemplatesInput.value = state.templates.some(
    (template) => template.templateId === selectedTemplateId,
  ) ? selectedTemplateId : "";
  elements.cardTemplatesInput.disabled = !state.idToken || !state.templates.length;
}

async function refreshCardTemplates(setCode = elements.cardSetsInput.value || "DEFAULT") {
  if (!state.idToken) {
    state.templates = [];
    renderCardTemplates();
    return;
  }
  try {
    const data = await apiFetch(`/templates?set=${encodeURIComponent(setCode)}`);
    state.templates = data.templates || [];
    renderCardTemplates();
  } catch (error) {
    state.templates = [];
    renderCardTemplates();
    setSaveStatus(error.message);
  }
}

function openTemplatesForSelectedSet() {
  const setCode = elements.cardSetsInput.value || "DEFAULT";
  const url = new URL("../templates/", window.location.href);
  url.searchParams.set("set", setCode);
  window.location.href = url.toString();
}

function setTemplateStandardValues() {
  for (const section of state.templateSections) {
    for (const field of section.fields || []) {
      const input = getStandardTemplateInput(field.id);
      if (!input) continue;
      if (field.id === "type") setTypeControl(field.value || defaults.type);
      else input.value = field.value ?? "";
    }
  }
  if (getTemplateField("collector") && !elements.collectorInput.value) {
    elements.collectorInput.value = getNextCollectorNumber(elements.setInput.value || "DEFAULT");
  }
}

async function applyTemplateData(template) {
  resetCard();
  state.currentTemplateId = template.templateId || "";
  state.currentTemplateName = template.name || "";
  state.templateSections = structuredClone(template.sections || []);
  state.templateCustomFields = (template.customFields || []).map((field) => ({
    ...structuredClone(field),
    value: field.dataType === "dropdown" ? field.options?.[0] || "" : "",
  }));
  elements.setInput.value = template.setCode || elements.cardSetsInput.value || "DEFAULT";
  elements.cardSetsInput.value = elements.setInput.value;
  configureTemplateDrivenControls();
  setTemplateStandardValues();
  renderTemplateStatInputs();
  renderTemplateCustomFieldInputs();
  elements.artInput.value = "";
  elements.artUrlInput.value = "";
  state.pendingArtUpload = null;
  clearArt();
  elements.frameInput.value = "";
  state.pendingFrameUpload = null;
  const frameUrl = getTemplateFieldValue("frameUrl").trim();
  elements.frameUrlInput.value = frameUrl;
  if (frameUrl) await setFrameSource(frameUrl);
  else clearFrame();
  renderSavedCards();
  renderCardTemplates(state.currentTemplateId);
  syncCard();
  updateCurrentCardSnapshot();
  setSaveStatus(`${state.currentTemplateName || "Template"} loaded. Enter card details and save normally.`);
}

async function loadSelectedTemplate(templateId = elements.cardTemplatesInput.value) {
  if (!templateId) return;
  const data = await apiFetch(`/templates/${encodeURIComponent(templateId)}`);
  await applyTemplateData(data.template);
}

async function handleTemplateSelectionChange() {
  const templateId = elements.cardTemplatesInput.value;
  if (!templateId || templateId === state.currentTemplateId) return;
  if (hasUnsavedCardChanges()) {
    const shouldSave = await promptSaveUnsavedChanges("loading the selected template");
    if (shouldSave) {
      const saved = state.currentCardId
        ? await saveCard(state.currentCardId)
        : await saveNewCard();
      if (!saved) {
        renderCardTemplates(state.currentTemplateId);
        return;
      }
    }
  }
  try {
    await loadSelectedTemplate(templateId);
  } catch (error) {
    renderCardTemplates(state.currentTemplateId);
    setSaveStatus(error.message);
  }
}

function normalizeCardName(name) {
  return String(name || "").trim().replace(/\s+/g, " ").toLowerCase();
}

function findSavedCardByName(name) {
  const normalizedName = normalizeCardName(name);
  const setCode = elements.setInput.value || "DEFAULT";
  return state.savedCards.find(
    (card) => (card.setCode || "DEFAULT") === setCode
      && normalizeCardName(card.name) === normalizedName,
  );
}

/** Offers to update the existing card or save the page as a new, uniquely named card. */
function promptDuplicateSave(cardName, existingCard, saveWithNewName) {
  if (!elements.duplicateSaveDialog) return Promise.resolve("cancel");

  elements.duplicateSaveMessage.textContent = `"${cardName}" already exists in the selected set.`;
  elements.duplicateNewNameFields.classList.add("hidden");
  elements.duplicateNewNameInput.value = "";
  elements.duplicateNewNameStatus.textContent = "";
  elements.duplicateConfirmNewNameButton.disabled = false;

  return new Promise((resolve) => {
    let isSaving = false;
    const finish = (choice) => {
      if (elements.duplicateSaveDialog.open) elements.duplicateSaveDialog.close(choice);
    };
    const handleUpdate = () => finish("update");
    const handleCancel = () => finish("cancel");
    const handleSaveAs = () => {
      elements.duplicateNewNameFields.classList.remove("hidden");
      elements.duplicateNewNameStatus.textContent = "";
      elements.duplicateNewNameInput.focus();
    };
    const handleSaveNew = async (event) => {
      event.preventDefault();
      const newName = elements.duplicateNewNameInput.value.trim();
      if (!newName) {
        elements.duplicateNewNameStatus.textContent = "Enter a name for the new card.";
        elements.duplicateNewNameInput.focus();
        return;
      }

      if (findSavedCardByName(newName)) {
        elements.duplicateNewNameStatus.textContent = `"${newName}" already exists in the selected set. Choose another name.`;
        elements.duplicateNewNameInput.select();
        return;
      }

      isSaving = true;
      elements.duplicateUpdateButton.disabled = true;
      elements.duplicateSaveAsButton.disabled = true;
      elements.duplicateCancelButton.disabled = true;
      elements.duplicateConfirmNewNameButton.disabled = true;
      elements.duplicateNewNameStatus.textContent = "Saving new card...";
      const result = await saveWithNewName(newName);
      isSaving = false;
      elements.duplicateUpdateButton.disabled = false;
      elements.duplicateSaveAsButton.disabled = false;
      elements.duplicateCancelButton.disabled = false;
      elements.duplicateConfirmNewNameButton.disabled = false;
      if (result.saved) {
        finish("saved-copy");
        return;
      }

      const message = result.error?.message || "The new card could not be saved. Try another name.";
      elements.duplicateNewNameStatus.textContent = /already exists/i.test(message)
        ? `"${newName}" already exists in the selected set. Choose another name.`
        : message;
      elements.duplicateNewNameInput.focus();
      if (/already exists/i.test(message)) elements.duplicateNewNameInput.select();
    };
    const handleCancelEvent = (event) => {
      if (isSaving) event.preventDefault();
    };
    const handleClose = () => {
      elements.duplicateUpdateButton.removeEventListener("click", handleUpdate);
      elements.duplicateSaveAsButton.removeEventListener("click", handleSaveAs);
      elements.duplicateCancelButton.removeEventListener("click", handleCancel);
      elements.duplicateSaveForm.removeEventListener("submit", handleSaveNew);
      elements.duplicateSaveDialog.removeEventListener("cancel", handleCancelEvent);
      elements.duplicateSaveDialog.removeEventListener("close", handleClose);
      resolve(elements.duplicateSaveDialog.returnValue || "cancel");
    };

    elements.duplicateUpdateButton.addEventListener("click", handleUpdate);
    elements.duplicateSaveAsButton.addEventListener("click", handleSaveAs);
    elements.duplicateCancelButton.addEventListener("click", handleCancel);
    elements.duplicateSaveForm.addEventListener("submit", handleSaveNew);
    elements.duplicateSaveDialog.addEventListener("cancel", handleCancelEvent);
    elements.duplicateSaveDialog.addEventListener("close", handleClose);
    elements.duplicateSaveDialog.dataset.cardId = existingCard.cardId;
    elements.duplicateSaveDialog.showModal();
  });
}

/** Asks whether to save current edits before loading a different saved card. */
function promptSaveUnsavedChanges(destination = "loading the selected card") {
  if (!elements.unsavedChangesDialog) return Promise.resolve(window.confirm(`Save changes before ${destination}?`));

  const cardName = elements.nameInput.value.trim() || "Untitled Card";
  elements.unsavedChangesMessage.textContent = `Save changes to "${cardName}" before ${destination}?`;

  return new Promise((resolve) => {
    const handleClose = () => {
      elements.unsavedChangesDialog.removeEventListener("close", handleClose);
      resolve(elements.unsavedChangesDialog.returnValue === "save");
    };

    elements.unsavedChangesDialog.addEventListener("close", handleClose);
    elements.unsavedChangesDialog.showModal();
  });
}

/** Saves pending changes when requested, then returns to the site home page. */
async function navigateHome() {
  if (hasUnsavedCardChanges()) {
    const shouldSave = await promptSaveUnsavedChanges("going to the Home Page");
    if (shouldSave) {
      const cardIdToSave = state.currentCardId;
      if (cardIdToSave) await saveCard(cardIdToSave);
      else await saveNewCard();
    }
  }

  window.location.href = new URL("../", window.location.href).toString();
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

/** Asks whether an uploaded frame background should be saved for later. */
function promptSaveFrame() {
  if (!elements.saveFrameDialog) return Promise.resolve(false);
  return new Promise((resolve) => {
    const handleClose = () => {
      elements.saveFrameDialog.removeEventListener("close", handleClose);
      resolve(elements.saveFrameDialog.returnValue === "yes");
    };
    elements.saveFrameDialog.addEventListener("close", handleClose);
    elements.saveFrameDialog.showModal();
  });
}

/** Uploads a selected frame file and swaps the editor to the returned app URL. */
async function savePendingFrameForLater() {
  if (!state.pendingFrameUpload) return;
  const shouldSaveFrame = await promptSaveFrame();
  if (!shouldSaveFrame) return;

  const data = await apiFetch("/frame", {
    method: "POST",
    body: JSON.stringify({
      frameImage: state.pendingFrameUpload.dataUrl,
      cardName: elements.nameInput.value.trim() || "Untitled Card",
      setCode: elements.setInput.value || "DEFAULT",
    }),
  });
  const frameUrl = data.frameUrl?.startsWith("http") ? data.frameUrl : `${backendConfig.apiUrl}${data.frameUrl}`;
  state.pendingFrameUpload = null;
  elements.frameUrlInput.value = frameUrl;
  await setFrameSource(frameUrl, "Frame background saved for later");
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

/** Aligns the preview frame background with its Image URL field before saving. */
async function syncFrameInputBeforeSave() {
  const typedFrameUrl = elements.frameUrlInput.value.trim();
  const currentFrameUrl = String(state.frameUrl || "").trim();
  if (typedFrameUrl && typedFrameUrl !== currentFrameUrl) {
    elements.frameInput.value = "";
    state.pendingFrameUpload = null;
    await setFrameSource(typedFrameUrl);
    return;
  }

  if (!typedFrameUrl && !state.pendingFrameUpload && currentFrameUrl && !currentFrameUrl.startsWith("data:")) {
    clearFrame();
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

/** Clears the current card's frame background and saves the update. */
async function deleteCurrentCardFrame() {
  const cardId = state.currentCardId || elements.savedCardsInput.value;
  if (!cardId) {
    setSaveStatus("Load a saved card before deleting its frame background.");
    return;
  }

  elements.frameUrlInput.value = "";
  elements.frameInput.value = "";
  state.pendingFrameUpload = null;
  clearFrame();
  syncCard();
  await saveCard(cardId);
}

/** Saves or updates a card and uploads its rendered PNG. */
async function saveCard(cardId = "", options = {}) {
  try {
    if (state.pendingArtLoad) await state.pendingArtLoad;
    if (state.pendingFrameLoad) await state.pendingFrameLoad;
    await savePendingArtForLater();
    await savePendingFrameForLater();
    await syncArtInputBeforeSave();
    await syncFrameInputBeforeSave();
    let card = collectCardData();
    if (!cardId) {
      const collectorNumber = getNextCollectorNumber(card.setCode);
      elements.collectorInput.value = collectorNumber;
      syncCard();
      card = collectCardData();
      card.collectorNumber = collectorNumber;
    }
    card.cardImagePng = await getCardPngDataUrl();
    const data = await apiFetch(cardId ? `/cards/${cardId}` : "/cards", {
      method: cardId ? "PUT" : "POST",
      body: JSON.stringify(card),
    });
    state.currentCardId = data.card.cardId;
    updateCurrentCardSnapshot();
    elements.cardSetsInput.value = data.card.setCode || card.setCode || "DEFAULT";
    const imageStatus = data.card.imageKey ? " and uploaded PNG" : "";
    setSaveStatus(cardId ? `Saved changes${imageStatus}` : `Saved new design${imageStatus}`);
    await Promise.all([refreshSavedCards(), refreshCardSets()]);
    await refreshCardTemplates(data.card.setCode || card.setCode || "DEFAULT");
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
    rememberLastLoadedCardSelection(data.card.setCode || card.setCode || "DEFAULT", state.currentCardId);
    await refreshCardHistory(state.currentCardId, 3);
    return true;
  } catch (error) {
    setSaveStatus(error.message);
    options.onError?.(error);
    return false;
  }
}

/** Handles Save New, including duplicate-name decisions. */
async function saveNewCard() {
  const cardName = elements.nameInput.value.trim() || "Untitled Card";
  const resolveDuplicate = async (existingCard) => {
    const choice = await promptDuplicateSave(cardName, existingCard, async (newName) => {
      const originalName = elements.nameInput.value;
      let saveError = null;
      elements.nameInput.value = newName;
      syncCard();
      const saved = await saveCard("", { onError: (error) => { saveError = error; } });
      if (!saved) {
        elements.nameInput.value = originalName;
        syncCard();
      }
      return { saved, error: saveError };
    });
    if (choice === "update") {
      return saveCard(existingCard.cardId);
    }
    if (choice === "saved-copy") return true;
    return false;
  };

  const existingCard = findSavedCardByName(cardName);
  if (existingCard) return resolveDuplicate(existingCard);

  let saveError = null;
  const saved = await saveCard("", { onError: (error) => { saveError = error; } });
  if (saved || !/already exists/i.test(saveError?.message || "")) return saved;

  await refreshSavedCards();
  const newlyDetectedDuplicate = findSavedCardByName(cardName);
  if (newlyDetectedDuplicate) {
    return resolveDuplicate(newlyDetectedDuplicate);
  }

  setSaveStatus(saveError.message);
  return false;
}
/** Loads the selected saved-card dropdown item into the editor. */
async function loadSelectedCard(cardId = elements.savedCardsInput.value) {
  try {
    if (!cardId) throw new Error("Choose a saved card first.");

    elements.savedCardsInput.value = cardId;
    const data = await apiFetch(`/cards/${encodeURIComponent(cardId)}`);
    applyCardData(data.card);
    await refreshCardTemplates(data.card.setCode || "DEFAULT");
    clearNewCardRequest();
    await refreshCardHistory(data.card.cardId, 3);
    setSaveStatus("Loaded design");
  } catch (error) {
    setSaveStatus(error.message);
  }
}

/** Saves current edits when requested, then loads the newly selected saved card. */
async function handleSavedCardSelectionChange() {
  const selectedCardId = elements.savedCardsInput.value;
  if (!selectedCardId) return;

  if (hasUnsavedCardChanges()) {
    const shouldSave = await promptSaveUnsavedChanges();
    if (shouldSave) {
      const cardIdToSave = state.currentCardId;
      if (cardIdToSave) await saveCard(cardIdToSave);
      else await saveNewCard();
    }
  }

  elements.savedCardsInput.value = selectedCardId;
  await loadSelectedCard(selectedCardId);
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
          if (!renderer.applyCardData || !renderer.getCardPngDataUrl || !renderer.setArtSource || !renderer.setFrameSource || !renderer.setCardRenderTotal) {
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
async function fetchCardImageBlob(src) {
  const imageUrl = src.startsWith("/")
    ? `${backendConfig.apiUrl}${src}`
    : new URL(src, window.location.href).href;
  try {
    const directResponse = await fetch(imageUrl, {
      headers: imageUrl.startsWith(`${backendConfig.apiUrl}/`)
        ? { Authorization: `Bearer ${state.idToken}` }
        : {},
    });
    if (directResponse.ok) {
      const blob = await directResponse.blob();
      if (blob.type.startsWith("image/")) return blob;
    }
  } catch (error) {
    // Remote images may need the authenticated image proxy for CORS-safe rendering.
  }
  const proxyResponse = await fetch(
    `${backendConfig.apiUrl}/image-proxy?url=${encodeURIComponent(imageUrl)}`,
    { headers: { Authorization: `Bearer ${state.idToken}` } },
  );
  if (!proxyResponse.ok) throw new Error("Image could not be embedded in the PNG.");
  const blob = await proxyResponse.blob();
  if (!blob.type.startsWith("image/")) throw new Error("Image URL did not return an image.");
  return blob;
}

async function getEmbeddableImageSource(src) {
  if (!src || src.startsWith("data:")) return src;
  return readBlobAsDataUrl(await fetchCardImageBlob(src));
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
  await state.customFieldImageLoad;
  await state.setSymbolMaskLoad;
  await Promise.all(
    [...elements.card.querySelectorAll("img")]
      .filter((image) => image.src && !image.complete)
      .map((image) => image.decode().catch(() => {})),
  );
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
    renderer.applyCardData({ ...card, artUrl: "", frameUrl: "" });
    if (card.artUrl) await renderer.setArtSource(card.artUrl);
    if (card.frameUrl) await renderer.setFrameSource(card.frameUrl);
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
  elements.frameInput.addEventListener("change", loadFrame);
  elements.frameUrlInput.addEventListener("change", loadFrameUrl);
  elements.deleteFrameButton.addEventListener("click", deleteCurrentCardFrame);
  elements.viewAllCardHistoryButton.addEventListener("click", openCardHistoryDialog);
  elements.cardSetsInput.addEventListener("change", async () => {
    const setCode = elements.cardSetsInput.value || "DEFAULT";
    renderSavedCards();
    await refreshCardTemplates(setCode);
    updateMakeSetPublicButton();
    rememberLastLoadedCardSelection(setCode, "");
  });
  elements.makeSetPublicButton.addEventListener("click", makeSelectedSetPublic);
  elements.setInput.addEventListener("change", () => {
    elements.collectorInput.value = getNextCollectorNumber(elements.setInput.value || "DEFAULT");
    syncCard();
  });
  elements.addSetButton.addEventListener("click", openSetDialog);
  elements.viewSetsButton.addEventListener("click", openSetLibrary);
  elements.viewSetTemplatesButton.addEventListener("click", openTemplatesForSelectedSet);
  elements.cardTemplatesInput.addEventListener("change", handleTemplateSelectionChange);
  elements.templateStatInputs.addEventListener("input", syncCard);
  elements.templateCustomFields.addEventListener("input", syncCard);
  elements.templateCustomFields.addEventListener("change", syncCard);
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
  elements.homeButton.addEventListener("click", navigateHome);
  elements.exportPng.addEventListener("click", () => exportPng());
  accountAuth.attachEvents();
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
  elements.savedCardsInput.addEventListener("change", handleSavedCardSelectionChange);
  elements.previousCardButton.addEventListener("click", () => navigateToCard(-1));
  elements.nextCardButton.addEventListener("click", () => navigateToCard(1));
  elements.previewStage.addEventListener("touchstart", handlePreviewSwipeStart, { passive: true });
  elements.previewStage.addEventListener("touchend", handlePreviewSwipeEnd, { passive: true });
  elements.loadSavedButton.addEventListener("click", () => loadSelectedCard());
  elements.deleteSavedButton.addEventListener("click", deleteSelectedCard);
  window.addEventListener("resize", () => {
    fitCardName();
    fitRulesText();
    rememberCardRenderProfile();
  });
  window.addEventListener("pagehide", () => {
    for (const objectUrl of state.customFieldObjectUrls) URL.revokeObjectURL(objectUrl);
    state.customFieldObjectUrls = [];
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
  renderCardTemplates();
  renderCardHistory();
  updateAccountUi();
  if (state.refreshToken && (!state.idToken || isJwtExpired(state.idToken))) {
    await refreshAuthSession();
  }
  if (state.idToken && !isJwtExpired(state.idToken)) {
    setAuthStatus(state.email ? `Signed in as ${state.email}` : "Signed in from this tab session");
    await Promise.all([refreshImageGenerationSettings(), refreshSavedCards(), refreshCardSets(), refreshCardTemplates()]);
    if (!isRenderWorkspace) {
      if (!isNewCardRequest) await restoreLastLoadedCardSelection();
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
