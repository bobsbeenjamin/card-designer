const backendConfig = window.backendConfig;
const STANDARD_CARD_DIMENSIONS = {
  widthInches: 2.5,
  heightInches: 3.5,
  widthMillimeters: 63,
  heightMillimeters: 88,
};
const SOLID_BLACK_CARD_BACK_URL = "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAIAAACQd1PeAAAADUlEQVR42mNkYGBgAAAABQABXvMqOgAAAABJRU5ErkJggg==";

const state = {
  idToken: getStoredIdToken(),
  email: sessionStorage.getItem("cardDesignerEmail") || "",
  savedCards: [],
  savedSets: [],
  libraryDraggedCardId: "",
  libraryDragMoved: false,
  currentSetCode: "",
  exportSetCode: "",
};

const elements = {
  authStatus: document.querySelector("#authStatus"),
  confirmDeleteSetButton: document.querySelector("#confirmDeleteSetButton"),
  deleteSetDialog: document.querySelector("#deleteSetDialog"),
  deleteSetMessage: document.querySelector("#deleteSetMessage"),
  deleteSetTitle: document.querySelector("#deleteSetTitle"),
  closeExportSetButton: document.querySelector("#closeExportSetButton"),
  closeExportSetXButton: document.querySelector("#closeExportSetXButton"),
  confirmExportSetButton: document.querySelector("#confirmExportSetButton"),
  emailInput: document.querySelector("#emailInput"),
  exportFormatInput: document.querySelector("#exportFormatInput"),
  exportSetDialog: document.querySelector("#exportSetDialog"),
  exportSetForm: document.querySelector("#exportSetForm"),
  exportSetStatus: document.querySelector("#exportSetStatus"),
  exportSetTitle: document.querySelector("#exportSetTitle"),
  passwordInput: document.querySelector("#passwordInput"),
  setDetailExportButton: document.querySelector("#setDetailExportButton"),
  setLibraryContent: document.querySelector("#setLibraryContent"),
  setsBackButton: document.querySelector("#setsBackButton"),
  setsPageContent: document.querySelector("#setsPageContent"),
  setsStatus: document.querySelector("#setsStatus"),
  setsTitle: document.querySelector("#setsTitle"),
  signInButton: document.querySelector("#signInButton"),
  signInPanel: document.querySelector("#signInPanel"),
};

function getStoredIdToken() {
  const token = sessionStorage.getItem("cardDesignerIdToken") || "";
  return isJwtExpired(token) ? "" : token;
}

/** Decodes a JWT payload for lightweight browser session checks. */
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

function isJwtExpired(token) {
  const payload = getJwtPayload(token);
  return !payload?.exp || payload.exp * 1000 <= Date.now();
}

function setStatus(message) {
  elements.setsStatus.textContent = message;
}

function setAuthStatus(message) {
  elements.authStatus.textContent = message;
}

/** Shows either the sign-in form or the signed-in sets page. */
function renderAuthUi() {
  const signedIn = Boolean(state.idToken);
  elements.signInPanel.classList.toggle("hidden", signedIn);
  elements.setsPageContent.classList.toggle("hidden", !signedIn);
  if (!signedIn) {
    elements.setsBackButton.classList.add("hidden");
    elements.setsTitle.textContent = "My Sets";
  }
}

