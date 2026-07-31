const backendConfig = window.backendConfig;
const pageParams = new URLSearchParams(window.location.search);
const requestedSetCode = (pageParams.get("set") || "DEFAULT").trim().toUpperCase();

const state = {
  idToken: sessionStorage.getItem("cardDesignerIdToken") || "",
  refreshToken: sessionStorage.getItem("cardDesignerRefreshToken") || "",
  email: sessionStorage.getItem("cardDesignerEmail") || "",
  defaults: {},
  cardTypes: [],
  rarityInfo: { colors: {}, labels: {} },
  sets: [],
  templates: [],
  sections: [],
  customFields: [],
  currentTemplateId: "",
  originalTemplateName: "",
  originalSetCode: "",
  renameFieldId: "",
  editingCustomFieldName: "",
  templateNavigationPending: false,
  allowPageExit: false,
  framePreviewObjectUrl: "",
  framePreviewSourceUrl: "",
  framePreviewLoadToken: 0,
  backgroundGenerating: false,
  dirty: false,
};

const elements = {
  saveTemplateButton: document.querySelector("#saveTemplateButton"),
  closeTemplateButton: document.querySelector("#closeTemplateButton"),
  templateStatus: document.querySelector("#templateStatus"),
  templateNameInput: document.querySelector("#templateNameInput"),
  templateSetInput: document.querySelector("#templateSetInput"),
  templateForm: document.querySelector("#templateForm"),
  templateFields: document.querySelector("#templateFields"),
  templateHomeButton: document.querySelector("#templateHomeButton"),
  myTemplatesPanel: document.querySelector("#myTemplatesPanel"),
  myTemplatesInput: document.querySelector("#myTemplatesInput"),
  templateUnsavedChangesDialog: document.querySelector("#templateUnsavedChangesDialog"),
  templateUnsavedChangesMessage: document.querySelector("#templateUnsavedChangesMessage"),
  customFieldsList: document.querySelector("#customFieldsList"),
  addCustomFieldButton: document.querySelector("#addCustomFieldButton"),
  customFieldPreview: document.querySelector("#customFieldPreview"),
  customFieldDialog: document.querySelector("#customFieldDialog"),
  customFieldForm: document.querySelector("#customFieldForm"),
  customFieldDialogTitle: document.querySelector("#customFieldDialogTitle"),
  customFieldNameInput: document.querySelector("#customFieldNameInput"),
  customFieldTypeInput: document.querySelector("#customFieldTypeInput"),
  customFieldDropdownOptions: document.querySelector("#customFieldDropdownOptions"),
  customFieldOptionList: document.querySelector("#customFieldOptionList"),
  addCustomFieldOptionButton: document.querySelector("#addCustomFieldOptionButton"),
  customFieldXInput: document.querySelector("#customFieldXInput"),
  customFieldYInput: document.querySelector("#customFieldYInput"),
  customFieldPositionHelp: document.querySelector("#customFieldPositionHelp"),
  customFieldFontSizeGroup: document.querySelector("#customFieldFontSizeGroup"),
  customFieldFontSizeInput: document.querySelector("#customFieldFontSizeInput"),
  customFieldImageSizeGroup: document.querySelector("#customFieldImageSizeGroup"),
  customFieldWidthInput: document.querySelector("#customFieldWidthInput"),
  customFieldHeightInput: document.querySelector("#customFieldHeightInput"),
  customFieldColorGroup: document.querySelector("#customFieldColorGroup"),
  customFieldColorInput: document.querySelector("#customFieldColorInput"),
  customFieldStatus: document.querySelector("#customFieldStatus"),
  saveCustomFieldButton: document.querySelector("#saveCustomFieldButton"),
  cancelCustomFieldButton: document.querySelector("#cancelCustomFieldButton"),
  mySetsPanel: document.querySelector("#mySetsPanel"),
  currentTemplateSetLabel: document.querySelector("#currentTemplateSetLabel"),
  card: document.querySelector("#card"),
  cardFrameImage: document.querySelector("#cardFrameImage"),
  cardName: document.querySelector("#cardName"),
  cardType: document.querySelector("#cardType"),
  cardCost: document.querySelector("#cardCost"),
  previewArtwork: document.querySelector("#previewArtwork"),
  previewText: document.querySelector("#previewText"),
  cardAbility: document.querySelector("#cardAbility"),
  cardFlavor: document.querySelector("#cardFlavor"),
  combatStats: document.querySelector("#combatStats"),
  attackStat: document.querySelector("#attackStat"),
  healthStat: document.querySelector("#healthStat"),
  loyaltyStat: document.querySelector("#loyaltyStat"),
  attackStatLabel: document.querySelector("#attackStatLabel"),
  healthStatLabel: document.querySelector("#healthStatLabel"),
  loyaltyStatLabel: document.querySelector("#loyaltyStatLabel"),
  cardAttack: document.querySelector("#cardAttack"),
  cardHealth: document.querySelector("#cardHealth"),
  cardLoyalty: document.querySelector("#cardLoyalty"),
  previewFooter: document.querySelector("#previewFooter"),
  setSymbol: document.querySelector("#setSymbol"),
  cardCollector: document.querySelector("#cardCollector"),
  cardRarity: document.querySelector("#cardRarity"),
  cardArtist: document.querySelector("#cardArtist"),
  renameFieldDialog: document.querySelector("#renameFieldDialog"),
  renameFieldForm: document.querySelector("#renameFieldForm"),
  renameFieldInput: document.querySelector("#renameFieldInput"),
  renameFieldStatus: document.querySelector("#renameFieldStatus"),
  cancelRenameFieldButton: document.querySelector("#cancelRenameFieldButton"),
  generateTemplateBackgroundDialog: document.querySelector("#generateTemplateBackgroundDialog"),
  generateTemplateBackgroundForm: document.querySelector("#generateTemplateBackgroundForm"),
  generateTemplateBackgroundPrompt: document.querySelector("#generateTemplateBackgroundPrompt"),
  generateTemplateBackgroundStatus: document.querySelector("#generateTemplateBackgroundStatus"),
  confirmGenerateTemplateBackgroundButton: document.querySelector("#confirmGenerateTemplateBackgroundButton"),
  cancelGenerateTemplateBackgroundButton: document.querySelector("#cancelGenerateTemplateBackgroundButton"),
  templateNameChangeDialog: document.querySelector("#templateNameChangeDialog"),
  templateSetChangeDialog: document.querySelector("#templateSetChangeDialog"),
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
  signedInPanel: document.querySelector("#signedInPanel"),
  currentUserLabel: document.querySelector("#currentUserLabel"),
  accountMenuButton: document.querySelector("#accountMenuButton"),
  accountMenu: document.querySelector("#accountMenu"),
  signOutButton: document.querySelector("#signOutButton"),
  authStatus: document.querySelector("#authStatus"),
};

