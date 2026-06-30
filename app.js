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
};

function getRarityColor(rarity) {
  return rarityColors[rarity] || rarityColors.common || "currentColor";
}

function getRarityLabel(rarity) {
  return rarityLabels[rarity] || rarityLabels.common;
}

async function loadCardDefaults() {
  const response = await fetch("defaults/card-defaults.json");
  if (!response.ok) throw new Error("Card defaults failed to load.");

  defaults = await response.json();
}
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
function closeAccountMenu() {
  elements.accountMenu.classList.add("hidden");
  elements.accountMenuButton.setAttribute("aria-expanded", "false");
}

function updateAccountUi() {
  const signedIn = Boolean(state.idToken);
  elements.signInPanel.classList.toggle("hidden", signedIn);
  elements.signedInPanel.classList.toggle("hidden", !signedIn);
  elements.currentUserLabel.textContent = state.email || "Account";
  if (!signedIn) closeAccountMenu();
}

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

async function loadCardTypes() {
  const response = await fetch("defaults/card-types.json");
  if (!response.ok) throw new Error("Card type defaults failed to load.");

  standardTypes = await response.json();
}

function syncTypeMode() {
  const isCustom = elements.typeInput.value === "__custom";
  elements.customTypeLabel.classList.toggle("hidden", !isCustom);
}

function getSelectedType() {
  if (elements.typeInput.value === "__custom") {
    return elements.customTypeInput.value.trim();
  }

  return elements.typeInput.value.trim();
}

function isStatlessType(typeValue) {
  return statlessTypes.includes(String(typeValue || "").trim());
}

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
  updateText(elements.cardCollector, elements.collectorInput.value, "000/000");
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
function clearArt() {
  elements.art.removeAttribute("src");
  elements.artWindow.classList.remove("has-image");
}

function setArtSource(src, statusMessage = "") {
  const artUrl = String(src || "").trim();
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

  if (artUrl.startsWith("data:")) {
    elements.art.removeAttribute("crossorigin");
  } else {
    elements.art.crossOrigin = "anonymous";
  }
  elements.art.src = artUrl;
}

function loadArtUrl() {
  elements.artInput.value = "";
  setArtSource(elements.artUrlInput.value, "Image URL loaded");
}
function resetCard() {
  state.currentCardId = "";
  elements.nameInput.value = defaults.name;
  setTypeControl(defaults.type);
  elements.subtypeInput.value = defaults.subtype;
  elements.costInput.value = defaults.cost;
  elements.statModeInput.value = defaults.statMode;
  elements.attackInput.value = defaults.attack;
  elements.healthInput.value = defaults.health;
  elements.loyaltyInput.value = defaults.loyalty;
  elements.abilityInput.value = defaults.ability;
  elements.flavorInput.value = defaults.flavor;
  elements.artistInput.value = defaults.artist;
  elements.collectorInput.value = defaults.collector;
  elements.rarityInput.value = defaults.rarity;
  elements.fitInput.value = defaults.fit;
  elements.frameColor.value = defaults.frame;
  elements.accentColor.value = defaults.accent;
  elements.textColor.value = defaults.text;
  elements.panelColor.value = defaults.panel;
  elements.artInput.value = "";
  elements.artUrlInput.value = "";
  clearArt();
  syncCard();
}

function loadArt(event) {
  const [file] = event.target.files;
  if (!file) return;

  elements.artUrlInput.value = "";
  const reader = new FileReader();
  reader.addEventListener("load", () => {
    setArtSource(reader.result);
  });
  reader.readAsDataURL(file);
}

function collectCardData() {
  let artUrl = elements.art.src || "";
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
    abilities: elements.abilityInput.value,
    flavorText: elements.flavorInput.value,
    artistName: elements.artistInput.value.trim(),
    collectorNumber: elements.collectorInput.value.trim(),
    rarity: elements.rarityInput.value,
    colors: {
      frame: elements.frameColor.value,
      accent: elements.accentColor.value,
      text: elements.textColor.value,
      panel: elements.panelColor.value,
    },
  };
}

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
  elements.collectorInput.value = card.collectorNumber || "";
  elements.rarityInput.value = card.rarity || "common";
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

function getCredentials() {
  const email = elements.emailInput.value.trim();
  const password = elements.passwordInput.value;
  if (!email || !password) {
    throw new Error("Enter an email and password first.");
  }
  return { email, password };
}

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
    await refreshSavedCards();
  } catch (error) {
    setAuthStatus(error.message);
  }
}

function isJwtExpired(token) {
  if (!token) return true;

  try {
    const payload = JSON.parse(atob(token.split(".")[1]));
    return !payload.exp || payload.exp * 1000 <= Date.now();
  } catch (error) {
    return true;
  }
}

function clearAuthSession() {
  state.idToken = "";
  state.email = "";
  state.currentCardId = "";
  state.savedCards = [];
  sessionStorage.removeItem("cardDesignerIdToken");
  sessionStorage.removeItem("cardDesignerEmail");
  updateAccountUi();
  renderSavedCards();
}

function signOut() {
  clearAuthSession();
  setAuthStatus("Signed out");
  setSaveStatus("Sign in to save designs");
}

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