/** Clears local auth/session state and page data. */
function clearAuthSession() {
  state.idToken = "";
  state.email = "";
  state.savedCards = [];
  state.savedSets = [];
  sessionStorage.removeItem("cardDesignerIdToken");
  sessionStorage.removeItem("cardDesignerEmail");
  renderAuthUi();
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

/** Calls the authenticated backend API and normalizes errors. */
async function apiFetch(path, options = {}) {
  if (!state.idToken || isJwtExpired(state.idToken)) {
    clearAuthSession();
    throw new Error("Your session expired. Sign in again to view your sets.");
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
    throw new Error("Your session expired. Sign in again to view your sets.");
  }

  if (!response.ok) {
    throw new Error(data.error || `API request failed with ${response.status}.`);
  }

  return data;
}

/** Signs in and loads the user's sets and cards. */
async function signIn() {
  try {
    const email = elements.emailInput.value.trim();
    const password = elements.passwordInput.value;
    if (!email || !password) throw new Error("Enter an email and password first.");

    const data = await cognitoRequest("InitiateAuth", {
      ClientId: backendConfig.userPoolClientId,
      AuthFlow: "USER_PASSWORD_AUTH",
      AuthParameters: { USERNAME: email, PASSWORD: password },
    });
    state.idToken = data.AuthenticationResult.IdToken;
    state.email = email;
    sessionStorage.setItem("cardDesignerIdToken", state.idToken);
    sessionStorage.setItem("cardDesignerEmail", state.email);
    elements.passwordInput.value = "";
    renderAuthUi();
    setAuthStatus(`Signed in as ${email}`);
    await refreshSetsAndCards();
  } catch (error) {
    setAuthStatus(error.message);
  }
}

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
  return Math.max(state.savedCards.filter((card) => (card.setCode || "DEFAULT") === (setCode || "DEFAULT")).length, 1);
}

function formatCollectorNumber(number, setCode) {
  return `${normalizeCollectorNumber(number)}/${getSetTotal(setCode)}`;
}

/** Returns the saved set list with a default fallback. */
function getAvailableSets() {
  return state.savedSets.length
    ? state.savedSets
    : [{ code: "DEFAULT", name: "Default", symbol: "", copyrightInfo: "" }];
}

/** Builds the symbol cell for a set row. */
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
      setStatus(error.message);
    }
  });
  return checkbox;
}

/** Makes a set public and refreshes the current view. */
async function makeSetPublic(setCode) {
  const normalizedSetCode = setCode || "DEFAULT";
  const data = await apiFetch(`/sets/${encodeURIComponent(normalizedSetCode)}/public`, { method: "PUT" });
  const updatedSet = data.set || { code: normalizedSetCode, isPublic: true };
  await refreshSetsAndCards(false);
  state.savedSets = getAvailableSets().map((cardSet) => {
    if ((cardSet.code || "DEFAULT") !== normalizedSetCode) return cardSet;
    return { ...cardSet, ...updatedSet, isPublic: true };
  });
  setStatus(`${updatedSet.code || normalizedSetCode} is public`);
  renderSetLibraryList();
}