const fieldSections = [
  {
    id: "identity",
    label: "Identity",
    fields: [
      { id: "name", label: "Name", type: "text", maxLength: 36 },
      { id: "type", label: "Type", type: "select", options: [] },
      { id: "subtype", label: "Subtype", type: "text", maxLength: 28 },
    ],
  },
  {
    id: "numbers",
    label: "Numbers",
    fields: [
      { id: "cost", label: "Cost", type: "number", min: 0, max: 99 },
      {
        id: "statMode",
        label: "Stat mode",
        type: "select",
        options: [
          { value: "combat", label: "Attack / Health" },
          { value: "loyalty", label: "Loyalty" },
        ],
      },
      { id: "attack", label: "Attack", type: "number", min: 0, max: 99 },
      { id: "health", label: "Health", type: "number", min: 0, max: 99 },
      { id: "loyalty", label: "Loyalty", type: "number", min: 0, max: 99 },
    ],
  },
  {
    id: "text",
    label: "Text",
    fields: [
      { id: "ability", label: "Rules", type: "textarea", rows: 5 },
      { id: "flavor", label: "Flavor", type: "textarea", rows: 3 },
    ],
  },
  {
    id: "artwork",
    label: "Artwork",
    fields: [
      {
        id: "fit",
        label: "Art fit",
        type: "select",
        options: [
          { value: "cover", label: "Cover (preserve ratio)" },
          { value: "contain", label: "Contain (unaltered)" },
          { value: "fill", label: "Fill (stretch)" },
        ],
      },
    ],
  },
  {
    id: "colors",
    label: "Colors",
    fields: [
      { id: "frame", label: "Frame", type: "color" },
      { id: "accent", label: "Accent", type: "color" },
      { id: "text", label: "Text", type: "color" },
      { id: "panel", label: "Panel", type: "color" },
    ],
  },
  {
    id: "cardFrame",
    label: "Card Frame",
    fields: [
      { id: "frameUrl", label: "Image URL", type: "url" },
      {
        id: "frameFit",
        label: "Background fit",
        type: "select",
        options: [
          { value: "cover", label: "Cover (preserve ratio)" },
          { value: "contain", label: "Contain (unaltered)" },
          { value: "fill", label: "Fill (stretch)" },
        ],
      },
    ],
  },
  {
    id: "footer",
    label: "Footer",
    fields: [
      { id: "artist", label: "Artist name", type: "text", maxLength: 40 },
      { id: "collector", label: "Collector number", type: "text", maxLength: 16 },
      {
        id: "rarity",
        label: "Rarity",
        type: "select",
        options: [
          { value: "common", label: "Common" },
          { value: "uncommon", label: "Uncommon" },
          { value: "rare", label: "Rare" },
          { value: "mythic", label: "Mythic" },
        ],
      },
    ],
  },
];

const customFieldTypeLabels = {
  text: "Text",
  number: "Number",
  dropdown: "Dropdown",
  symbol: "Symbol",
  art: "Art",
};
const textCustomFieldTypes = new Set(["text", "number", "dropdown"]);
const imageCustomFieldTypes = new Set(["symbol", "art"]);

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

function setTemplateStatus(message) {
  elements.templateStatus.textContent = message;
}

function closeAccountMenu() {
  elements.accountMenu.classList.add("hidden");
  elements.accountMenuButton.setAttribute("aria-expanded", "false");
}

function renderAuthUi() {
  const signedIn = Boolean(state.idToken) && !isJwtExpired(state.idToken);
  elements.signInPanel.classList.toggle("hidden", signedIn);
  elements.signedInPanel.classList.toggle("hidden", !signedIn);
  elements.mySetsPanel.classList.toggle("hidden", !signedIn);
  elements.myTemplatesPanel.classList.toggle("hidden", !signedIn);
  elements.saveTemplateButton.disabled = !signedIn;
  const generateBackgroundButton = elements.templateFields.querySelector(
    "[data-template-action='generate-background']",
  );
  if (generateBackgroundButton) generateBackgroundButton.disabled = !signedIn || state.backgroundGenerating;
  elements.currentUserLabel.textContent = state.email || getJwtPayload(state.idToken).email || "Account";
  if (!signedIn) closeAccountMenu();
}

function clearAuthSession() {
  state.idToken = "";
  state.refreshToken = "";
  state.email = "";
  state.sets = [];
  state.templates = [];
  sessionStorage.removeItem("cardDesignerIdToken");
  sessionStorage.removeItem("cardDesignerRefreshToken");
  sessionStorage.removeItem("cardDesignerEmail");
  renderSetOptions();
  renderTemplateOptions();
  renderAuthUi();
}

function signOut() {
  clearAuthSession();
  setAuthStatus("Signed out");
  setTemplateStatus("Sign in to save templates.");
}

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

function createDefaultSections() {
  const defaultValues = { ...state.defaults, frameUrl: "" };
  fieldSections[0].fields[1].options = state.cardTypes.map((value) => ({ value, label: value }));
  return fieldSections.map((section) => ({
    id: section.id,
    label: section.label,
    fields: section.fields.map((field) => ({
      ...field,
      options: field.options ? field.options.map((option) => ({ ...option })) : undefined,
      value: String(defaultValues[field.id] ?? ""),
    })),
  }));
}

function getField(fieldId) {
  for (const section of state.sections) {
    const field = section.fields.find((item) => item.id === fieldId);
    if (field) return field;
  }
  return null;
}

function getFieldValue(fieldId, fallback = "") {
  return getField(fieldId)?.value ?? fallback;
}

function getFieldLabel(fieldId, fallback) {
  return getField(fieldId)?.label || fallback;
}

function createFieldInput(field) {
  let input;
  if (field.type === "select") {
    input = document.createElement("select");
    for (const item of field.options || []) {
      const option = document.createElement("option");
      option.value = item.value;
      option.textContent = item.label;
      input.append(option);
    }
  } else if (field.type === "textarea") {
    input = document.createElement("textarea");
    input.rows = field.rows || 3;
  } else {
    input = document.createElement("input");
    input.type = field.type || "text";
    if (field.min !== undefined) input.min = field.min;
    if (field.max !== undefined) input.max = field.max;
    if (field.maxLength) input.maxLength = field.maxLength;
  }

  input.value = field.value;
  input.dataset.fieldId = field.id;
  input.setAttribute("aria-label", field.label);
  return input;
}

function createFieldAction(field, action, title) {
  const button = document.createElement("button");
  button.className = `template-field-action ${action === "delete" ? "delete" : ""}`.trim();
  button.type = "button";
  button.dataset.action = action;
  button.dataset.fieldId = field.id;
  button.title = title;
  button.setAttribute("aria-label", `${title}: ${field.label}`);
  if (action === "rename") {
    button.innerHTML = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 20h9"></path><path d="M16.5 3.5a2.1 2.1 0 0 1 3 3L8 18l-4 1 1-4Z"></path></svg>';
  } else {
    button.innerHTML = '<span class="trash-icon" aria-hidden="true"></span>';
  }
  return button;
}

function renderTemplateFields() {
  elements.templateFields.replaceChildren();
  for (const section of state.sections) {
    const fieldset = document.createElement("fieldset");
    const legend = document.createElement("legend");
    legend.textContent = section.label;
    fieldset.append(legend);

    if (!section.fields.length) {
      const empty = document.createElement("p");
      empty.className = "template-empty-section";
      empty.textContent = "All fields in this section have been deleted.";
      fieldset.append(empty);
    }

    for (const field of section.fields) {
      const wrapper = document.createElement("div");
      wrapper.className = "template-field";

      const heading = document.createElement("div");
      heading.className = "template-field-heading";
      const label = document.createElement("span");
      label.className = "template-field-label";
      label.textContent = field.label;

      const actions = document.createElement("span");
      actions.className = "template-field-actions";
      actions.append(
        createFieldAction(field, "rename", "Rename field"),
        createFieldAction(field, "delete", "Delete field"),
      );
      heading.append(label, actions);
      wrapper.append(heading, createFieldInput(field));
      fieldset.append(wrapper);
    }
    if (section.id === "cardFrame") {
      const generateRow = document.createElement("div");
      generateRow.className = "generate-image-row";
      const generateButton = document.createElement("button");
      generateButton.className = "button primary";
      generateButton.type = "button";
      generateButton.dataset.templateAction = "generate-background";
      generateButton.title = "Generate Background Image or Pattern";
      generateButton.setAttribute("aria-label", "Generate Background Image or Pattern");
      generateButton.textContent = "Generate Background";
      generateButton.disabled = state.backgroundGenerating
        || !state.idToken
        || isJwtExpired(state.idToken);
      const spinner = document.createElement("span");
      spinner.className = "inline-spinner hidden";
      spinner.dataset.templateBackgroundSpinner = "";
      spinner.setAttribute("aria-label", "Generating background image");
      spinner.setAttribute("role", "status");
      generateRow.append(generateButton, spinner);
      fieldset.append(generateRow);
    }
    elements.templateFields.append(fieldset);
  }
}

