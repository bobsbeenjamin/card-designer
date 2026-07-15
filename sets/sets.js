const backendConfig = window.backendConfig;

const state = {
  idToken: getStoredIdToken(),
  email: sessionStorage.getItem("cardDesignerEmail") || "",
  savedCards: [],
  savedSets: [],
  libraryDraggedCardId: "",
  libraryDragMoved: false,
};

const elements = {
  authStatus: document.querySelector("#authStatus"),
  confirmDeleteSetButton: document.querySelector("#confirmDeleteSetButton"),
  deleteSetDialog: document.querySelector("#deleteSetDialog"),
  deleteSetMessage: document.querySelector("#deleteSetMessage"),
  deleteSetTitle: document.querySelector("#deleteSetTitle"),
  emailInput: document.querySelector("#emailInput"),
  passwordInput: document.querySelector("#passwordInput"),
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
  state.savedSets = getAvailableSets().map((cardSet) => {
    if ((cardSet.code || "DEFAULT") !== normalizedSetCode) return cardSet;
    return { ...cardSet, ...updatedSet, isPublic: true };
  });
  setStatus(`${updatedSet.code || normalizedSetCode} is public`);
  renderSetLibraryList();
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

/** Shows the set list view on the page. */
function renderSetLibraryList() {
  elements.setsTitle.textContent = "My Sets";
  elements.setsBackButton.classList.add("hidden");
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
    row.append(createSetPublicCheckbox(cardSet), renderSetSymbolPreview(cardSet), codeLink, name, createSetDeleteButton(cardSet));
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
  const cardSet = getAvailableSets().find((set) => (set.code || "DEFAULT") === setCode);
  const cards = getCardsInSet(setCode);
  elements.setsTitle.textContent = cardSet ? `${cardSet.code} - ${cardSet.name || "Untitled Set"}` : setCode;
  elements.setsBackButton.classList.remove("hidden");
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
