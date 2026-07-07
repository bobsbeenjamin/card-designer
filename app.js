const backendConfig = window.backendConfig;

let defaults = {};
let rarityColors = {};
let rarityLabels = {};

function getStoredIdToken() {
  const token = sessionStorage.getItem("cardDesignerIdToken") || "";
  return isJwtExpired(token) ? "" : token;
}

const state = {
  idToken: getStoredIdToken(),
  email: sessionStorage.getItem("cardDesignerEmail") || "",
  currentCardId: "",
  savedCards: [],
  savedSets: [],
  artObjectUrl: "",
  artUrl: "",
  pendingArtUpload: null,
  libraryDraggedCardId: "",
  libraryDragMoved: false,
};

const elements = {
  card: document.querySelector("#card"),
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
  artInput: document.querySelector("#artInput"),
  artUrlInput: document.querySelector("#artUrlInput"),
  fitInput: document.querySelector("#fitInput"),
  frameColor: document.querySelector("#frameColor"),
  accentColor: document.querySelector("#accentColor"),
  textColor: document.querySelector("#textColor"),
  panelColor: document.querySelector("#panelColor"),
  emailInput: document.querySelector("#emailInput"),
  passwordInput: document.querySelector("#passwordInput"),
  signInPanel: document.querySelector("#signInPanel"),
  signedInPanel: document.querySelector("#signedInPanel"),
  aiSettingsPanel: document.querySelector("#aiSettingsPanel"),
  openAiKeyInput: document.querySelector("#openAiKeyInput"),
  saveOpenAiKeyButton: document.querySelector("#saveOpenAiKeyButton"),
  openAiKeyStatus: document.querySelector("#openAiKeyStatus"),
  mySetsPanel: document.querySelector("#mySetsPanel"),
  cardSetsInput: document.querySelector("#cardSetsInput"),
  addSetButton: document.querySelector("#addSetButton"),
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
};

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

function setAuthStatus(message) {
  elements.authStatus.textContent = message;
}

function setSaveStatus(message) {
  elements.saveStatus.textContent = message;
}