function normalizeCustomFieldName(value) {
  return String(value || "").trim().replace(/\s+/g, " ").toLowerCase();
}

function getCustomFieldInteger(value, fallback, minimum = 0) {
  const parsed = Number.parseInt(value, 10);
  return Number.isFinite(parsed) ? Math.max(minimum, Math.min(parsed, 5000)) : fallback;
}

function normalizeSavedCustomFields(savedFields) {
  if (!Array.isArray(savedFields)) return [];
  const normalized = [];
  const seenNames = new Set();
  for (const savedField of savedFields.slice(0, 50)) {
    const name = String(savedField?.name || "").trim().replace(/\s+/g, " ").slice(0, 60);
    const normalizedName = normalizeCustomFieldName(name);
    const dataType = String(savedField?.dataType || "").toLowerCase();
    if (!name || seenNames.has(normalizedName) || !customFieldTypeLabels[dataType]) continue;
    seenNames.add(normalizedName);

    const field = {
      name,
      dataType,
      position: {
        x: getCustomFieldInteger(savedField.position?.x, 0),
        y: getCustomFieldInteger(savedField.position?.y, 0),
      },
      size: imageCustomFieldTypes.has(dataType)
        ? {
            width: getCustomFieldInteger(savedField.size?.width, 64, 1),
            height: getCustomFieldInteger(savedField.size?.height, 64, 1),
          }
        : {
            fontSize: getCustomFieldInteger(savedField.size?.fontSize, 16, 1),
          },
      color: textCustomFieldTypes.has(dataType) && /^#[0-9a-f]{6}$/i.test(savedField.color || "")
        ? savedField.color
        : "#202621",
      options: dataType === "dropdown"
        ? (Array.isArray(savedField.options) ? savedField.options : [])
            .map((option) => String(option || "").trim())
            .filter(Boolean)
            .slice(0, 50)
        : [],
    };
    normalized.push(field);
  }
  return normalized;
}

function createCustomFieldAction(field, action, title) {
  const button = document.createElement("button");
  button.className = `template-field-action ${action === "delete" ? "delete" : ""}`.trim();
  button.type = "button";
  button.dataset.customFieldAction = action;
  button.dataset.customFieldName = field.name;
  button.title = title;
  button.setAttribute("aria-label", `${title}: ${field.name}`);
  button.innerHTML = action === "edit"
    ? '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 20h9"></path><path d="M16.5 3.5a2.1 2.1 0 0 1 3 3L8 18l-4 1 1-4Z"></path></svg>'
    : '<span class="trash-icon" aria-hidden="true"></span>';
  return button;
}

function renderCustomFields() {
  elements.customFieldsList.replaceChildren();
  if (!state.customFields.length) {
    const empty = document.createElement("p");
    empty.className = "template-empty-section";
    empty.textContent = "No custom fields have been added.";
    elements.customFieldsList.append(empty);
    return;
  }

  for (const field of state.customFields) {
    const wrapper = document.createElement("div");
    wrapper.className = "custom-field-summary";
    const heading = document.createElement("div");
    heading.className = "template-field-heading";
    const name = document.createElement("span");
    name.className = "template-field-label";
    name.textContent = field.name;
    const actions = document.createElement("span");
    actions.className = "template-field-actions";
    actions.append(
      createCustomFieldAction(field, "edit", "Edit field"),
      createCustomFieldAction(field, "delete", "Delete field"),
    );
    const type = document.createElement("span");
    type.className = "custom-field-type";
    type.textContent = customFieldTypeLabels[field.dataType];
    heading.append(name, actions);
    wrapper.append(heading, type);
    elements.customFieldsList.append(wrapper);
  }
}

function getCardPixelBounds() {
  const bounds = elements.card.getBoundingClientRect();
  return {
    width: Math.max(1, Math.floor(bounds.width || 420)),
    height: Math.max(1, Math.floor(bounds.height || (420 * 88) / 63)),
  };
}

function setCustomFieldPositionLimits() {
  const bounds = getCardPixelBounds();
  elements.customFieldXInput.max = String(bounds.width);
  elements.customFieldYInput.max = String(bounds.height);
  elements.customFieldPositionHelp.textContent = `X: 0–${bounds.width}px; Y: 0–${bounds.height}px.`;
  return bounds;
}

function createCustomFieldOptionRow(value = "") {
  const row = document.createElement("div");
  row.className = "custom-field-option-row";
  const input = document.createElement("input");
  input.type = "text";
  input.maxLength = 80;
  input.value = value;
  input.setAttribute("aria-label", "Dropdown option");
  const deleteButton = document.createElement("button");
  deleteButton.className = "template-field-action delete";
  deleteButton.type = "button";
  deleteButton.dataset.customOptionAction = "delete";
  deleteButton.title = "Delete option";
  deleteButton.setAttribute("aria-label", `Delete option${value ? `: ${value}` : ""}`);
  deleteButton.innerHTML = '<span class="trash-icon" aria-hidden="true"></span>';
  row.append(input, deleteButton);
  return row;
}

function renderCustomFieldOptions(options = []) {
  elements.customFieldOptionList.replaceChildren();
  for (const option of options) {
    elements.customFieldOptionList.append(createCustomFieldOptionRow(option));
  }
}

function syncCustomFieldTypeUi() {
  const dataType = elements.customFieldTypeInput.value;
  const isImage = imageCustomFieldTypes.has(dataType);
  const isDropdown = dataType === "dropdown";
  elements.customFieldDropdownOptions.classList.toggle("hidden", !isDropdown);
  elements.customFieldFontSizeGroup.classList.toggle("hidden", isImage);
  elements.customFieldImageSizeGroup.classList.toggle("hidden", !isImage);
  elements.customFieldColorGroup.classList.toggle("hidden", isImage);
  elements.customFieldFontSizeInput.required = !isImage;
  elements.customFieldWidthInput.required = isImage;
  elements.customFieldHeightInput.required = isImage;
  if (isDropdown && !elements.customFieldOptionList.children.length) {
    renderCustomFieldOptions([""]);
  }
}

function openCustomFieldDialog(field = null) {
  const bounds = setCustomFieldPositionLimits();
  state.editingCustomFieldName = field?.name || "";
  elements.customFieldForm.reset();
  elements.customFieldDialogTitle.textContent = field ? "Edit Template Field" : "New Template Field";
  elements.saveCustomFieldButton.textContent = field ? "Save Changes" : "Add Field";
  elements.customFieldNameInput.value = field?.name || "";
  elements.customFieldTypeInput.value = field?.dataType || "text";
  elements.customFieldXInput.value = String(field?.position?.x ?? 0);
  elements.customFieldYInput.value = String(field?.position?.y ?? 0);
  elements.customFieldFontSizeInput.value = String(field?.size?.fontSize ?? 16);
  elements.customFieldWidthInput.value = String(field?.size?.width ?? Math.min(64, bounds.width));
  elements.customFieldHeightInput.value = String(field?.size?.height ?? Math.min(64, bounds.height));
  elements.customFieldColorInput.value = field?.color || "#202621";
  elements.customFieldStatus.textContent = "";
  renderCustomFieldOptions(field?.options || []);
  syncCustomFieldTypeUi();
  elements.customFieldDialog.showModal();
  elements.customFieldNameInput.focus();
  if (field) elements.customFieldNameInput.select();
}

function closeCustomFieldDialog() {
  state.editingCustomFieldName = "";
  elements.customFieldStatus.textContent = "";
  elements.customFieldDialog.close();
}

function getCustomFieldOptions() {
  return [...elements.customFieldOptionList.querySelectorAll("input")]
    .map((input) => input.value.trim())
    .filter(Boolean);
}