/** Builds a Tabletop Simulator saved-object JSON document for a set deck. */
function buildTabletopSimulatorDeckJson(cardSet) {
  const cards = getExportCards(cardSet);
  if (!cards.length) throw new Error("This set has no cards to export.");

  const missingImages = cards.filter((card) => !getExportCardImageUrl(card));
  if (missingImages.length) {
    throw new Error("Export needs saved PNG images for every card in this set.");
  }

  const customDeck = {};
  const containedObjects = cards.map((card, index) => {
    const deckKey = String(index + 1);
    const cardId = (index + 1) * 100;
    customDeck[deckKey] = {
      FaceURL: getExportCardImageUrl(card),
      BackURL: SOLID_BLACK_CARD_BACK_URL,
      NumWidth: 1,
      NumHeight: 1,
      BackIsHidden: false,
      UniqueBack: false,
      Type: 0,
      CardWidth: STANDARD_CARD_DIMENSIONS.widthInches,
      CardHeight: STANDARD_CARD_DIMENSIONS.heightInches,
    };

    return {
      CardID: cardId,
      Name: "CardCustom",
      Nickname: card.name || "Untitled Card",
      Description: "",
      GMNotes: "",
      ColorDiffuse: { r: 0.713, g: 0.713, b: 0.713 },
      Locked: false,
      Grid: true,
      Snap: true,
      IgnoreFoW: false,
      MeasureMovement: false,
      DragSelectable: true,
      Autoraise: true,
      Sticky: true,
      Tooltip: true,
      GridProjection: false,
      HideWhenFaceDown: true,
      Hands: true,
    };
  });

  return {
    SaveName: `Card Designer - ${cardSet.name || cardSet.code || "Set"}`,
    CardDimensions: { ...STANDARD_CARD_DIMENSIONS, label: "Standard trading card / Magic: The Gathering" },
    CardBack: { color: "#000000", imageUrl: SOLID_BLACK_CARD_BACK_URL },
    GameMode: "",
    Gravity: 0.5,
    PlayArea: 0.5,
    Date: new Date().toISOString(),
    Table: "Table_RPG",
    Sky: "Sky_Museum",
    Note: "",
    Rules: "",
    XmlUI: "",
    LuaScript: "",
    LuaScriptState: "",
    ObjectStates: [
      {
        Name: "DeckCustom",
        Transform: { posX: 0, posY: 1, posZ: 0, rotX: 0, rotY: 180, rotZ: 0, scaleX: 1, scaleY: 1, scaleZ: 1 },
        Nickname: cardSet.name || cardSet.code || "Card Set",
        Description: "",
        GMNotes: "",
        AltLookAngle: { x: 0, y: 0, z: 0 },
        ColorDiffuse: { r: 0.713, g: 0.713, b: 0.713 },
        LayoutGroupSortIndex: 0,
        Value: 0,
        Locked: false,
        Grid: true,
        Snap: true,
        IgnoreFoW: false,
        MeasureMovement: false,
        DragSelectable: true,
        Autoraise: true,
        Sticky: true,
        Tooltip: true,
        GridProjection: false,
        HideWhenFaceDown: true,
        Hands: false,
        SidewaysCard: false,
        CardDimensions: { ...STANDARD_CARD_DIMENSIONS, label: "Standard trading card / Magic: The Gathering" },
        CardBack: { color: "#000000", imageUrl: SOLID_BLACK_CARD_BACK_URL },
        DeckIDs: containedObjects.map((card) => card.CardID),
        CustomDeck: customDeck,
        ContainedObjects: containedObjects,
        LuaScript: "",
        LuaScriptState: "",
      },
    ],
  };
}

function getExportCards(cardSet) {
  const setCode = cardSet.code || "DEFAULT";
  return getCardsInSet(setCode);
}

function getExportCardImageUrl(card) {
  return card.publicImageUrl || card.imageUrl || "";
}