function renderSavedCards() {
  elements.savedCardsInput.innerHTML = "";
  if (!state.savedCards.length) {
    const option = document.createElement("option");
    option.value = "";
    option.textContent = state.idToken ? "No saved cards yet" : "Sign in to load cards";
    elements.savedCardsInput.append(option);
    return;
  }

  for (const card of state.savedCards) {
    const option = document.createElement("option");
    option.value = card.cardId;
    option.textContent = `${card.name || "Untitled Card"} (${card.collectorNumber || card.rarity || "saved"})`;
    elements.savedCardsInput.append(option);
  }
}

function normalizeCardName(name) {
  return String(name || "").trim().replace(/\s+/g, " ").toLowerCase();
}

function findSavedCardByName(name) {
  const normalizedName = normalizeCardName(name);
  return state.savedCards.find((card) => normalizeCardName(card.name) === normalizedName);
}

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

async function saveCard(cardId = "") {
  try {
    const card = collectCardData();
    const data = await apiFetch(cardId ? `/cards/${cardId}` : "/cards", {
      method: cardId ? "PUT" : "POST",
      body: JSON.stringify(card),
    });
    state.currentCardId = data.card.cardId;
    setSaveStatus(cardId ? "Saved changes" : "Saved new design");
    await refreshSavedCards();
    elements.savedCardsInput.value = state.currentCardId;
  } catch (error) {
    setSaveStatus(error.message);
  }
}

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

async function deleteSelectedCard() {
  try {
    const cardId = elements.savedCardsInput.value;
    if (!cardId) throw new Error("Choose a saved card first.");
    if (!window.confirm("Delete this saved design?")) return;

    await apiFetch(`/cards/${cardId}`, { method: "DELETE" });
    if (state.currentCardId === cardId) state.currentCardId = "";
    setSaveStatus("Deleted design");
    await refreshSavedCards();
  } catch (error) {
    setSaveStatus(error.message);
  }
}

function setCanvasFontToFit(ctx, text, fontTemplate, defaultSize, minSize, maxWidth) {
  let size = defaultSize;
  ctx.font = fontTemplate(size);

  while (ctx.measureText(text).width > maxWidth && size > minSize) {
    size = Math.max(minSize, size - 1);
    ctx.font = fontTemplate(size);
  }

  return size;
}
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
function drawFittedCardName(ctx, text, x, y, maxWidth) {
  const name = String(text || "Untitled Card");
  const size = setCanvasFontToFit(ctx, name, (fontSize) => `700 ${fontSize}px Georgia`, 26, 17, maxWidth);

  if (ctx.measureText(name).width <= maxWidth) {
    ctx.fillText(name, x, y, maxWidth);
    return;
  }

  drawWrappedText(ctx, name, x, y - 8, maxWidth, Math.ceil(size * 1.12), 2);
}
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

function getFittedTextSize(ctx, text, fontTemplate, defaultSize, minSize, maxWidth, maxLines) {
  let size = defaultSize;
  ctx.font = fontTemplate(size);

  while (countWrappedTextLines(ctx, text, maxWidth) > maxLines && size > minSize) {
    size = Math.max(minSize, size - 1);
    ctx.font = fontTemplate(size);
  }

  return size;
}
function roundRect(ctx, x, y, width, height, radius) {
  ctx.beginPath();
  ctx.moveTo(x + radius, y);
  ctx.arcTo(x + width, y, x + width, y + height, radius);
  ctx.arcTo(x + width, y + height, x, y + height, radius);
  ctx.arcTo(x, y + height, x, y, radius);
  ctx.arcTo(x, y, x + width, y, radius);
  ctx.closePath();
}

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

async function exportPng() {
  if (elements.art.src && !elements.art.complete) {
    await elements.art.decode().catch(() => {});
  }

  const scale = 3;
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
  ctx.fillText(elements.collectorInput.value || "000/000", 562, 868);
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

  const link = document.createElement("a");
  link.download = `${(elements.nameInput.value || "card").trim().replace(/\W+/g, "-").toLowerCase()}-front.png`;
  try {
    link.href = canvas.toDataURL("image/png");
    link.click();
  } catch (error) {
    setSaveStatus("PNG export failed because the image URL does not allow canvas export.");
  }
}

function attachEvents() {
  document.querySelectorAll("input, textarea, select").forEach((control) => {
    control.addEventListener("input", syncCard);
  });

  elements.artInput.addEventListener("change", loadArt);
  elements.artUrlInput.addEventListener("change", loadArtUrl);
  elements.resetCard.addEventListener("click", resetCard);
  elements.exportPng.addEventListener("click", () => exportPng());
  elements.signUpButton.addEventListener("click", signUp);
  elements.confirmButton.addEventListener("click", confirmAccount);
  elements.signInButton.addEventListener("click", signIn);
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

async function initialize() {
  try {
    await Promise.all([loadCardDefaults(), loadCardTypes(), loadRarityInfo()]);
  } catch (error) {
    setSaveStatus(error.message);
  }

  attachEvents();
  syncCard();
  renderSavedCards();
  updateAccountUi();
  if (state.idToken) {
    setAuthStatus(state.email ? `Signed in as ${state.email}` : "Signed in from this tab session");
    refreshSavedCards();
  } else if (sessionStorage.getItem("cardDesignerIdToken")) {
    clearAuthSession();
    setAuthStatus("Your session expired. Sign in again.");
  }
}

initialize();