function saveCustomFieldDefinition() {
  if (!elements.customFieldForm.reportValidity()) return;
  const name = elements.customFieldNameInput.value.trim().replace(/\s+/g, " ");
  const normalizedName = normalizeCustomFieldName(name);
  const editingName = normalizeCustomFieldName(state.editingCustomFieldName);
  const editIndex = state.customFields.findIndex(
    (field) => normalizeCustomFieldName(field.name) === editingName,
  );
  const duplicateName = state.customFields.some(
    (field, index) => index !== editIndex && normalizeCustomFieldName(field.name) === normalizedName,
  );
  if (duplicateName) {
    elements.customFieldStatus.textContent = "Custom field names must be unique.";
    elements.customFieldNameInput.focus();
    return;
  }

  const dataType = elements.customFieldTypeInput.value;
  const options = dataType === "dropdown" ? getCustomFieldOptions() : [];
  if (dataType === "dropdown" && !options.length) {
    elements.customFieldStatus.textContent = "Add at least one dropdown option.";
    elements.customFieldOptionList.querySelector("input")?.focus();
    return;
  }
  const normalizedOptions = options.map((option) => option.toLowerCase());
  if (new Set(normalizedOptions).size !== normalizedOptions.length) {
    elements.customFieldStatus.textContent = "Dropdown options must be unique.";
    return;
  }

  const field = {
    name,
    dataType,
    position: {
      x: elements.customFieldXInput.valueAsNumber,
      y: elements.customFieldYInput.valueAsNumber,
    },
    size: imageCustomFieldTypes.has(dataType)
      ? {
          width: elements.customFieldWidthInput.valueAsNumber,
          height: elements.customFieldHeightInput.valueAsNumber,
        }
      : {
          fontSize: elements.customFieldFontSizeInput.valueAsNumber,
        },
    color: textCustomFieldTypes.has(dataType) ? elements.customFieldColorInput.value : "",
    options,
  };

  const wasEditing = editIndex >= 0;
  if (wasEditing) state.customFields.splice(editIndex, 1, field);
  else state.customFields.push(field);
  closeCustomFieldDialog();
  renderCustomFields();
  updateCardPreview();
  markDirty();
  setTemplateStatus(`${field.name} ${wasEditing ? "updated" : "added"}. Save to keep this change.`);
}

function deleteCustomField(fieldName) {
  const index = state.customFields.findIndex(
    (field) => normalizeCustomFieldName(field.name) === normalizeCustomFieldName(fieldName),
  );
  if (index < 0) return;
  const field = state.customFields[index];
  if (!window.confirm(`Delete the custom field "${field.name}"?`)) return;
  state.customFields.splice(index, 1);
  renderCustomFields();
  updateCardPreview();
  markDirty();
  setTemplateStatus(`${field.name} deleted. Save to keep this change.`);
}

function handleCustomFieldAction(event) {
  const button = event.target.closest("[data-custom-field-action][data-custom-field-name]");
  if (!button) return;
  const field = state.customFields.find(
    (item) => normalizeCustomFieldName(item.name) === normalizeCustomFieldName(button.dataset.customFieldName),
  );
  if (!field) return;
  if (button.dataset.customFieldAction === "edit") openCustomFieldDialog(field);
  if (button.dataset.customFieldAction === "delete") deleteCustomField(field.name);
}

function renderCustomFieldPreview() {
  elements.customFieldPreview.replaceChildren();
  for (const field of state.customFields) {
    const item = document.createElement("div");
    const isImage = imageCustomFieldTypes.has(field.dataType);
    item.className = `custom-field-preview-item ${isImage ? "image-value" : "text-value"} ${field.dataType === "symbol" ? "symbol-value" : ""}`.trim();
    item.style.left = `${field.position.x}px`;
    item.style.top = `${field.position.y}px`;
    if (isImage) {
      item.style.width = `${field.size.width}px`;
      item.style.height = `${field.size.height}px`;
      item.textContent = `${customFieldTypeLabels[field.dataType]}: ${field.name}`;
    } else {
      item.style.color = field.color;
      item.style.fontSize = `${field.size.fontSize}px`;
      item.textContent = field.dataType === "dropdown" ? field.options[0] || field.name : field.name;
    }
    elements.customFieldPreview.append(item);
  }
}

function normalizeSavedSections(savedSections) {
  const defaultsBySection = new Map(createDefaultSections().map((section) => [section.id, section]));
  if (!Array.isArray(savedSections)) return [...defaultsBySection.values()];

  const normalized = [];
  for (const savedSection of savedSections) {
    const defaultSection = defaultsBySection.get(savedSection?.id);
    if (!defaultSection) continue;
    const fieldsById = new Map(defaultSection.fields.map((field) => [field.id, field]));
    const fields = [];
    for (const savedField of Array.isArray(savedSection.fields) ? savedSection.fields : []) {
      const defaultField = fieldsById.get(savedField?.id);
      if (!defaultField || fields.some((field) => field.id === defaultField.id)) continue;
      fields.push({
        ...defaultField,
        label: String(savedField.label || defaultField.label).slice(0, 60),
        value: String(savedField.value ?? defaultField.value),
      });
    }
    normalized.push({ id: defaultSection.id, label: defaultSection.label, fields });
  }

  for (const defaultSection of defaultsBySection.values()) {
    if (!normalized.some((section) => section.id === defaultSection.id)) normalized.push(defaultSection);
  }
  return normalized;
}

function revokeTemplateFramePreviewUrl() {
  if (state.framePreviewObjectUrl) {
    URL.revokeObjectURL(state.framePreviewObjectUrl);
    state.framePreviewObjectUrl = "";
  }
}

function getAbsoluteTemplateImageUrl(source) {
  const imageUrl = String(source || "").trim();
  if (!imageUrl || imageUrl.startsWith("data:") || imageUrl.startsWith("blob:")) return imageUrl;
  if (imageUrl.startsWith("/")) return `${backendConfig.apiUrl}${imageUrl}`;
  try {
    return new URL(imageUrl, window.location.href).href;
  } catch (error) {
    return imageUrl;
  }
}

function clearTemplateFramePreview() {
  state.framePreviewLoadToken += 1;
  state.framePreviewSourceUrl = "";
  revokeTemplateFramePreviewUrl();
  elements.cardFrameImage.removeAttribute("src");
}

async function setTemplateFramePreview(source) {
  const sourceUrl = String(source || "").trim();
  if (!sourceUrl) {
    clearTemplateFramePreview();
    return;
  }
  if (sourceUrl.startsWith("data:") || sourceUrl.startsWith("blob:")) {
    state.framePreviewLoadToken += 1;
    state.framePreviewSourceUrl = sourceUrl;
    revokeTemplateFramePreviewUrl();
    elements.cardFrameImage.src = sourceUrl;
    await elements.cardFrameImage.decode().catch(() => {});
    return;
  }

  const loadToken = ++state.framePreviewLoadToken;
  const blob = await fetchImageBlob(getAbsoluteTemplateImageUrl(sourceUrl));
  if (!blob.type.startsWith("image/")) throw new Error("Template background did not return an image.");
  if (loadToken !== state.framePreviewLoadToken) return;
  const objectUrl = URL.createObjectURL(blob);
  revokeTemplateFramePreviewUrl();
  state.framePreviewObjectUrl = objectUrl;
  state.framePreviewSourceUrl = sourceUrl;
  elements.cardFrameImage.src = objectUrl;
  await elements.cardFrameImage.decode().catch(() => {});
}

function greatestCommonDivisor(first, second) {
  let left = Math.abs(Math.round(first));
  let right = Math.abs(Math.round(second));
  while (right) {
    [left, right] = [right, left % right];
  }
  return left || 1;
}

