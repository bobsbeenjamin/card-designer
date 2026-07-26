const backendConfig = window.backendConfig;
const requestedFriend = new URLSearchParams(window.location.search).get("friend") || "";

const state = {
  idToken: sessionStorage.getItem("cardDesignerIdToken") || "",
  refreshToken: sessionStorage.getItem("cardDesignerRefreshToken") || "",
  email: sessionStorage.getItem("cardDesignerEmail") || "",
  friends: [],
  pendingRemoval: "",
};

const elements = {
  signInPanel: document.querySelector("#signInPanel"),
  friendsPageContent: document.querySelector("#friendsPageContent"),
  friendsTitle: document.querySelector("#friendsTitle"),
  friendsStatus: document.querySelector("#friendsStatus"),
  friendsList: document.querySelector("#friendsList"),
  noFriendsMessage: document.querySelector("#noFriendsMessage"),
  friendsCloseButton: document.querySelector("#friendsCloseButton"),
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
  authStatus: document.querySelector("#authStatus"),
  addFriendButton: document.querySelector("#addFriendButton"),
  addFriendDialog: document.querySelector("#addFriendDialog"),
  addFriendForm: document.querySelector("#addFriendForm"),
  friendUsernameInput: document.querySelector("#friendUsernameInput"),
  addFriendStatus: document.querySelector("#addFriendStatus"),
  confirmAddFriendButton: document.querySelector("#confirmAddFriendButton"),
  cancelAddFriendButton: document.querySelector("#cancelAddFriendButton"),
  removeFriendDialog: document.querySelector("#removeFriendDialog"),
  removeFriendMessage: document.querySelector("#removeFriendMessage"),
  confirmRemoveFriendButton: document.querySelector("#confirmRemoveFriendButton"),
};

function setStatus(message) {
  elements.friendsStatus.textContent = message;
}

function getJwtPayload(token) {
  if (!token) return null;
  try {
    const encoded = token.split(".")[1].replace(/-/g, "+").replace(/_/g, "/");
    return JSON.parse(atob(encoded.padEnd(Math.ceil(encoded.length / 4) * 4, "=")));
  } catch (error) {
    return null;
  }
}