/** Shows a dismissible toast message for ten seconds. */
function showToast(message) {
  const toast = document.createElement("div");
  const closeButton = document.createElement("button");
  const messageText = document.createElement("p");
  let timeoutId = 0;

  toast.className = "toast-message";
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
    elements.openAiKeyInput.value = "";
    elements.openAiKeyStatus.textContent = "No OpenAI key saved";
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
  return formatCollectorNumber(elements.collectorInput.value, setCode, getPreviewSetTotal(setCode));
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
  updateText(elements.cardAbility, elements.abilityInput.value, "Add rules text.");
  updateText(elements.cardFlavor, elements.flavorInput.value, "");
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
  elements.art.style.objectFit = elements.fitInput.value;
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
  elements.artWindow.classList.remove("has-image");
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

  elements.art.onload = () => {
    elements.artWindow.classList.add("has-image");
    if (statusMessage) setSaveStatus(statusMessage);
  };
  elements.art.onerror = () => {
    clearArt();
    if (statusMessage) setSaveStatus("Image URL did not load as an image.");
  };

  elements.art.removeAttribute("crossorigin");
  if (artUrl.startsWith("data:")) {
    elements.art.src = artUrl;
    return;
  }

  try {
    const objectUrl = await getProxiedImageSource(artUrl);
    state.artObjectUrl = objectUrl;
    elements.art.src = objectUrl;
  } catch (error) {
    elements.art.src = artUrl;
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
    setSaveStatus("Generating image...");
    const data = await apiFetch("/art/generate", {
      method: "POST",
      body: JSON.stringify({
        cardName: elements.nameInput.value.trim() || "Untitled Card",
        flavorText: elements.flavorInput.value.trim(),
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
    setSaveStatus(error.message);
    showToast(error.message);
  } finally {
    elements.generateImageButton.disabled = false;
  }
}

/** Restores the editor to default card values. */
function resetCard() {
  state.currentCardId = "";
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
  reader.addEventListener("load", () => {
    state.pendingArtUpload = {
      dataUrl: reader.result,
      fileName: file.name,
      type: file.type,
    };
    setArtSource(reader.result);
  });
  reader.readAsDataURL(file);
}

/** Builds the card payload sent to the backend. */
function collectCardData() {
  let artUrl = state.artUrl || elements.art.src || "";
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

/** Loads whether the signed-in user has an OpenAI key stored. */
async function refreshOpenAiKeyStatus() {
  if (!state.idToken) return;
  try {
    const data = await apiFetch("/settings/openai-key");
    elements.openAiKeyStatus.textContent = data.configured ? "OpenAI key saved" : "No OpenAI key saved";
  } catch (error) {
    elements.openAiKeyStatus.textContent = error.message;
  }
}

/** Saves the signed-in user's OpenAI API key for image generation. */
async function saveOpenAiKey() {
  const apiKey = elements.openAiKeyInput.value.trim();
  if (!apiKey) {
    elements.openAiKeyStatus.textContent = "Enter an OpenAI API key first.";
    return;
  }

  try {
    await apiFetch("/settings/openai-key", {
      method: "PUT",
      body: JSON.stringify({ apiKey }),
    });
    elements.openAiKeyInput.value = "";
    elements.openAiKeyStatus.textContent = "OpenAI key saved";
  } catch (error) {
    elements.openAiKeyStatus.textContent = error.message;
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
    state.email = email;
    sessionStorage.setItem("cardDesignerIdToken", state.idToken);
    sessionStorage.setItem("cardDesignerEmail", state.email);
    elements.passwordInput.value = "";
    updateAccountUi();
    setAuthStatus(`Signed in as ${email}`);
    setSaveStatus("Loading saved designs...");
    await Promise.all([refreshSavedCards(), refreshCardSets(), refreshOpenAiKeyStatus()]);
  } catch (error) {
    setAuthStatus(error.message);
  }
}

/** Checks whether a JWT is absent, malformed, or expired. */
function isJwtExpired(token) {
  if (!token) return true;

  try {
    const payload = JSON.parse(atob(token.split(".")[1]));
    return !payload.exp || payload.exp * 1000 <= Date.now();
  } catch (error) {
    return true;
  }
}

/** Clears local auth/session state and saved library state. */
function clearAuthSession() {
  state.idToken = "";
  state.email = "";
  state.currentCardId = "";
  state.savedCards = [];
  state.savedSets = [];
  sessionStorage.removeItem("cardDesignerIdToken");
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
  if (!state.idToken || isJwtExpired(state.idToken)) {
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
  const sets = state.savedSets.length
    ? state.savedSets
    : [{ code: "DEFAULT", name: "Default", symbol: "", copyrightInfo: "" }];

  populateSetSelect(elements.cardSetsInput, sets, selectedFilterSetCode);
  populateSetSelect(elements.setInput, sets, selectedDesignSetCode);
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
    if (!code || !name) throw new Error("Enter a set code and name.");

    const data = await apiFetch("/sets", {
      method: "POST",
      body: JSON.stringify({ code, name, symbol, copyrightInfo }),
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

/** Creates the red trash button used to delete a set row. */
function createSetDeleteButton(cardSet) {
  const button = document.createElement("button");
  const setCode = cardSet.code || "DEFAULT";
  button.className = "set-delete-button";
  button.type = "button";
  button.disabled = setCode === "DEFAULT";
  button.setAttribute("aria-label", `Delete ${cardSet.name || setCode} set`);
  button.innerHTML = `
    <svg viewBox="0 0 24 24" fill="none" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
      <path d="M3 6h18"></path>
      <path d="M8 6V4h8v2"></path>
      <path d="M19 6l-1 14H6L5 6"></path>
      <path d="M10 11v5"></path>
      <path d="M14 11v5"></path>
    </svg>`;
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
    row.append(renderSetSymbolPreview(cardSet), codeLink, name, createSetDeleteButton(cardSet));
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
  image.replaceWith(empty);
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
    const image = document.createElement("img");
    image.className = "library-card-art";
    image.alt = card.name || "Saved card";
    image.src = card.imageUrl;
    image.addEventListener("error", () => replaceMissingLibraryImage(image, card));
    tile.append(image);
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

/** Loads set/card data and opens the fullscreen set library. */
async function openSetLibrary() {
  if (!state.idToken) {
    setSaveStatus("Sign in to view your sets.");
    return;
  }

  elements.setLibraryDialog.showModal();
  elements.setLibraryStatus.textContent = "Loading your sets...";
  elements.setLibraryContent.innerHTML = "";
  try {
    await Promise.all([refreshCardSets(), refreshSavedCards()]);
    renderSetLibraryList();
  } catch (error) {
    elements.setLibraryStatus.textContent = error.message;
  }
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
    setSaveStatus("Loaded design");
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

/** Saves or updates a card and uploads its rendered PNG. */
async function saveCard(cardId = "") {
  try {
    await savePendingArtForLater();
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
    elements.savedCardsInput.value = state.currentCardId;
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
    if (state.currentCardId === cardId) state.currentCardId = "";
    setSaveStatus("Deleted design");
    await Promise.all([refreshSavedCards(), refreshCardSets()]);
  } catch (error) {
    setSaveStatus(error.message);
  }
}

/**
 * Reduces a canvas font size until text fits the target width.
 * @param {*} ctx Canvas 2D rendering context.
 * @param {*} text Text to measure.
 * @param {*} fontTemplate Function that returns a font string for a size.
 * @param {*} defaultSize Starting font size in pixels.
 * @param {*} minSize Smallest allowed font size in pixels.
 * @param {*} maxWidth Maximum allowed text width.
 */
function setCanvasFontToFit(ctx, text, fontTemplate, defaultSize, minSize, maxWidth) {
  let size = defaultSize;
  ctx.font = fontTemplate(size);

  while (ctx.measureText(text).width > maxWidth && size > minSize) {
    size = Math.max(minSize, size - 1);
    ctx.font = fontTemplate(size);
  }

  return size;
}
/**
 * Splits a single long word into chunks that fit the canvas width.
 * @param {*} ctx Function argument.
 * @param {*} word Function argument.
 * @param {*} maxWidth Function argument.
 */
function splitLongCanvasWord(ctx, word, maxWidth) {
  const chunks = [];
  let remaining = word;

  while (remaining && ctx.measureText(remaining).width > maxWidth) {
    let length = remaining.length;
    while (length > 1 && ctx.measureText(remaining.slice(0, length)).width > maxWidth) {
      length -= 1;
    }
    chunks.push(remaining.slice(0, length));
    remaining = remaining.slice(length);
  }

  if (remaining) chunks.push(remaining);
  return chunks;
}
/**
 * Draws the card name on canvas with shrink-then-wrap behavior.
 * @param {*} ctx Canvas 2D rendering context.
 * @param {*} text Card name to draw.
 * @param {*} x Left drawing coordinate.
 * @param {*} y Baseline drawing coordinate.
 * @param {*} maxWidth Maximum text width.
 */
function drawFittedCardName(ctx, text, x, y, maxWidth) {
  const name = String(text || "Untitled Card");
  const size = setCanvasFontToFit(ctx, name, (fontSize) => `700 ${fontSize}px Georgia`, 26, 17, maxWidth);

  if (ctx.measureText(name).width <= maxWidth) {
    ctx.fillText(name, x, y, maxWidth);
    return;
  }

  drawWrappedText(ctx, name, x, y - 8, maxWidth, Math.ceil(size * 1.12), 2);
}
/**
 * Draws multiline wrapped canvas text with a maximum line count.
 * @param {*} ctx Canvas 2D rendering context.
 * @param {*} text Text to wrap and draw.
 * @param {*} x Left drawing coordinate.
 * @param {*} y First baseline coordinate.
 * @param {*} maxWidth Maximum line width.
 * @param {*} lineHeight Distance between baselines.
 * @param {*} maxLines Maximum lines to draw.
 */
function drawWrappedText(ctx, text, x, y, maxWidth, lineHeight, maxLines) {
  const paragraphs = String(text || "").split(/\r?\n/);
  let lineCount = 0;

  for (const paragraph of paragraphs) {
    const words = paragraph.split(/\s+/).filter(Boolean);
    let line = "";

    if (!words.length) {
      y += lineHeight;
      lineCount += 1;
      if (lineCount >= maxLines) return;
      continue;
    }

    for (const word of words) {
      if (ctx.measureText(word).width > maxWidth) {
        if (line) {
          ctx.fillText(line, x, y);
          y += lineHeight;
          lineCount += 1;
          if (lineCount >= maxLines) return;
          line = "";
        }

        for (const chunk of splitLongCanvasWord(ctx, word, maxWidth)) {
          ctx.fillText(chunk, x, y);
          y += lineHeight;
          lineCount += 1;
          if (lineCount >= maxLines) return;
        }
        continue;
      }

      const testLine = line ? `${line} ${word}` : word;
      if (ctx.measureText(testLine).width > maxWidth && line) {
        ctx.fillText(line, x, y);
        y += lineHeight;
        lineCount += 1;
        if (lineCount >= maxLines) return;
        line = word;
      } else {
        line = testLine;
      }
    }

    if (line) {
      ctx.fillText(line, x, y);
      y += lineHeight;
      lineCount += 1;
      if (lineCount >= maxLines) return;
    }
  }
}

/**
 * Counts wrapped canvas text lines without drawing them.
 * @param {*} ctx Function argument.
 * @param {*} text Function argument.
 * @param {*} maxWidth Function argument.
 */
function countWrappedTextLines(ctx, text, maxWidth) {
  const paragraphs = String(text || "").split(/\r?\n/);
  let lineCount = 0;

  for (const paragraph of paragraphs) {
    const words = paragraph.split(/\s+/).filter(Boolean);
    let line = "";

    if (!words.length) {
      lineCount += 1;
      continue;
    }

    for (const word of words) {
      if (ctx.measureText(word).width > maxWidth) {
        if (line) {
          lineCount += 1;
          line = "";
        }
        lineCount += splitLongCanvasWord(ctx, word, maxWidth).length;
        continue;
      }

      const testLine = line ? `${line} ${word}` : word;
      if (ctx.measureText(testLine).width > maxWidth && line) {
        lineCount += 1;
        line = word;
      } else {
        line = testLine;
      }
    }

    if (line) lineCount += 1;
  }

  return lineCount;
}

/**
 * Finds the largest canvas text size that fits a line limit.
 * @param {*} ctx Canvas 2D rendering context.
 * @param {*} text Text to measure.
 * @param {*} fontTemplate Function that returns a font string for a size.
 * @param {*} defaultSize Starting font size in pixels.
 * @param {*} minSize Smallest allowed font size in pixels.
 * @param {*} maxWidth Maximum line width.
 * @param {*} maxLines Maximum wrapped lines.
 */
function getFittedTextSize(ctx, text, fontTemplate, defaultSize, minSize, maxWidth, maxLines) {
  let size = defaultSize;
  ctx.font = fontTemplate(size);

  while (countWrappedTextLines(ctx, text, maxWidth) > maxLines && size > minSize) {
    size = Math.max(minSize, size - 1);
    ctx.font = fontTemplate(size);
  }

  return size;
}
/**
 * Adds a rounded rectangle path to the canvas context.
 * @param {*} ctx Canvas 2D rendering context.
 * @param {*} x Left coordinate.
 * @param {*} y Top coordinate.
 * @param {*} width Rectangle width.
 * @param {*} height Rectangle height.
 * @param {*} radius Corner radius.
 */
function roundRect(ctx, x, y, width, height, radius) {
  ctx.beginPath();
  ctx.moveTo(x + radius, y);
  ctx.arcTo(x + width, y, x + width, y + height, radius);
  ctx.arcTo(x + width, y + height, x, y + height, radius);
  ctx.arcTo(x, y + height, x, y, radius);
  ctx.arcTo(x, y, x + width, y, radius);
  ctx.closePath();
}

/**
 * Draws an image into a canvas box using the selected fit mode.
 * @param {*} ctx Canvas 2D rendering context.
 * @param {*} image Image element to draw.
 * @param {*} x Left coordinate.
 * @param {*} y Top coordinate.
 * @param {*} width Target width.
 * @param {*} height Target height.
 * @param {*} fit Image fit mode.
 */
function drawImageFit(ctx, image, x, y, width, height, fit) {
  if (fit === "fill") {
    ctx.drawImage(image, x, y, width, height);
    return;
  }

  const imageRatio = image.naturalWidth / image.naturalHeight;
  const targetRatio = width / height;
  const shouldCover = fit === "cover";
  const useWidth = shouldCover ? imageRatio < targetRatio : imageRatio > targetRatio;
  const drawWidth = useWidth ? width : height * imageRatio;
  const drawHeight = useWidth ? width / imageRatio : height;
  const drawX = x + (width - drawWidth) / 2;
  const drawY = y + (height - drawHeight) / 2;

  ctx.drawImage(image, drawX, drawY, drawWidth, drawHeight);
}

/** Renders the current card front to a canvas. */
async function createCardCanvas(scale = 3) {
  if (elements.art.src && !elements.art.complete) {
    await elements.art.decode().catch(() => {});
  }

  const width = 630;
  const height = 880;
  const subtype = elements.subtypeInput.value.trim();
  const typeValue = getSelectedType();
  const typeLine = subtype ? `${typeValue || "Card"} - ${subtype}` : typeValue || "Card";
  const rarity = elements.rarityInput.value;
  const isStatless = isStatlessType(typeValue);
  const statMode = ["combat", "loyalty"].includes(elements.statModeInput.value)
    ? elements.statModeInput.value
    : "combat";
  const isLoyalty = !isStatless && statMode === "loyalty";
  const canvas = document.createElement("canvas");
  canvas.width = width * scale;
  canvas.height = height * scale;
  const ctx = canvas.getContext("2d");
  ctx.scale(scale, scale);

  ctx.fillStyle = elements.frameColor.value;
  roundRect(ctx, 0, 0, width, height, 32);
  ctx.fill();

  ctx.strokeStyle = elements.accentColor.value;
  ctx.lineWidth = 8;
  roundRect(ctx, 28, 28, width - 56, height - 56, 18);
  ctx.stroke();

  ctx.fillStyle = elements.textColor.value;
  const cardName = elements.nameInput.value || "Untitled Card";
  drawFittedCardName(ctx, cardName, 48, 76, 474);
  ctx.font = "700 20px system-ui";
  ctx.fillText(typeLine, 48, 116, 474);

  ctx.fillStyle = elements.accentColor.value;
  ctx.beginPath();
  ctx.arc(550, 102, 28, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = "#191510";
  ctx.font = "900 26px system-ui";
  ctx.textAlign = "center";
  ctx.fillText(formatCost(elements.costInput.value), 550, 111);
  ctx.textAlign = "left";

  const boxX = 48;
  const boxWidth = 534;
  const boxHeight = 284;
  const artY = 148;
  const rulesY = artY + boxHeight + 24;

  ctx.save();
  roundRect(ctx, boxX, artY, boxWidth, boxHeight, 14);
  ctx.clip();
  if (elements.art.src) {
    drawImageFit(ctx, elements.art, boxX, artY, boxWidth, boxHeight, elements.fitInput.value);
  } else {
    const gradient = ctx.createLinearGradient(boxX, artY, boxX + boxWidth, artY + boxHeight);
    gradient.addColorStop(0, elements.accentColor.value);
    gradient.addColorStop(1, "#35473d");
    ctx.fillStyle = gradient;
    ctx.fillRect(boxX, artY, boxWidth, boxHeight);
    ctx.fillStyle = "rgba(255,255,255,0.72)";
    ctx.font = "900 72px system-ui";
    ctx.textAlign = "center";
    ctx.fillText("ART", boxX + boxWidth / 2, artY + boxHeight / 2 + 24);
    ctx.textAlign = "left";
  }
  ctx.restore();

  ctx.save();
  ctx.fillStyle = elements.panelColor.value;
  roundRect(ctx, boxX, rulesY, boxWidth, boxHeight, 14);
  ctx.fill();
  const rulesTextWidth = isStatless ? 494 : 330;
  const abilityText = elements.abilityInput.value || "Add rules text.";
  const flavorText = elements.flavorInput.value;
  const abilityMaxLines = flavorText ? 3 : 6;
  const flavorMaxLines = 3;
  const abilitySize = getFittedTextSize(ctx, abilityText, (size) => `${size}px system-ui`, 26, 12, rulesTextWidth, abilityMaxLines);
  const flavorSize = getFittedTextSize(ctx, flavorText, (size) => `italic ${size}px Georgia`, 22, 10, rulesTextWidth, flavorMaxLines);
  ctx.fillStyle = "#242014";
  ctx.font = `${abilitySize}px system-ui`;
  drawWrappedText(ctx, abilityText, 68, rulesY + 47, rulesTextWidth, Math.ceil(abilitySize * 1.31), abilityMaxLines);
  ctx.strokeStyle = "rgba(0,0,0,0.2)";
  ctx.beginPath();
  ctx.moveTo(68, rulesY + 150);
  ctx.lineTo(562, rulesY + 150);
  ctx.stroke();
  ctx.fillStyle = "#66573b";
  ctx.font = `italic ${flavorSize}px Georgia`;
  drawWrappedText(ctx, flavorText, 68, rulesY + 188, rulesTextWidth, Math.ceil(flavorSize * 1.32), flavorMaxLines);
  ctx.restore();

  ctx.save();
  ctx.translate(62, 862);
  ctx.rotate(Math.PI / 4);
  ctx.fillStyle = getRarityColor(rarity);
  ctx.fillRect(-9, -9, 18, 18);
  ctx.restore();
  ctx.fillStyle = elements.textColor.value;
  ctx.font = "700 15px system-ui";
  ctx.fillText(getRarityLabel(rarity), 84, 868);
  ctx.fillText(`Art: ${elements.artistInput.value || "Unknown"}`, 162, 868);
  ctx.textAlign = "right";
  ctx.fillText(formatPreviewCollectorNumber(), 562, 868);
  ctx.textAlign = "left";

  if (!isStatless) {
    ctx.fillStyle = "rgba(0,0,0,0.22)";
    if (isLoyalty) {
      roundRect(ctx, 430, 699, 134, 54, 27);
      ctx.fill();
    } else {
      roundRect(ctx, 384, 699, 82, 54, 27);
      ctx.fill();
      roundRect(ctx, 482, 699, 82, 54, 27);
      ctx.fill();
    }

    ctx.fillStyle = elements.textColor.value;
    if (isLoyalty) {
      ctx.font = "900 15px system-ui";
      ctx.fillText("LOYALTY", 448, 732);
      ctx.font = "900 30px system-ui";
      ctx.fillText(elements.loyaltyInput.value || "0", 528, 735);
    } else {
      ctx.font = "900 18px system-ui";
      ctx.fillText("ATK", 401, 732);
      ctx.fillText("HP", 502, 732);
      ctx.font = "900 30px system-ui";
      ctx.fillText(elements.attackInput.value || "0", 441, 735);
      ctx.fillText(elements.healthInput.value || "0", 538, 735);
    }
  }

  return canvas;
}

/** Creates the PNG data URL sent to the backend. */
async function getCardPngDataUrl() {
  const canvas = await createCardCanvas(2);
  try {
    return canvas.toDataURL("image/png");
  } catch (error) {
    throw new Error("Card image could not be saved because the image URL does not allow canvas export.");
  }
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
    setSaveStatus("PNG export failed because the image URL does not allow canvas export.");
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
  elements.cardSetsInput.addEventListener("change", renderSavedCards);
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
  elements.saveOpenAiKeyButton.addEventListener("click", saveOpenAiKey);
  elements.accountMenuButton.addEventListener("click", toggleAccountMenu);
  elements.signOutButton.addEventListener("click", signOut);
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
  });
}

/** Loads defaults and starts the app. */
async function initialize() {
  try {
    await Promise.all([loadCardDefaults(), loadCardTypes(), loadRarityInfo()]);
  } catch (error) {
    setSaveStatus(error.message);
  }

  attachEvents();
  syncCard();
  renderSavedCards();
  renderCardSets();
  updateAccountUi();
  if (state.idToken) {
    setAuthStatus(state.email ? `Signed in as ${state.email}` : "Signed in from this tab session");
    refreshOpenAiKeyStatus();
    refreshSavedCards();
    refreshCardSets();
  } else if (sessionStorage.getItem("cardDesignerIdToken")) {
    clearAuthSession();
    setAuthStatus("Your session expired. Sign in again.");
  }
}

initialize();