function getTemplateCardAspectRatio() {
  const rootStyle = getComputedStyle(document.documentElement);
  const configuredRatio = rootStyle.getPropertyValue("--card-ratio").trim()
    || getComputedStyle(elements.card).aspectRatio;
  const configuredMatch = configuredRatio.match(/^([\d.]+)\s*\/\s*([\d.]+)$/);
  if (configuredMatch) {
    const width = Math.max(1, Math.round(Number(configuredMatch[1]) * 1000));
    const height = Math.max(1, Math.round(Number(configuredMatch[2]) * 1000));
    const divisor = greatestCommonDivisor(width, height);
    return `${width / divisor}:${height / divisor}`;
  }

  const bounds = elements.card.getBoundingClientRect();
  const width = Math.max(1, Math.round(bounds.width));
  const height = Math.max(1, Math.round(bounds.height));
  const divisor = greatestCommonDivisor(width, height);
  return `${width / divisor}:${height / divisor}`;
}

function getGenerateBackgroundControls() {
  return {
    button: elements.templateFields.querySelector("[data-template-action='generate-background']"),
    spinner: elements.templateFields.querySelector("[data-template-background-spinner]"),
  };
}

function setGenerateBackgroundBusy(busy) {
  state.backgroundGenerating = busy;
  const { button, spinner } = getGenerateBackgroundControls();
  const signedIn = Boolean(state.idToken) && !isJwtExpired(state.idToken);
  if (button) button.disabled = busy || !signedIn;
  if (spinner) spinner.classList.toggle("hidden", !busy);
  elements.confirmGenerateTemplateBackgroundButton.disabled = busy;
  elements.cancelGenerateTemplateBackgroundButton.disabled = busy;
}

function openGenerateTemplateBackgroundDialog() {
  if (!getField("frameUrl")) {
    setTemplateStatus("The Image URL field is required to generate a background.");
    return;
  }
  elements.generateTemplateBackgroundForm.reset();
  elements.generateTemplateBackgroundStatus.textContent = "";
  elements.generateTemplateBackgroundDialog.showModal();
  elements.generateTemplateBackgroundPrompt.focus();
}

function closeGenerateTemplateBackgroundDialog() {
  if (!state.backgroundGenerating) elements.generateTemplateBackgroundDialog.close();
}

async function generateTemplateBackground() {
  if (!elements.generateTemplateBackgroundForm.reportValidity()) return;
  const prompt = elements.generateTemplateBackgroundPrompt.value.trim();
  if (!prompt) return;

  setGenerateBackgroundBusy(true);
  elements.generateTemplateBackgroundStatus.textContent = "Generating and saving background...";
  try {
    const data = await apiFetch("/templates/background/generate", {
      method: "POST",
      body: JSON.stringify({
        prompt,
        aspectRatio: getTemplateCardAspectRatio(),
        setCode: elements.templateSetInput.value || "DEFAULT",
        templateName: elements.templateNameInput.value.trim() || "Untitled Template",
        templateId: state.currentTemplateId,
        existingFrameUrl: getFieldValue("frameUrl"),
      }),
    });
    const frameUrl = getAbsoluteTemplateImageUrl(data.frameUrl);
    if (!frameUrl) throw new Error("The image provider did not return a saved background.");

    const frameField = getField("frameUrl");
    frameField.value = frameUrl;
    const frameInput = elements.templateFields.querySelector("[data-field-id='frameUrl']");
    if (frameInput) frameInput.value = frameUrl;
    await setTemplateFramePreview(frameUrl);
    updateCardPreview();
    markDirty();
    elements.generateTemplateBackgroundDialog.close();
    setTemplateStatus("Background generated and stored. Save the template to keep its Image URL.");
  } catch (error) {
    elements.generateTemplateBackgroundStatus.textContent = error.message;
  } finally {
    setGenerateBackgroundBusy(false);
  }
}

function updateCardPreview() {
  const type = getFieldValue("type", state.defaults.type);
  const subtype = getFieldValue("subtype", state.defaults.subtype);
  const statMode = getFieldValue("statMode", state.defaults.statMode || "combat");
  const rarity = getFieldValue("rarity", state.defaults.rarity || "common");
  const hasName = Boolean(getField("name"));
  const hasType = Boolean(getField("type"));
  const hasSubtype = Boolean(getField("subtype"));
  const hasAttack = Boolean(getField("attack"));
  const hasHealth = Boolean(getField("health"));
  const hasLoyalty = Boolean(getField("loyalty"));
  const hasAbility = Boolean(getField("ability"));
  const hasFlavor = Boolean(getField("flavor"));

  elements.cardName.textContent = hasName ? getFieldValue("name") || "Untitled Card" : "";
  elements.cardName.classList.toggle("hidden", !hasName);
  elements.cardType.textContent = [hasType ? type : "", hasSubtype ? subtype : ""].filter(Boolean).join(" - ");
  elements.cardType.classList.toggle("hidden", !hasType && !hasSubtype);
  elements.cardCost.textContent = `$${getFieldValue("cost", state.defaults.cost || "0") || "0"}`;
  elements.cardCost.classList.toggle("hidden", !getField("cost"));

  elements.cardAbility.textContent = hasAbility ? getFieldValue("ability") : "";
  elements.cardFlavor.textContent = hasFlavor ? getFieldValue("flavor") : "";
  elements.cardFlavor.classList.toggle("has-separator", hasAbility && hasFlavor);
  elements.previewText.classList.toggle("hidden", !hasAbility && !hasFlavor);

  elements.previewArtwork.classList.toggle("hidden", !getField("fit"));
  const artFit = getFieldValue("fit", state.defaults.fit || "cover");
  elements.previewArtwork.style.backgroundSize = artFit === "fill" ? "100% 100%" : artFit;

  const showLoyalty = statMode === "loyalty" && hasLoyalty;
  elements.card.classList.toggle("is-loyalty", showLoyalty);
  elements.card.classList.toggle("is-statless", !showLoyalty && !hasAttack && !hasHealth);
  elements.combatStats.classList.toggle("hidden", showLoyalty || (!hasAttack && !hasHealth));
  elements.attackStat.classList.toggle("hidden", !hasAttack);
  elements.healthStat.classList.toggle("hidden", !hasHealth);
  elements.loyaltyStat.classList.toggle("hidden", !showLoyalty);
  elements.cardAttack.textContent = getFieldValue("attack", state.defaults.attack || "0");
  elements.cardHealth.textContent = getFieldValue("health", state.defaults.health || "0");
  elements.cardLoyalty.textContent = getFieldValue("loyalty", state.defaults.loyalty || "0");
  elements.attackStatLabel.textContent = getFieldLabel("attack", "Attack").toUpperCase();
  elements.healthStatLabel.textContent = getFieldLabel("health", "Health").toUpperCase();
  elements.loyaltyStatLabel.textContent = getFieldLabel("loyalty", "Loyalty").toUpperCase();

  const frameUrl = getFieldValue("frameUrl").trim();
  if (!frameUrl) clearTemplateFramePreview();
  else if (state.framePreviewSourceUrl !== frameUrl) elements.cardFrameImage.src = getAbsoluteTemplateImageUrl(frameUrl);
  elements.cardFrameImage.style.objectFit = getFieldValue("frameFit", state.defaults.frameFit || "fill");

  document.documentElement.style.setProperty("--frame", getFieldValue("frame", state.defaults.frame || "#263a31"));
  document.documentElement.style.setProperty("--accent", getFieldValue("accent", state.defaults.accent || "#d69d42"));
  document.documentElement.style.setProperty("--card-text", getFieldValue("text", state.defaults.text || "#f8f4e8"));
  document.documentElement.style.setProperty("--panel", getFieldValue("panel", state.defaults.panel || "#fff7df"));
  document.documentElement.style.setProperty("--rarity-color", state.rarityInfo.colors[rarity] || "#b8c2bc");

  elements.setSymbol.classList.toggle("hidden", !getField("rarity"));
  elements.cardCollector.textContent = getField("collector") ? getFieldValue("collector") || "1/1" : "";
  elements.cardRarity.textContent = getField("rarity") ? state.rarityInfo.labels[rarity] || rarity : "";
  elements.cardArtist.textContent = getField("artist")
    ? `${getFieldLabel("artist", "Artist name")}: ${getFieldValue("artist") || "Unknown"}`
    : "";
  elements.previewFooter.classList.toggle(
    "hidden",
    !getField("collector") && !getField("rarity") && !getField("artist"),
  );
  renderCustomFieldPreview();
}