/** Saves JSON with the browser save picker, falling back to a download link. */
async function saveJsonFile(fileName, jsonText) {
  const blob = new Blob([jsonText], { type: "application/json;charset=utf-8" });
  if (window.showSaveFilePicker) {
    const handle = await window.showSaveFilePicker({
      suggestedName: fileName,
      types: [{ description: "JSON files", accept: { "application/json": [".json"] } }],
    });
    const writable = await handle.createWritable();
    await writable.write(blob);
    await writable.close();
    return;
  }

  const link = document.createElement("a");
  const url = URL.createObjectURL(blob);
  link.href = url;
  link.download = fileName;
  document.body.append(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
}

/** Opens the export modal for a selected set. */
function openExportSetDialog(cardSet) {
  state.exportSetCode = cardSet.code || "DEFAULT";
  elements.exportSetTitle.textContent = `Export set ${cardSet.name || state.exportSetCode}`;
  elements.exportSetStatus.textContent = "";
  elements.exportFormatInput.value = "tabletop-simulator";
  elements.exportSetDialog.showModal();
}

/** Closes the export modal and clears transient export state. */
function closeExportSetDialog() {
  state.exportSetCode = "";
  elements.exportSetStatus.textContent = "";
  elements.exportSetDialog.close();
}

/** Exports the selected set using the selected export format. */
async function exportSelectedSet() {
  const cardSet = getAvailableSets().find((set) => (set.code || "DEFAULT") === state.exportSetCode);
  if (!cardSet) {
    elements.exportSetStatus.textContent = "Choose a set to export.";
    return;
  }

  try {
    elements.exportSetStatus.textContent = "Preparing export...";
    const exportData = buildTabletopSimulatorDeckJson(cardSet);
    const jsonText = JSON.stringify(exportData, null, 2);
    const fileName = `${getSafeFileName(cardSet.code || cardSet.name || "card-set")}-tabletop-simulator.json`;
    await saveJsonFile(fileName, jsonText);
    elements.exportSetStatus.textContent = "Export ready.";
  } catch (error) {
    if (error.name === "AbortError") {
      elements.exportSetStatus.textContent = "";
      return;
    }
    elements.exportSetStatus.textContent = error.message;
  }
}

function getSafeFileName(value, fallback = "card-set") {
  return String(value || fallback).trim().replace(/[^a-z0-9]+/gi, "-").replace(/^-+|-+$/g, "").toLowerCase() || fallback;
}

/** Creates the export button used to open the export modal. */
function createSetExportButton(cardSet) {
  const button = document.createElement("button");
  button.className = "set-export-button";
  button.type = "button";
  button.title = "Export this set";
  button.setAttribute("aria-label", `Export ${cardSet.name || cardSet.code || "set"}`);
  button.innerHTML = `
    <svg aria-hidden="true" focusable="false" viewBox="0 0 100 100">
      <path d="M14 20H52V32H26V74H74V58H86V86H14Z"></path>
      <path d="M45 58C50 40 62 29 76 26V13L96 34L76 55V42C65 43 55 48 45 58Z"></path>
    </svg>`;
  button.addEventListener("click", () => openExportSetDialog(cardSet));
  return button;
}

/** Builds the action buttons for a set row. */
function createSetActionButtons(cardSet) {
  const actions = document.createElement("div");
  actions.className = "set-row-actions";
  actions.append(createSetExportButton(cardSet), createSetDeleteButton(cardSet));
  return actions;
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

/** Shows the set list view on the page. */
function renderSetLibraryList() {
  state.currentSetCode = "";
  elements.setsTitle.textContent = "My Sets";
  elements.setsBackButton.classList.add("hidden");
  elements.setDetailExportButton.classList.add("hidden");
  elements.setLibraryContent.innerHTML = "";
  const list = document.createElement("div");
  list.className = "set-list";

  for (const cardSet of getAvailableSets()) {
    const row = document.createElement("div");
    row.className = "set-row";
    const code = cardSet.code || "DEFAULT";
    const codeLink = document.createElement("a");
    codeLink.href = `?set=${encodeURIComponent(code)}`;
    codeLink.textContent = code;
    codeLink.addEventListener("click", (event) => {
      event.preventDefault();
      renderSetCardGrid(code);
      window.history.replaceState({}, "", codeLink.href);
    });
    const name = document.createElement("strong");
    name.textContent = cardSet.name || "Untitled Set";
    row.append(createSetPublicCheckbox(cardSet), renderSetSymbolPreview(cardSet), codeLink, name, createSetActionButtons(cardSet));
    list.append(row);
  }

  elements.setLibraryContent.append(list);
  setStatus(getAvailableSets().length ? "" : "No sets saved yet.");
}

/** Asks for confirmation before deleting a set and its cards. */
function promptDeleteSet(cardSet) {
  const setCode = cardSet.code || "DEFAULT";
  if (setCode === "DEFAULT") {
    setStatus("The default set cannot be deleted.");
    return;
  }

  const setName = cardSet.name || setCode;
  elements.deleteSetTitle.textContent = `Are you sure you want to delete the "${setName}" set?`;
  elements.deleteSetMessage.textContent = "This action cannot be undone";
  elements.confirmDeleteSetButton.dataset.setCode = setCode;
  elements.deleteSetDialog.showModal();
}

/** Deletes a set, its cards, and then refreshes the page UI. */
async function deleteSet(setCode) {
  try {
    await apiFetch(`/sets/${encodeURIComponent(setCode)}`, { method: "DELETE" });
    await refreshSetsAndCards(false);
    renderSetLibraryList();
    window.history.replaceState({}, "", new URL("./", window.location.href));
    setStatus(`Deleted ${setCode} set`);
  } catch (error) {
    setStatus(error.message);
  }
}

/** Swaps a failed card thumbnail for an empty card frame. */
function replaceMissingLibraryImage(image, card) {
  const empty = document.createElement("div");
  empty.className = "library-card-empty";
  empty.textContent = card.name || "Untitled Card";
  (image.closest(".library-card-art-frame") || image).replaceWith(empty);
}

/** Builds a URL that opens a card in the main designer. */
function getDesignerCardUrl(cardId) {
  const designerUrl = new URL("../", window.location.href);
  designerUrl.searchParams.set("card", cardId);
  return designerUrl;
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
    window.location.href = getDesignerCardUrl(card.cardId);
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
  state.currentSetCode = setCode;
  const cardSet = getAvailableSets().find((set) => (set.code || "DEFAULT") === setCode);
  const cards = getCardsInSet(setCode);
  elements.setsTitle.textContent = cardSet ? `${cardSet.code} - ${cardSet.name || "Untitled Set"}` : setCode;
  elements.setsBackButton.classList.remove("hidden");
  elements.setDetailExportButton.classList.toggle("hidden", !cardSet);
  elements.setLibraryContent.innerHTML = "";

  const grid = document.createElement("div");
  grid.className = "card-library-grid";
  for (const card of cards) {
    grid.append(createLibraryCardTile(card, setCode));
  }

  elements.setLibraryContent.append(grid);
  setStatus(cards.length ? "" : "No saved cards in this set.");
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
    renderSetCardGrid(setCode);
    setStatus("Collector order saved");
  } catch (error) {
    setStatus(error.message);
    await refreshSetsAndCards(false);
    renderSetCardGrid(setCode);
  }
}

/** Loads set and card summaries from the backend. */
async function refreshSetsAndCards(renderInitialView = true) {
  setStatus("Loading your sets...");
  const [setsData, cardsData] = await Promise.all([apiFetch("/sets"), apiFetch("/cards")]);
  state.savedSets = setsData.sets || [];
  state.savedCards = cardsData.cards || [];
  if (!renderInitialView) return;

  const requestedSet = new URLSearchParams(window.location.search).get("set") || "";
  if (requestedSet) {
    renderSetCardGrid(requestedSet);
  } else {
    renderSetLibraryList();
  }
}

/** Registers page event handlers. */
function attachEvents() {
  elements.signInButton.addEventListener("click", signIn);
  elements.closeExportSetButton.addEventListener("click", closeExportSetDialog);
  elements.closeExportSetXButton.addEventListener("click", closeExportSetDialog);
  elements.confirmExportSetButton.addEventListener("click", exportSelectedSet);
  elements.exportSetForm.addEventListener("submit", (event) => event.preventDefault());
  elements.setDetailExportButton.addEventListener("click", () => {
    const cardSet = getAvailableSets().find((set) => (set.code || "DEFAULT") === state.currentSetCode);
    if (cardSet) openExportSetDialog(cardSet);
  });
  elements.setsBackButton.addEventListener("click", () => {
    renderSetLibraryList();
    window.history.replaceState({}, "", new URL("./", window.location.href));
  });
  elements.deleteSetDialog.addEventListener("close", () => {
    if (elements.deleteSetDialog.returnValue === "delete") {
      deleteSet(elements.confirmDeleteSetButton.dataset.setCode);
    }
    elements.confirmDeleteSetButton.dataset.setCode = "";
  });
}

/** Starts the standalone sets page. */
async function initialize() {
  attachEvents();
  renderAuthUi();
  if (!state.idToken && sessionStorage.getItem("cardDesignerIdToken")) {
    clearAuthSession();
    setAuthStatus("Your session expired. Sign in again.");
    return;
  }
  if (!state.idToken) return;

  setAuthStatus(state.email ? `Signed in as ${state.email}` : "Signed in from this tab session");
  try {
    await refreshSetsAndCards();
  } catch (error) {
    setStatus(error.message);
  }
}

initialize();
