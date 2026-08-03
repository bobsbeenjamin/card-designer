const backendConfig = window.backendConfig;
const requestedSetCode = (new URLSearchParams(window.location.search).get("set") || "DEFAULT").trim().toUpperCase();

const state = {
  idToken: sessionStorage.getItem("cardDesignerIdToken") || "",
  refreshToken: sessionStorage.getItem("cardDesignerRefreshToken") || "",
  email: sessionStorage.getItem("cardDesignerEmail") || "",
};

const elements = {
  templatesTitle: document.querySelector("#templatesTitle"),
  templatesStatus: document.querySelector("#templatesStatus"),
  templatesCloseButton: document.querySelector("#templatesCloseButton"),
  templatesPageContent: document.querySelector("#templatesPageContent"),
  templateGrid: document.querySelector("#templateGrid"),
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
  signInPanel: document.querySelector("#signInPanel"),
  authStatus: document.querySelector("#authStatus"),
};

/** Decodes the payload from a Cognito JWT. */
function getJwtPayload(token) {
  try {
    const encoded = token.split(".")[1].replace(/-/g, "+").replace(/_/g, "/");
    return JSON.parse(atob(encoded.padEnd(Math.ceil(encoded.length / 4) * 4, "=")));
  } catch (error) {
    return {};
  }
}

function isJwtExpired(token) {
  const expiresAt = Number(getJwtPayload(token).exp || 0);
  return !expiresAt || Date.now() >= expiresAt * 1000 - 15000;
}

/** Sends a browser authentication request to Cognito. */
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

/** Refreshes the current Cognito session when possible. */
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

function setAuthStatus(message) {
  elements.authStatus.textContent = message;
}

/** Renders the signed-in or signed-out account controls. */
function renderAuthUi() {
  const signedIn = Boolean(state.idToken) && !isJwtExpired(state.idToken);
  elements.signInPanel.classList.toggle("hidden", signedIn);
  elements.templatesPageContent.classList.toggle("hidden", !signedIn);
}

/** Clears locally stored authentication state. */
function clearAuthSession() {
  state.idToken = "";
  state.refreshToken = "";
  state.email = "";
  sessionStorage.removeItem("cardDesignerIdToken");
  sessionStorage.removeItem("cardDesignerRefreshToken");
  sessionStorage.removeItem("cardDesignerEmail");
  renderAuthUi();
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

function getTemplateDesignerUrl(templateId) {
  const url = new URL("../template-designer/", window.location.href);
  url.searchParams.set("template", templateId);
  return url;
}

/** Creates a clickable template preview tile. */
function createTemplateTile(template) {
  const tile = document.createElement("div");
  tile.className = "library-card-tile";
  tile.tabIndex = 0;
  tile.setAttribute("role", "button");

  if (template.imageUrl) {
    const frame = document.createElement("div");
    const image = document.createElement("img");
    frame.className = "library-card-art-frame";
    image.className = "library-card-art";
    image.alt = `${template.name || "Template"} preview`;
    image.src = template.imageUrl;
    frame.append(image);
    tile.append(frame);
  } else {
    const empty = document.createElement("div");
    empty.className = "library-card-empty";
    empty.textContent = template.name || "Untitled Template";
    tile.append(empty);
  }

  const label = document.createElement("span");
  label.className = "library-card-name";
  label.textContent = template.name || "Untitled Template";
  tile.append(label);

  const openTemplate = () => {
    window.location.href = getTemplateDesignerUrl(template.templateId);
  };
  tile.addEventListener("click", openTemplate);
  tile.addEventListener("keydown", (event) => {
    if (!["Enter", " "].includes(event.key)) return;
    event.preventDefault();
    openTemplate();
  });
  return tile;
}

/** Loads and renders templates for the requested set. */
async function loadTemplates() {
  elements.templatesStatus.textContent = "Loading templates...";
  const [setsData, templatesData] = await Promise.all([
    apiFetch("/sets"),
    apiFetch(`/templates?set=${encodeURIComponent(requestedSetCode)}`),
  ]);
  const cardSet = (setsData.sets || []).find((item) => (item.code || "DEFAULT") === requestedSetCode);
  const setTitle = cardSet ? `${cardSet.code} - ${cardSet.name || "Untitled Set"}` : requestedSetCode;
  elements.templatesTitle.textContent = `${setTitle} Templates`;
  document.title = `[${requestedSetCode}] Set Templates - Card Designer`;
  const closeUrl = new URL("../sets/", window.location.href);
  closeUrl.searchParams.set("set", requestedSetCode);
  elements.templatesCloseButton.href = closeUrl;

  elements.templateGrid.replaceChildren();
  for (const template of templatesData.templates || []) {
    elements.templateGrid.append(createTemplateTile(template));
  }
  elements.templatesStatus.textContent = templatesData.templates?.length
    ? ""
    : "No templates saved for this set.";
}

const accountAuth = new AccountAuthController({
  backendConfig,
  state,
  elements,
  renderAuthUi,
  setAuthStatus,
  onSignedIn: loadTemplates,
});

/** Initializes authentication and the template gallery. */
async function initialize() {
  accountAuth.attachEvents();
  if (state.refreshToken && (!state.idToken || isJwtExpired(state.idToken))) await refreshAuthSession();
  renderAuthUi();
  if (state.idToken && !isJwtExpired(state.idToken)) {
    setAuthStatus(state.email ? `Signed in as ${state.email}` : "Signed in from this tab session");
    try {
      await loadTemplates();
    } catch (error) {
      elements.templatesStatus.textContent = error.message;
    }
  } else if (sessionStorage.getItem("cardDesignerIdToken") || sessionStorage.getItem("cardDesignerRefreshToken")) {
    clearAuthSession();
    setAuthStatus("Your session expired. Sign in again.");
  }
}

initialize();