function markDirty() {
  state.dirty = true;
  updateCurrentSetLabel();
  setTemplateStatus(`Unsaved changes for ${elements.templateNameInput.value.trim() || "untitled template"}.`);
}

function openRenameField(fieldId) {
  const field = getField(fieldId);
  if (!field) return;
  state.renameFieldId = fieldId;
  elements.renameFieldInput.value = field.label;
  elements.renameFieldStatus.textContent = "";
  elements.renameFieldDialog.showModal();
  elements.renameFieldInput.select();
}

function closeRenameField() {
  state.renameFieldId = "";
  elements.renameFieldStatus.textContent = "";
  elements.renameFieldDialog.close();
}

function renameField() {
  const field = getField(state.renameFieldId);
  const label = elements.renameFieldInput.value.trim();
  if (!field) return closeRenameField();
  if (!label) {
    elements.renameFieldStatus.textContent = "Enter a field name.";
    return;
  }
  field.label = label.slice(0, 60);
  closeRenameField();
  renderTemplateFields();
  updateCardPreview();
  markDirty();
}

function deleteField(fieldId) {
  for (const section of state.sections) {
    const fieldIndex = section.fields.findIndex((field) => field.id === fieldId);
    if (fieldIndex < 0) continue;
    const [deletedField] = section.fields.splice(fieldIndex, 1);
    renderTemplateFields();
    updateCardPreview();
    markDirty();
    setTemplateStatus(`${deletedField.label} deleted. Save to keep this change.`);
    return;
  }
}

function renderSetOptions(preferredCode = elements.templateSetInput.value || requestedSetCode) {
  const selectedCode = String(preferredCode || "DEFAULT").toUpperCase();
  const sets = state.sets.length ? state.sets : [{ code: "DEFAULT", name: "Default" }];
  elements.templateSetInput.replaceChildren();
  for (const cardSet of sets) {
    const option = document.createElement("option");
    option.value = cardSet.code || "DEFAULT";
    option.textContent = `${option.value} - ${cardSet.name || "Untitled Set"}`;
    elements.templateSetInput.append(option);
  }
  elements.templateSetInput.value = sets.some((cardSet) => cardSet.code === selectedCode)
    ? selectedCode
    : sets[0].code;
  updateCurrentSetLabel();
}

function updateCurrentSetLabel() {
  const setCode = elements.templateSetInput.value || "DEFAULT";
  const cardSet = state.sets.find((item) => (item.code || "DEFAULT") === setCode);
  elements.currentTemplateSetLabel.textContent = `Current set: ${setCode} - ${cardSet?.name || "Default"}`;
}

/** Returns the first available default template name within a set. */
function getNextDefaultTemplateName(templates = []) {
  const existingNames = new Set(
    templates.map((template) => String(template.name || "").trim().toLowerCase()),
  );
  let suffix = 1;
  while (existingNames.has(`template ${suffix}`)) suffix += 1;
  return `Template ${suffix}`;
}

function renderTemplateOptions(selectedTemplateId = state.currentTemplateId) {
  elements.myTemplatesInput.replaceChildren();
  const placeholder = document.createElement("option");
  placeholder.value = "";
  placeholder.textContent = state.templates.length
    ? "Choose a template"
    : "No templates saved for this set";
  placeholder.disabled = Boolean(state.templates.length);
  elements.myTemplatesInput.append(placeholder);

  for (const template of state.templates) {
    const option = document.createElement("option");
    option.value = template.templateId;
    option.textContent = template.name || "Untitled Template";
    elements.myTemplatesInput.append(option);
  }
  elements.myTemplatesInput.value = state.templates.some(
    (template) => template.templateId === selectedTemplateId,
  ) ? selectedTemplateId : "";
  elements.myTemplatesInput.disabled = state.templateNavigationPending || !state.templates.length;
}

async function refreshTemplatesForSet(
  setCode = elements.templateSetInput.value || "DEFAULT",
  selectedTemplateId = state.currentTemplateId,
) {
  const normalizedSetCode = String(setCode || "DEFAULT").toUpperCase();
  const data = await apiFetch(`/templates?set=${encodeURIComponent(normalizedSetCode)}`);
  state.templates = data.templates || [];
  renderTemplateOptions(selectedTemplateId);
  return state.templates;
}

async function refreshSets() {
  const data = await apiFetch("/sets");
  state.sets = data.sets || [];
  renderSetOptions();
}

function setLoadedTemplate(template) {
  state.currentTemplateId = template.templateId || "";
  state.originalTemplateName = template.name || "";
  state.originalSetCode = template.setCode || "DEFAULT";
  state.sections = normalizeSavedSections(template.sections);
  state.customFields = normalizeSavedCustomFields(template.customFields);
  elements.templateNameInput.value = state.originalTemplateName;
  renderSetOptions(state.originalSetCode);
  state.dirty = false;
  renderTemplateFields();
  renderCustomFields();
  updateCardPreview();
  updateCurrentSetLabel();
}

function resetNewTemplate(setCode = requestedSetCode) {
  state.currentTemplateId = "";
  state.originalTemplateName = "";
  state.originalSetCode = "";
  state.sections = createDefaultSections();
  state.customFields = [];
  elements.templateNameInput.value = "";
  renderSetOptions(setCode);
  state.dirty = false;
  renderTemplateFields();
  renderCustomFields();
  updateCardPreview();
}

async function loadRequestedTemplate() {
  const requestedTemplateId = new URLSearchParams(window.location.search).get("template") || "";
  if (!requestedTemplateId) {
    resetNewTemplate(requestedSetCode);
    const setCode = elements.templateSetInput.value || "DEFAULT";
    const templates = await refreshTemplatesForSet(setCode, "");
    if (!elements.templateNameInput.value.trim()) {
      elements.templateNameInput.value = getNextDefaultTemplateName(templates);
    }
    setTemplateStatus(`${elements.templateNameInput.value} is ready in ${setCode}.`);
    return;
  }

  await loadTemplateById(requestedTemplateId);
}

function waitForDialogChoice(dialog) {
  return new Promise((resolve) => {
    const handleClose = () => {
      dialog.removeEventListener("close", handleClose);
      resolve(dialog.returnValue || "cancel");
    };
    dialog.addEventListener("close", handleClose);
    dialog.returnValue = "cancel";
    dialog.showModal();
  });
}

function promptSaveUnsavedTemplateChanges(destination = "loading another template") {
  const templateName = elements.templateNameInput.value.trim() || "Untitled Template";
  elements.templateUnsavedChangesMessage.textContent = `Save changes to "${templateName}" before ${destination}?`;
  return waitForDialogChoice(elements.templateUnsavedChangesDialog);
}

async function resolveUnsavedTemplateChanges(destination) {
  if (!state.dirty) return true;
  const choice = await promptSaveUnsavedTemplateChanges(destination);
  if (choice === "cancel") return false;
  if (choice === "save") return saveTemplate();
  return choice === "discard";
}

async function loadTemplateById(templateId) {
  if (!templateId) return false;
  setTemplateStatus("Loading template...");
  try {
    const data = await apiFetch(`/templates/${encodeURIComponent(templateId)}`);
    setLoadedTemplate(data.template);
    let backgroundLoadError = "";
    try {
      await setTemplateFramePreview(getFieldValue("frameUrl"));
    } catch (error) {
      backgroundLoadError = error.message;
    }
    const url = new URL(window.location.href);
    url.searchParams.set("template", data.template.templateId);
    url.searchParams.delete("set");
    window.history.replaceState({}, "", url);
    try {
      await refreshTemplatesForSet(data.template.setCode, data.template.templateId);
    } catch (error) {
      state.templates = [];
      renderTemplateOptions();
      setTemplateStatus(`${data.template.name} loaded, but the template list could not be refreshed.`);
      return true;
    }
    setTemplateStatus(backgroundLoadError
      ? `${data.template.name} loaded. ${backgroundLoadError}`
      : `${data.template.name} loaded.`);
    return true;
  } catch (error) {
    setTemplateStatus(error.message);
    return false;
  }
}

