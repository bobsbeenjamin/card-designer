const backendConfig = window.backendConfig;
const requestedSetCode = (new URLSearchParams(window.location.search).get("set") || "DEFAULT").trim().toUpperCase();

const state = {
  ...AccountAuthController.readStoredSession(),
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

function setAuthStatus(message) {
  elements.authStatus.textContent = message;
}

/** Renders the signed-in or signed-out account controls. */
function renderAuthUi() {
  const signedIn = accountAuth.isSignedIn();
  elements.signInPanel.classList.toggle("hidden", signedIn);
  elements.templatesPageContent.classList.toggle("hidden", !signedIn);
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
const apiFetch = accountAuth.apiClient.request.bind(accountAuth.apiClient);

/** Initializes authentication and the template gallery. */
async function initialize() {
  accountAuth.attachEvents();
  if (await accountAuth.restoreSession()) {
    setAuthStatus(state.email ? `Signed in as ${state.email}` : "Signed in from this tab session");
    try {
      await loadTemplates();
    } catch (error) {
      elements.templatesStatus.textContent = error.message;
    }
  }
}

initialize();