function isJwtExpired(token) {
  const payload = getJwtPayload(token);
  return !payload?.exp || payload.exp * 1000 <= Date.now();
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

function renderAuthUi() {
  const signedIn = Boolean(state.idToken) && !isJwtExpired(state.idToken);
  elements.signInPanel.classList.toggle("hidden", signedIn);
  elements.friendsPageContent.classList.toggle("hidden", !signedIn);
}

function clearAuthSession() {
  state.idToken = "";
  state.refreshToken = "";
  state.email = "";
  sessionStorage.removeItem("cardDesignerIdToken");
  sessionStorage.removeItem("cardDesignerRefreshToken");
  sessionStorage.removeItem("cardDesignerEmail");
  renderAuthUi();
}

async function apiFetch(path, options = {}) {
  if (!state.idToken || (isJwtExpired(state.idToken) && !(await refreshAuthSession()))) {
    clearAuthSession();
    throw new Error("Your session expired. Sign in again to view your friends.");
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
    throw new Error("Your session expired. Sign in again to view your friends.");
  }
  if (!response.ok) throw new Error(data.error || `API request failed with ${response.status}.`);
  return data;
}

function setAuthStatus(message) {
  elements.authStatus.textContent = message;
}

const accountAuth = new AccountAuthController({
  backendConfig,
  state,
  elements,
  renderAuthUi,
  setAuthStatus,
  onSignedIn: loadPage,
});

function createDeleteButton(username) {
  const button = document.createElement("button");
  button.className = "set-delete-button";
  button.type = "button";
  button.title = `Remove ${username} from your friends`;
  button.setAttribute("aria-label", `Remove ${username} from your friends`);
  button.innerHTML = '<span class="trash-icon" aria-hidden="true"></span>';
  button.addEventListener("click", () => {
    state.pendingRemoval = username;
    elements.removeFriendMessage.textContent = `Do you want to unfriend ${username}?`;
    elements.removeFriendDialog.showModal();
  });
  return button;
}

function renderFriends() {
  elements.friendsTitle.textContent = "My Friends";
  elements.friendsList.replaceChildren();
  elements.noFriendsMessage.classList.toggle("hidden", state.friends.length > 0);
  for (const friend of state.friends) {
    const row = document.createElement("div");
    const identity = document.createElement("div");
    const link = document.createElement("a");
    row.className = "friend-row";
    identity.className = "friend-identity";
    link.href = `./index.html?friend=${encodeURIComponent(friend.username)}`;
    link.textContent = friend.username;
    identity.append(link);
    if (friend.followsBack) {
      const check = document.createElement("span");
      check.className = "follows-back-check";
      check.textContent = "✓";
      check.title = `${friend.username} follows you back`;
      check.setAttribute("aria-label", `${friend.username} follows you back`);
      identity.append(check);
    }
    row.append(identity, createDeleteButton(friend.username));
    elements.friendsList.append(row);
  }
  setStatus("");
}

function renderFriendSets(data) {
  const username = data.username || requestedFriend;
  elements.friendsTitle.textContent = `${username}'s Sets`;
  document.title = `${username}'s Sets - Card Designer`;
  elements.friendsList.replaceChildren();
  for (const cardSet of data.sets || []) {
    const row = document.createElement(cardSet.isPublic ? "a" : "div");
    row.className = `friend-set-row${cardSet.isPublic ? " public" : ""}`;
    if (cardSet.isPublic) {
      const query = new URLSearchParams({ user: data.publicUserId, set: cardSet.code });
      row.href = `../public/?${query}`;
    }
    const code = document.createElement("strong");
    const name = document.createElement("span");
    const visibility = document.createElement("span");
    code.textContent = cardSet.code || "DEFAULT";
    name.textContent = cardSet.name || "Untitled Set";
    visibility.className = `friend-set-visibility ${cardSet.isPublic ? "public" : "private"}`;
    visibility.textContent = cardSet.isPublic ? "Public" : "Private";
    row.append(code, name, visibility);
    elements.friendsList.append(row);
  }
  elements.addFriendButton.classList.add("hidden");
  setStatus((data.sets || []).length ? "" : `${username} has no sets.`);
}

async function loadPage() {
  renderAuthUi();
  setStatus(requestedFriend ? `Loading ${requestedFriend}'s sets...` : "Loading your friends...");
  if (requestedFriend) {
    const data = await apiFetch(`/friends/${encodeURIComponent(requestedFriend)}/sets`);
    renderFriendSets(data);
  } else {
    const data = await apiFetch("/friends");
    state.friends = data.friends || [];
    renderFriends();
  }
}

function openAddFriendDialog() {
  elements.addFriendForm.reset();
  elements.addFriendStatus.textContent = "";
  elements.addFriendDialog.showModal();
  elements.friendUsernameInput.focus();
}

async function addFriend() {
  const username = elements.friendUsernameInput.value.trim();
  if (!username) {
    elements.addFriendStatus.textContent = "Enter a username.";
    return;
  }
  elements.confirmAddFriendButton.disabled = true;
  try {
    await apiFetch("/friends", {
      method: "POST",
      body: JSON.stringify({ username }),
    });
    elements.addFriendDialog.close();
    await loadPage();
  } catch (error) {
    elements.addFriendStatus.textContent =
      error.message.includes("ConditionalCheckFailed") ? `${username} is already your friend.` : error.message;
  } finally {
    elements.confirmAddFriendButton.disabled = false;
  }
}

async function removeFriend(username) {
  try {
    await apiFetch(`/friends/${encodeURIComponent(username)}`, { method: "DELETE" });
    await loadPage();
  } catch (error) {
    setStatus(error.message);
  }
}

function attachEvents() {
  accountAuth.attachEvents();
  elements.addFriendButton.addEventListener("click", openAddFriendDialog);
  elements.addFriendForm.addEventListener("submit", (event) => {
    event.preventDefault();
    addFriend();
  });
  elements.cancelAddFriendButton.addEventListener("click", () => elements.addFriendDialog.close());
  elements.removeFriendDialog.addEventListener("close", () => {
    const username = state.pendingRemoval;
    state.pendingRemoval = "";
    if (elements.removeFriendDialog.returnValue === "yes" && username) removeFriend(username);
  });
}

async function initialize() {
  attachEvents();
  elements.friendsCloseButton.href = requestedFriend ? "./index.html" : "../";
  elements.addFriendButton.classList.toggle("hidden", Boolean(requestedFriend));
  renderAuthUi();
  if (state.refreshToken && (!state.idToken || isJwtExpired(state.idToken))) await refreshAuthSession();
  if (!state.idToken || isJwtExpired(state.idToken)) {
    if (sessionStorage.getItem("cardDesignerIdToken") || sessionStorage.getItem("cardDesignerRefreshToken")) {
      clearAuthSession();
      setAuthStatus("Your session expired. Sign in again.");
    }
    return;
  }
  setAuthStatus(state.email ? `Signed in as ${state.email}` : "Signed in from this tab session");
  await loadPage();
}

initialize().catch((error) => setStatus(error.message));