async function handleTemplateSelectionChange() {
  const selectedTemplateId = elements.myTemplatesInput.value;
  if (!selectedTemplateId || selectedTemplateId === state.currentTemplateId || state.templateNavigationPending) return;

  state.templateNavigationPending = true;
  renderTemplateOptions(selectedTemplateId);
  try {
    const canContinue = await resolveUnsavedTemplateChanges("loading the selected template");
    if (!canContinue) return;
    await loadTemplateById(selectedTemplateId);
  } finally {
    state.templateNavigationPending = false;
    renderTemplateOptions(state.currentTemplateId);
  }
}

async function handleTemplateSetChange() {
  markDirty();
  if (!state.idToken || isJwtExpired(state.idToken)) {
    state.templates = [];
    renderTemplateOptions();
    return;
  }
  try {
    await refreshTemplatesForSet(elements.templateSetInput.value, "");
  } catch (error) {
    state.templates = [];
    renderTemplateOptions();
    setTemplateStatus(error.message);
  }
}

async function leaveTemplatePage(destination, navigate) {
  if (state.templateNavigationPending) return;
  state.templateNavigationPending = true;
  renderTemplateOptions();
  const canContinue = await resolveUnsavedTemplateChanges(destination);
  if (!canContinue) {
    state.templateNavigationPending = false;
    renderTemplateOptions(state.currentTemplateId);
    return;
  }

  state.allowPageExit = true;
  navigate();
}

function handleTemplatePageLink(event) {
  const anchor = event.target.closest("a[href]");
  if (
    !anchor
    || anchor.target === "_blank"
    || event.defaultPrevented
    || event.button !== 0
    || event.metaKey
    || event.ctrlKey
    || event.shiftKey
    || event.altKey
    || !state.dirty
  ) return;

  event.preventDefault();
  const destination = anchor === elements.templateHomeButton
    ? "going to the Home Page"
    : "leaving the template designer";
  leaveTemplatePage(destination, () => {
    window.location.href = anchor.href;
  });
}

function warnBeforeUnloadingTemplatePage(event) {
  if (!state.dirty || state.allowPageExit) return;
  event.preventDefault();
  event.returnValue = "";
}

async function getSaveDecision(name, setCode) {
  let finalSetCode = setCode;
  let saveMode = state.currentTemplateId ? "update" : "create";
  if (!state.currentTemplateId) return { saveMode, finalSetCode };

  if (setCode !== state.originalSetCode) {
    const moveChoice = await waitForDialogChoice(elements.templateSetChangeDialog);
    if (moveChoice === "cancel") return null;
    if (moveChoice === "no") {
      finalSetCode = state.originalSetCode;
      elements.templateSetInput.value = finalSetCode;
      updateCurrentSetLabel();
    }
  }

  if (name !== state.originalTemplateName) {
    const nameChoice = await waitForDialogChoice(elements.templateNameChangeDialog);
    if (nameChoice === "cancel") return null;
    saveMode = nameChoice === "copy" ? "create" : "update";
  }
  return { saveMode, finalSetCode };
}

function getSnapshotCssVariables() {
  const rootStyle = getComputedStyle(document.documentElement);
  return ["--accent", "--card-ratio", "--card-text", "--frame", "--panel", "--rarity-color"]
    .map((name) => `${name}: ${rootStyle.getPropertyValue(name).trim()};`)
    .join(" ");
}

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

function readBlobAsDataUrl(blob) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.addEventListener("load", () => resolve(reader.result));
    reader.addEventListener("error", () => reject(new Error("Template image could not be embedded.")));
    reader.readAsDataURL(blob);
  });
}

async function fetchImageBlob(src) {
  try {
    const directResponse = await fetch(src, {
      headers: src.startsWith(`${backendConfig.apiUrl}/`)
        ? { Authorization: `Bearer ${state.idToken}` }
        : {},
    });
    if (directResponse.ok) return directResponse.blob();
  } catch (error) {
    // Remote frame images may require the authenticated image proxy.
  }
  const proxyResponse = await fetch(
    `${backendConfig.apiUrl}/image-proxy?url=${encodeURIComponent(src)}`,
    { headers: { Authorization: `Bearer ${state.idToken}` } },
  );
  if (!proxyResponse.ok) throw new Error("Template image could not be embedded.");
  return proxyResponse.blob();
}

async function getEmbeddableTemplateImageSource(src) {
  if (!src || src.startsWith("data:")) return src;
  const blob = await fetchImageBlob(src);
  if (!blob.type.startsWith("image/")) throw new Error("Template image URL did not return an image.");
  return readBlobAsDataUrl(blob);
}

async function embedSnapshotImages(cardClone) {
  const originalImages = [...elements.card.querySelectorAll("img")];
  const clonedImages = [...cardClone.querySelectorAll("img")];
  await Promise.all(clonedImages.map(async (image, index) => {
    const originalImage = originalImages[index];
    const source = originalImage?.currentSrc || originalImage?.src || image.src;
    if (!source) return;
    if (source.startsWith("data:")) {
      image.setAttribute("src", source);
      return;
    }
    image.setAttribute("src", await getEmbeddableTemplateImageSource(source));
  }));
}

async function withEmbeddedPreviewImages(callback) {
  const images = [...elements.card.querySelectorAll("img")];
  const originalSources = images.map((image) => image.getAttribute("src"));
  const embeddedSources = await Promise.all(originalSources.map((source) => (
    source ? getEmbeddableTemplateImageSource(imageSourceToAbsoluteUrl(source)) : ""
  )));

  images.forEach((image, index) => {
    if (embeddedSources[index]) image.setAttribute("src", embeddedSources[index]);
  });
  await Promise.all(images.map((image) => (
    image.getAttribute("src") ? image.decode().catch(() => {}) : Promise.resolve()
  )));
  try {
    return await callback();
  } finally {
    images.forEach((image, index) => {
      if (originalSources[index] === null) image.removeAttribute("src");
      else image.setAttribute("src", originalSources[index]);
    });
  }
}

function imageSourceToAbsoluteUrl(source) {
  try {
    return new URL(source, window.location.href).href;
  } catch (error) {
    return source;
  }
}

function flattenTemplateCanvas(canvas) {
  const flattenedCanvas = document.createElement("canvas");
  flattenedCanvas.width = canvas.width;
  flattenedCanvas.height = canvas.height;
  const context = flattenedCanvas.getContext("2d");
  context.fillStyle = getFieldValue("frame", state.defaults.frame || "#263a31");
  context.fillRect(0, 0, flattenedCanvas.width, flattenedCanvas.height);
  context.drawImage(canvas, 0, 0);
  return flattenedCanvas;
}

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

async function createTemplateCanvas(scale = 2) {
  updateCardPreview();
  if (elements.cardFrameImage.getAttribute("src") && !elements.cardFrameImage.complete) {
    await elements.cardFrameImage.decode().catch(() => {});
  }
  if (document.fonts?.ready) await document.fonts.ready;
  await waitForRenderPaint();

  if (window.html2canvas) {
    return withEmbeddedPreviewImages(async () => {
      const canvas = await window.html2canvas(elements.card, {
        allowTaint: false,
        backgroundColor: null,
        logging: false,
        scale,
        useCORS: true,
      });
      return flattenTemplateCanvas(canvas);
    });
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
    const context = canvas.getContext("2d");
    context.scale(scale, scale);
    context.drawImage(image, 0, 0, width, height);
    return flattenTemplateCanvas(canvas);
  } finally {
    URL.revokeObjectURL(imageUrl);
  }
}

