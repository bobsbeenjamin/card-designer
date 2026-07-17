const backendConfig = window.backendConfig;
const STANDARD_CARD_DIMENSIONS = {
  widthInches: 2.5,
  heightInches: 3.5,
  widthMillimeters: 63,
  heightMillimeters: 88,
};
const SOLID_BLACK_CARD_BACK_URL = "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAIAAACQd1PeAAAADUlEQVR42mNkYGBgAAAABQABXvMqOgAAAABJRU5ErkJggg==";

const generateArtCanceledMessage = "Art generation was canceled.";
const imageProviderStorageKey = "cardDesignerImageProvider";
const imageProviders = new Set([
  "openai",
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
  idToken: getStoredIdToken(),
  refreshToken: getStoredRefreshToken(),
  email: sessionStorage.getItem("cardDesignerEmail") || "",
  savedCards: [],
  savedSets: [],
  libraryDraggedCardId: "",
  libraryDragMoved: false,
  currentSetCode: "",
  exportSetCode: "",
  renameSetCode: "",
  sharePreflightKey: "",
  cardRendererReadyPromise: null,
  generateArtAbortController: null,
  generateArtCanceled: false,
  generateArtPaused: false,
  generateArtResumeResolver: null,
  generateArtRunning: false,
};

const elements = {
  acceptIncomingShareButton: document.querySelector("#acceptIncomingShareButton"),
  authStatus: document.querySelector("#authStatus"),
  cancelRenameSetButton: document.querySelector("#cancelRenameSetButton"),
  confirmDeleteSetButton: document.querySelector("#confirmDeleteSetButton"),
  confirmRenameSetButton: document.querySelector("#confirmRenameSetButton"),
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
  exportSetSubtitle: document.querySelector("#exportSetSubtitle"),
  exportSetPublicInput: document.querySelector("#exportSetPublicInput"),
  exportSetPublicLabel: document.querySelector("#exportSetPublicLabel"),
  exportSetTitle: document.querySelector("#exportSetTitle"),
  generateArtButton: document.querySelector("#generateArtButton"),
  generateArtDialog: document.querySelector("#generateArtDialog"),
  closeGenerateArtButton: document.querySelector("#closeGenerateArtButton"),
  confirmGenerateArtButton: document.querySelector("#confirmGenerateArtButton"),
  cancelGenerateArtButton: document.querySelector("#cancelGenerateArtButton"),
  generateArtStatus: document.querySelector("#generateArtStatus"),
  cardRenderFrame: document.querySelector("#cardRenderFrame"),
  incomingShareDialog: document.querySelector("#incomingShareDialog"),
  incomingShareForm: document.querySelector("#incomingShareForm"),
  incomingShareMessage: document.querySelector("#incomingShareMessage"),
  incomingShareCodeChoice: document.querySelector("#incomingShareCodeChoice"),
  incomingShareCodeChoiceText: document.querySelector("#incomingShareCodeChoiceText"),
  incomingShareCodeResolution: document.querySelector("#incomingShareCodeResolution"),
  incomingShareNameChoice: document.querySelector("#incomingShareNameChoice"),
  incomingShareNameChoiceText: document.querySelector("#incomingShareNameChoiceText"),
  incomingShareNameResolution: document.querySelector("#incomingShareNameResolution"),
  incomingShareTitle: document.querySelector("#incomingShareTitle"),
  passwordInput: document.querySelector("#passwordInput"),
  rejectIncomingShareButton: document.querySelector("#rejectIncomingShareButton"),
  renameSetDialog: document.querySelector("#renameSetDialog"),
  renameSetForm: document.querySelector("#renameSetForm"),
  renameSetNameInput: document.querySelector("#renameSetNameInput"),
  renameSetStatus: document.querySelector("#renameSetStatus"),
  shareRecipientEmailInput: document.querySelector("#shareRecipientEmailInput"),
  shareRecipientEmailLabel: document.querySelector("#shareRecipientEmailLabel"),
  setDetailExportButton: document.querySelector("#setDetailExportButton"),
  setDetailRenameButton: document.querySelector("#setDetailRenameButton"),
  setLibraryContent: document.querySelector("#setLibraryContent"),
  setsCloseButton: document.querySelector("#setsCloseButton"),
  setsPageContent: document.querySelector("#setsPageContent"),
  setsStatus: document.querySelector("#setsStatus"),
  toastRegion: document.querySelector("#toastRegion"),
  setsTitle: document.querySelector("#setsTitle"),
  signInButton: document.querySelector("#signInButton"),
  signInPanel: document.querySelector("#signInPanel"),
};

const setSharing = createSetSharingController({
  elements,
  state,
  apiFetch,
  setStatus,
  showToast,
  refreshAfterResponse: refreshSetsAndCards,
  skipIfDialogOpen: true,
});

function getStoredIdToken() {
  return sessionStorage.getItem("cardDesignerIdToken") || "";
}

/** Returns the refresh token saved for the current browser session. */
function getStoredRefreshToken() {
  return sessionStorage.getItem("cardDesignerRefreshToken") || "";
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

function setStatus(message) {
  elements.setsStatus.textContent = message;
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

function setAuthStatus(message) {
  elements.authStatus.textContent = message;
}

/** Shows either the sign-in form or the signed-in sets page. */
function renderAuthUi() {
  const signedIn = Boolean(state.idToken);
  elements.signInPanel.classList.toggle("hidden", signedIn);
  elements.setsPageContent.classList.toggle("hidden", !signedIn);
  if (!signedIn) {
    elements.setsTitle.textContent = "My Sets";
  }
}

/** Clears local auth/session state and page data. */
function clearAuthSession() {
  state.idToken = "";
  state.refreshToken = "";
  state.email = "";
  state.savedCards = [];
  state.savedSets = [];
  sessionStorage.removeItem("cardDesignerIdToken");
  sessionStorage.removeItem("cardDesignerRefreshToken");
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
  if (!state.idToken || (isJwtExpired(state.idToken) && !(await refreshAuthSession()))) {
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
    state.refreshToken = data.AuthenticationResult.RefreshToken || state.refreshToken;
    state.email = email;
    sessionStorage.setItem("cardDesignerIdToken", state.idToken);
    sessionStorage.setItem("cardDesignerRefreshToken", state.refreshToken);
    sessionStorage.setItem("cardDesignerEmail", state.email);
    elements.passwordInput.value = "";
    renderAuthUi();
    setAuthStatus(`Signed in as ${email}`);
    await refreshSetsAndCards();
    await setSharing.checkSetShareResponses();
    await setSharing.checkIncomingSetShares();
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

/** Updates Generate Art modal buttons for the current batch state. */
function syncGenerateArtControls() {
  elements.confirmGenerateArtButton.disabled = false;
  elements.cancelGenerateArtButton.disabled = false;
  elements.closeGenerateArtButton.disabled = false;
  if (!state.generateArtRunning) {
    elements.confirmGenerateArtButton.textContent = "Generate Art";
    return;
  }

  elements.confirmGenerateArtButton.textContent = state.generateArtPaused ? "Resume" : "Pause";
}

/** Opens the Generate Art modal. */
function openGenerateArtDialog() {
  if (!state.generateArtRunning) {
    elements.generateArtStatus.textContent = "";
    state.generateArtCanceled = false;
    state.generateArtPaused = false;
  }
  syncGenerateArtControls();
  elements.generateArtDialog.showModal();
}

/** Closes the Generate Art modal without changing the current workflow. */
function closeGenerateArtDialog() {
  elements.generateArtDialog.close();
}

/** Resolves a paused Generate Art workflow so it can continue or stop. */
function resolveGenerateArtPause() {
  if (!state.generateArtResumeResolver) return;
  state.generateArtResumeResolver();
  state.generateArtResumeResolver = null;
}

/** Returns true for intentional Generate Art cancellation errors. */
function isGenerateArtCanceledError(error) {
  return state.generateArtCanceled || error?.name === "AbortError" || error?.message === generateArtCanceledMessage;
}

/** Throws when the current Generate Art workflow has been canceled. */
function throwIfGenerateArtCanceled() {
  if (state.generateArtCanceled) throw new Error(generateArtCanceledMessage);
}

/** Waits while the Generate Art workflow is paused between cards. */
async function waitForGenerateArtResume() {
  throwIfGenerateArtCanceled();
  if (!state.generateArtPaused) return;

  elements.generateArtStatus.textContent = "Paused. Press Resume to continue.";
  await new Promise((resolve) => {
    state.generateArtResumeResolver = resolve;
  });
  throwIfGenerateArtCanceled();
}

/** Toggles the Generate Art workflow between paused and running. */
function toggleGenerateArtPause() {
  if (!state.generateArtRunning) {
    generateMissingSetArt();
    return;
  }

  state.generateArtPaused = !state.generateArtPaused;
  if (state.generateArtPaused) {
    elements.generateArtStatus.textContent = "Paused. The current card will finish before the next one starts.";
  } else {
    elements.generateArtStatus.textContent = "Resuming art generation...";
    resolveGenerateArtPause();
  }
  syncGenerateArtControls();
}

/** Cancels the Generate Art workflow and closes the modal. */
function cancelGenerateArtWorkflow() {
  if (state.generateArtRunning) {
    state.generateArtCanceled = true;
    state.generateArtPaused = false;
    state.generateArtAbortController?.abort();
    resolveGenerateArtPause();
  }
  closeGenerateArtDialog();
  syncGenerateArtControls();
}

/** Resets Generate Art workflow state after it finishes or stops. */
function finishGenerateArtWorkflow() {
  state.generateArtAbortController = null;
  state.generateArtCanceled = false;
  state.generateArtPaused = false;
  state.generateArtResumeResolver = null;
  state.generateArtRunning = false;
  syncGenerateArtControls();
}

/** Returns the locally selected image provider when one has been chosen. */
function getSelectedImageProvider() {
  try {
    const provider = localStorage.getItem(imageProviderStorageKey) || "";
    return imageProviders.has(provider) ? provider : "";
  } catch (error) {
    return "";
  }
}

/** Converts an app-relative art response into the URL saved on cards. */
function getFullArtUrl(artUrl) {
  if (!artUrl) return "";
  return artUrl.startsWith("http") ? artUrl : `${backendConfig.apiUrl}${artUrl}`;
}

/** Waits for the hidden designer iframe to expose its rendering API. */
async function getCardRendererWindow() {
  if (!state.cardRendererReadyPromise) {
    state.cardRendererReadyPromise = new Promise((resolve, reject) => {
      const frame = elements.cardRenderFrame;
      const finishLoading = async () => {
        try {
          const renderer = frame.contentWindow;
          if (!renderer) throw new Error("Card renderer is unavailable.");
          if (renderer.cardDesignerReady) await renderer.cardDesignerReady;
          if (!renderer.applyCardData || !renderer.setArtSource || !renderer.getCardPngDataUrl) {
            throw new Error("Card renderer did not finish loading.");
          }
          resolve(renderer);
        } catch (error) {
          reject(error);
        }
      };

      frame.addEventListener("load", finishLoading, { once: true });
      frame.addEventListener("error", () => reject(new Error("Card renderer failed to load.")), { once: true });
      if (!frame.getAttribute("src")) frame.src = "../?render=card";
    });
  }

  return state.cardRendererReadyPromise;
}

/** Renders an updated card through the main designer preview. */
async function renderUpdatedCardPng(card) {
  const renderer = await getCardRendererWindow();
  renderer.applyCardData(card);
  if (card.artUrl) await renderer.setArtSource(card.artUrl);
  renderer.syncCard();
  return renderer.getCardPngDataUrl();
}

/** Loads full card records for a set because summaries do not include art URLs. */
async function getFullCardsInSet(setCode, signal) {
  const cardSummaries = getCardsInSet(setCode);
  const cardResponses = await Promise.all(
    cardSummaries.map((card) => apiFetch(`/cards/${encodeURIComponent(card.cardId)}`, { signal })),
  );
  return cardResponses.map((response) => response.card).filter(Boolean);
}

/** Generates and stores art for a single missing-art card. */
async function generateAndSaveCardArt(card, provider, signal) {
  const generationBody = {
    cardName: card.name || "Untitled Card",
    flavorText: card.flavorText || "",
    setCode: card.setCode || state.currentSetCode || "DEFAULT",
  };
  if (provider) generationBody.provider = provider;

  const generatedArt = await apiFetch("/art/generate", {
    method: "POST",
    signal,
    body: JSON.stringify(generationBody),
  });
  throwIfGenerateArtCanceled();
  const updatedCard = { ...card, artUrl: getFullArtUrl(generatedArt.artUrl) };
  updatedCard.cardImagePng = await renderUpdatedCardPng(updatedCard);
  throwIfGenerateArtCanceled();

  const data = await apiFetch(`/cards/${encodeURIComponent(card.cardId)}`, {
    method: "PUT",
    signal,
    body: JSON.stringify(updatedCard),
  });
  return data.card || updatedCard;
}

/** Fills in AI art for each card in the current set that has no Image URL. */
async function generateMissingSetArt() {
  if (state.generateArtRunning) return;

  const setCode = state.currentSetCode || "DEFAULT";
  state.generateArtAbortController = new AbortController();
  state.generateArtCanceled = false;
  state.generateArtPaused = false;
  state.generateArtRunning = true;
  syncGenerateArtControls();

  try {
    elements.generateArtStatus.textContent = "Checking cards for missing art...";
    const cardsMissingArt = (await getFullCardsInSet(setCode, state.generateArtAbortController.signal)).filter((card) => !String(card.artUrl || "").trim());
    throwIfGenerateArtCanceled();
    if (!cardsMissingArt.length) {
      elements.generateArtStatus.textContent = "Every card in this set already has art.";
      return;
    }

    const provider = getSelectedImageProvider();
    for (const [index, card] of cardsMissingArt.entries()) {
      await waitForGenerateArtResume();
      elements.generateArtStatus.textContent = `Generating ${index + 1} of ${cardsMissingArt.length}: ${card.name || "Untitled Card"}`;
      const savedCard = await generateAndSaveCardArt(card, provider, state.generateArtAbortController.signal);
      const currentCard = state.savedCards.find((saved) => saved.cardId === savedCard.cardId);
      if (currentCard) Object.assign(currentCard, savedCard);
    }

    await refreshSetsAndCards(false);
    throwIfGenerateArtCanceled();
    renderSetCardGrid(setCode);
    closeGenerateArtDialog();
    showToast(`Generated art for ${cardsMissingArt.length} card${cardsMissingArt.length === 1 ? "" : "s"}.`, "info");
  } catch (error) {
    if (!isGenerateArtCanceledError(error)) {
      elements.generateArtStatus.textContent = "Art generation stopped. See the error popup for details.";
      showToast(error.message);
    }
  } finally {
    finishGenerateArtWorkflow();
  }
}

/** Opens the export modal for a selected set. */
function openExportSetDialog(cardSet) {
  state.exportSetCode = cardSet.code || "DEFAULT";
  state.sharePreflightKey = "";
  elements.exportSetTitle.textContent = "Share and Export";
  elements.exportSetSubtitle.textContent = `${state.exportSetCode} - ${cardSet.name || "Untitled Set"}`;
  elements.exportSetStatus.textContent = "";
  elements.exportFormatInput.value = "tabletop-simulator";
  elements.shareRecipientEmailInput.value = "";
  syncExportFormatUi();
  syncExportPublicUi();
  elements.exportSetDialog.showModal();
}

/** Updates the export dialog's one-way public visibility control. */
function syncExportPublicUi() {
  const cardSet = getAvailableSets().find((set) => (set.code || "DEFAULT") === state.exportSetCode);
  const isPublic = Boolean(cardSet?.isPublic);
  elements.exportSetPublicInput.checked = isPublic;
  elements.exportSetPublicInput.disabled = isPublic;
  elements.exportSetPublicLabel.textContent = isPublic
    ? "This set is marked public"
    : "Check this box to make the set public";
}

/** Makes the selected export set public when its checkbox is checked. */
async function handleExportPublicChange() {
  if (!elements.exportSetPublicInput.checked) {
    syncExportPublicUi();
    return;
  }

  elements.exportSetPublicInput.disabled = true;
  try {
    await makeSetPublic(state.exportSetCode);
    syncExportPublicUi();
  } catch (error) {
    elements.exportSetStatus.textContent = error.message;
    syncExportPublicUi();
  }
}

/** Closes the export modal and clears transient export state. */
function closeExportSetDialog() {
  state.exportSetCode = "";
  state.sharePreflightKey = "";
  elements.exportSetSubtitle.textContent = "";
  elements.exportSetStatus.textContent = "";
  elements.shareRecipientEmailInput.value = "";
  syncExportFormatUi();
  elements.exportSetDialog.close();
}

function syncExportFormatUi() {
  const isShareExport = elements.exportFormatInput.value === "share-edit-copy";
  elements.shareRecipientEmailLabel.classList.toggle("hidden", !isShareExport);
}

/** Checks whether the recipient already has a matching code or name. */
async function previewSetShare(cardSet, recipientEmail) {
  if (!recipientEmail) throw new Error("Enter the user's email address.");

  return apiFetch(`/sets/${encodeURIComponent(cardSet.code || "DEFAULT")}/share`, {
    method: "POST",
    body: JSON.stringify({ recipientEmail, preview: true }),
  });
}

/** Sends the selected set to another user as a pending editable copy. */
async function shareSelectedSet(cardSet) {
  const recipientEmail = elements.shareRecipientEmailInput.value.trim();
  if (!recipientEmail) throw new Error("Enter the user's email address.");

  const data = await apiFetch(`/sets/${encodeURIComponent(cardSet.code || "DEFAULT")}/share`, {
    method: "POST",
    body: JSON.stringify({ recipientEmail, apiBaseUrl: backendConfig.apiUrl }),
  });
  const cardsCopied = data.cardsCopied ?? 0;
  elements.exportSetStatus.textContent = `Sent ${cardSet.name || cardSet.code || "set"} to ${recipientEmail} (${cardsCopied} cards).`;
}

/** Exports the selected set using the selected export format. */
async function exportSelectedSet() {
  const cardSet = getAvailableSets().find((set) => (set.code || "DEFAULT") === state.exportSetCode);
  if (!cardSet) {
    elements.exportSetStatus.textContent = "Choose a set to export.";
    return;
  }

  try {
    if (elements.exportFormatInput.value === "share-edit-copy") {
      const recipientEmail = elements.shareRecipientEmailInput.value.trim();
      const preview = await previewSetShare(cardSet, recipientEmail);
      const conflicts = preview.conflicts || {};
      const preflightKey = `${cardSet.code || "DEFAULT"}|${recipientEmail.toLowerCase()}`;

      if ((conflicts.code || conflicts.name) && state.sharePreflightKey !== preflightKey) {
        const duplicateFields = [];
        if (conflicts.code) duplicateFields.push("code");
        if (conflicts.name) duplicateFields.push("name");
        state.sharePreflightKey = preflightKey;
        elements.exportSetStatus.textContent = `Warning: ${recipientEmail} already has a set with the same ${duplicateFields.join(" and ")}. Click Export again to send the copy.`;
        return;
      }

      state.sharePreflightKey = "";
      elements.exportSetStatus.textContent = "Sending set...";
      await shareSelectedSet(cardSet);
      return;
    }

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
  button.title = "Share and Export";
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

/** Creates a pencil button that opens the set rename dialog. */
function createSetRenameButton(cardSet) {
  const button = document.createElement("button");
  button.className = "set-rename-button";
  button.type = "button";
  button.title = "Rename this set";
  button.setAttribute("aria-label", `Rename ${cardSet.name || cardSet.code || "set"}`);
  button.innerHTML = '<svg viewBox="0 0 24 24" fill="none" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M12 20h9"></path><path d="M16.5 3.5a2.1 2.1 0 0 1 3 3L8 18l-4 1 1-4Z"></path></svg>';
  button.addEventListener("click", () => openRenameSetDialog(cardSet));
  return button;
}

/** Opens the rename modal with the selected set's current name. */
function openRenameSetDialog(cardSet) {
  state.renameSetCode = cardSet.code || "DEFAULT";
  elements.renameSetNameInput.value = cardSet.name || "";
  elements.renameSetStatus.textContent = "";
  elements.renameSetDialog.showModal();
  elements.renameSetNameInput.focus();
  elements.renameSetNameInput.select();
}

/** Closes and clears the set rename modal. */
function closeRenameSetDialog() {
  state.renameSetCode = "";
  elements.renameSetNameInput.value = "";
  elements.renameSetStatus.textContent = "";
  elements.renameSetDialog.close();
}

/** Saves a changed set name and refreshes the active sets view. */
async function renameSelectedSet() {
  const setCode = state.renameSetCode;
  const name = elements.renameSetNameInput.value.trim();
  if (!setCode || !name) {
    elements.renameSetStatus.textContent = "Enter a new set name.";
    return;
  }

  elements.confirmRenameSetButton.disabled = true;
  try {
    await apiFetch(`/sets/${encodeURIComponent(setCode)}`, {
      method: "PUT",
      body: JSON.stringify({ name }),
    });
    await refreshSetsAndCards(false);
    closeRenameSetDialog();
    if (state.currentSetCode === setCode) {
      renderSetCardGrid(setCode);
    } else {
      renderSetLibraryList();
    }
    setStatus(`Renamed ${setCode} set`);
  } catch (error) {
    elements.renameSetStatus.textContent = error.message;
  } finally {
    elements.confirmRenameSetButton.disabled = false;
  }
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
  elements.setsCloseButton.href = "../";
  elements.generateArtButton.classList.add("hidden");
  elements.setDetailExportButton.classList.add("hidden");
  elements.setDetailRenameButton.classList.add("hidden");
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
    const nameCell = document.createElement("div");
    nameCell.className = "set-name-cell";
    nameCell.append(name, createSetRenameButton(cardSet));
    row.append(renderSetSymbolPreview(cardSet), codeLink, nameCell, createSetActionButtons(cardSet));
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
  label.textContent = `[${formatCollectorNumber(card.collectorNumber, setCode)}] ${card.name || "Untitled Card"}`;
  tile.append(label);
  return tile;
}

/** Shows the cards in a selected set as a five-column grid. */
function renderSetCardGrid(setCode) {
  state.currentSetCode = setCode;
  const cardSet = getAvailableSets().find((set) => (set.code || "DEFAULT") === setCode);
  const cards = getCardsInSet(setCode);
  elements.setsTitle.textContent = cardSet ? `${cardSet.code} - ${cardSet.name || "Untitled Set"}` : setCode;
  elements.setsCloseButton.href = "./";
  elements.generateArtButton.classList.toggle("hidden", !cardSet);
  elements.setDetailExportButton.classList.toggle("hidden", !cardSet);
  elements.setDetailRenameButton.classList.toggle("hidden", !cardSet);
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
  setSharing.attachEvents();
  elements.closeExportSetButton.addEventListener("click", closeExportSetDialog);
  elements.closeExportSetXButton.addEventListener("click", closeExportSetDialog);
  elements.generateArtButton.addEventListener("click", openGenerateArtDialog);
  elements.closeGenerateArtButton.addEventListener("click", cancelGenerateArtWorkflow);
  elements.cancelGenerateArtButton.addEventListener("click", cancelGenerateArtWorkflow);
  elements.confirmGenerateArtButton.addEventListener("click", toggleGenerateArtPause);
  elements.generateArtDialog.addEventListener("cancel", (event) => {
    if (!state.generateArtRunning) return;
    event.preventDefault();
    cancelGenerateArtWorkflow();
  });
  elements.confirmExportSetButton.addEventListener("click", exportSelectedSet);
  elements.exportFormatInput.addEventListener("change", syncExportFormatUi);
  elements.exportSetPublicInput.addEventListener("change", handleExportPublicChange);
  elements.shareRecipientEmailInput.addEventListener("input", () => {
    state.sharePreflightKey = "";
  });
  elements.exportSetForm.addEventListener("submit", (event) => event.preventDefault());
  elements.cancelRenameSetButton.addEventListener("click", closeRenameSetDialog);
  elements.renameSetForm.addEventListener("submit", (event) => {
    event.preventDefault();
    renameSelectedSet();
  });
  elements.setDetailRenameButton.addEventListener("click", () => {
    const cardSet = getAvailableSets().find((set) => (set.code || "DEFAULT") === state.currentSetCode);
    if (cardSet) openRenameSetDialog(cardSet);
  });
  elements.setDetailExportButton.addEventListener("click", () => {
    const cardSet = getAvailableSets().find((set) => (set.code || "DEFAULT") === state.currentSetCode);
    if (cardSet) openExportSetDialog(cardSet);
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
  if (state.refreshToken && (!state.idToken || isJwtExpired(state.idToken))) {
    await refreshAuthSession();
  }
  if (!state.idToken || isJwtExpired(state.idToken)) {
    if (sessionStorage.getItem("cardDesignerIdToken") || sessionStorage.getItem("cardDesignerRefreshToken")) {
      clearAuthSession();
      setAuthStatus("Your session expired. Sign in again.");
    }
    return;
  }

  setAuthStatus(state.email ? `Signed in as ${state.email}` : "Signed in from this tab session");
  try {
    await refreshSetsAndCards();
    await setSharing.checkSetShareResponses();
    await setSharing.checkIncomingSetShares();
  } catch (error) {
    setStatus(error.message);
  }
}

initialize();