async function getTemplatePngDataUrl() {
  const canvas = await createTemplateCanvas(2);
  try {
    return canvas.toDataURL("image/png");
  } catch (error) {
    if (error?.name === "SecurityError") {
      throw new Error("Template preview contains an image that could not be safely exported.");
    }
    throw error;
  }
}

async function saveTemplate() {
  const name = elements.templateNameInput.value.trim();
  const selectedSetCode = elements.templateSetInput.value || "DEFAULT";
  if (!name) {
    setTemplateStatus("Enter a template name.");
    elements.templateNameInput.focus();
    return false;
  }

  const decision = await getSaveDecision(name, selectedSetCode);
  if (!decision) return false;

  elements.saveTemplateButton.disabled = true;
  setTemplateStatus(`Rendering ${name} preview...`);
  try {
    const templateImagePng = await getTemplatePngDataUrl();
    setTemplateStatus(`Saving ${name}...`);
    const requestPath = decision.saveMode === "create"
      ? "/templates"
      : `/templates/${encodeURIComponent(state.currentTemplateId)}`;
    const data = await apiFetch(requestPath, {
      method: decision.saveMode === "create" ? "POST" : "PUT",
      body: JSON.stringify({
        name,
        setCode: decision.finalSetCode,
        templateImagePng,
        sections: state.sections.map((section) => ({
          id: section.id,
          label: section.label,
          fields: section.fields.map(({ id, label, value }) => ({ id, label, value })),
        })),
        customFields: state.customFields.map((field) => ({
          name: field.name,
          dataType: field.dataType,
          position: { ...field.position },
          size: { ...field.size },
          color: field.color,
          options: [...field.options],
        })),
      }),
    });
    setLoadedTemplate(data.template);
    const url = new URL(window.location.href);
    url.searchParams.set("template", data.template.templateId);
    url.searchParams.delete("set");
    window.history.replaceState({}, "", url);
    try {
      await refreshTemplatesForSet(data.template.setCode, data.template.templateId);
    } catch (error) {
      state.templates = [];
      renderTemplateOptions();
    }
    setTemplateStatus(`${data.template.name} saved.`);
    return true;
  } catch (error) {
    setTemplateStatus(error.message);
    return false;
  } finally {
    elements.saveTemplateButton.disabled = !state.idToken || isJwtExpired(state.idToken);
  }
}

function handleFieldInput(event) {
  const fieldId = event.target.dataset.fieldId;
  if (!fieldId) return;
  const field = getField(fieldId);
  if (!field) return;
  field.value = event.target.value;
  updateCardPreview();
  markDirty();
}

function handleFieldAction(event) {
  const templateAction = event.target.closest("[data-template-action]");
  if (templateAction?.dataset.templateAction === "generate-background") {
    openGenerateTemplateBackgroundDialog();
    return;
  }
  const button = event.target.closest("[data-action][data-field-id]");
  if (!button) return;
  if (button.dataset.action === "rename") openRenameField(button.dataset.fieldId);
  if (button.dataset.action === "delete") deleteField(button.dataset.fieldId);
}

function closeTemplatePage() {
  leaveTemplatePage("closing the template designer", () => {
    if (window.history.length > 1) window.history.back();
    else window.location.href = "../";
  });
}

const accountAuth = new AccountAuthController({
  backendConfig,
  state,
  elements,
  renderAuthUi,
  setAuthStatus,
  onSignedIn: async () => {
    await refreshSets();
    await loadRequestedTemplate();
  },
});

function attachEvents() {
  accountAuth.attachEvents();
  elements.saveTemplateButton.addEventListener("click", saveTemplate);
  elements.closeTemplateButton.addEventListener("click", closeTemplatePage);
  elements.myTemplatesInput.addEventListener("change", handleTemplateSelectionChange);
  elements.addCustomFieldButton.addEventListener("click", () => openCustomFieldDialog());
  elements.customFieldsList.addEventListener("click", handleCustomFieldAction);
  elements.customFieldTypeInput.addEventListener("change", syncCustomFieldTypeUi);
  elements.addCustomFieldOptionButton.addEventListener("click", () => {
    const row = createCustomFieldOptionRow();
    elements.customFieldOptionList.append(row);
    row.querySelector("input").focus();
  });
  elements.customFieldOptionList.addEventListener("click", (event) => {
    const button = event.target.closest("[data-custom-option-action='delete']");
    if (button) button.closest(".custom-field-option-row")?.remove();
  });
  elements.customFieldForm.addEventListener("submit", (event) => {
    event.preventDefault();
    saveCustomFieldDefinition();
  });
  elements.cancelCustomFieldButton.addEventListener("click", closeCustomFieldDialog);
  elements.customFieldDialog.addEventListener("close", () => {
    state.editingCustomFieldName = "";
    elements.customFieldStatus.textContent = "";
  });
  elements.templateNameInput.addEventListener("input", markDirty);
  elements.templateSetInput.addEventListener("change", handleTemplateSetChange);
  elements.templateForm.addEventListener("submit", (event) => event.preventDefault());
  elements.templateFields.addEventListener("input", handleFieldInput);
  elements.templateFields.addEventListener("click", handleFieldAction);
  elements.generateTemplateBackgroundForm.addEventListener("submit", (event) => {
    event.preventDefault();
    generateTemplateBackground();
  });
  elements.cancelGenerateTemplateBackgroundButton.addEventListener("click", closeGenerateTemplateBackgroundDialog);
  elements.generateTemplateBackgroundDialog.addEventListener("cancel", (event) => {
    if (state.backgroundGenerating) event.preventDefault();
  });
  elements.renameFieldForm.addEventListener("submit", (event) => {
    event.preventDefault();
    renameField();
  });
  elements.cancelRenameFieldButton.addEventListener("click", closeRenameField);
  elements.accountMenuButton.addEventListener("click", () => {
    const open = elements.accountMenu.classList.contains("hidden");
    elements.accountMenu.classList.toggle("hidden", !open);
    elements.accountMenuButton.setAttribute("aria-expanded", String(open));
  });
  elements.signOutButton.addEventListener("click", signOut);
  document.addEventListener("click", (event) => {
    if (!elements.signedInPanel.contains(event.target)) closeAccountMenu();
  });
  document.addEventListener("click", handleTemplatePageLink);
  window.addEventListener("beforeunload", warnBeforeUnloadingTemplatePage);
  window.addEventListener("pagehide", revokeTemplateFramePreviewUrl);
}

async function loadDefaults() {
  const [defaultsResponse, typesResponse, rarityResponse] = await Promise.all([
    fetch("../defaults/card-defaults.json"),
    fetch("../defaults/card-types.json"),
    fetch("../defaults/rarity-info.json"),
  ]);
  if (!defaultsResponse.ok || !typesResponse.ok || !rarityResponse.ok) {
    throw new Error("Template defaults could not be loaded.");
  }
  state.defaults = await defaultsResponse.json();
  state.cardTypes = await typesResponse.json();
  state.rarityInfo = await rarityResponse.json();
}

async function initialize() {
  attachEvents();
  try {
    await loadDefaults();
    state.sections = createDefaultSections();
    state.customFields = [];
    state.templates = [];
    renderTemplateFields();
    renderCustomFields();
    renderTemplateOptions();
    updateCardPreview();
  } catch (error) {
    setTemplateStatus(error.message);
    return;
  }

  if (state.refreshToken && (!state.idToken || isJwtExpired(state.idToken))) await refreshAuthSession();
  renderAuthUi();
  if (state.idToken && !isJwtExpired(state.idToken)) {
    setAuthStatus(state.email ? `Signed in as ${state.email}` : "Signed in from this tab session");
    try {
      await refreshSets();
      await loadRequestedTemplate();
    } catch (error) {
      setTemplateStatus(error.message);
    }
  } else if (sessionStorage.getItem("cardDesignerIdToken") || sessionStorage.getItem("cardDesignerRefreshToken")) {
    clearAuthSession();
    setAuthStatus("Your session expired. Sign in again.");
  }
}

initialize();
