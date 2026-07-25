/* Shared sign-in and sign-up behavior for every Card Designer entry page. */
class AccountAuthController {
  constructor({ backendConfig, state, elements, renderAuthUi, setAuthStatus, onSignedIn }) {
    this.backendConfig = backendConfig;
    this.state = state;
    this.elements = elements;
    this.renderAuthUi = renderAuthUi;
    this.setAuthStatus = setAuthStatus;
    this.onSignedIn = onSignedIn;
    this.availabilityTimer = 0;
    this.availabilityRequest = 0;
  }

  async publicApiFetch(path, options = {}) {
    const response = await fetch(`${this.backendConfig.apiUrl}${path}`, {
      ...options,
      headers: { "content-type": "application/json", ...(options.headers || {}) },
    });
    const data = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error(data.error || `Request failed with ${response.status}.`);
    return data;
  }

  async cognitoRequest(target, payload) {
    const response = await fetch(`https://cognito-idp.${this.backendConfig.region}.amazonaws.com/`, {
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

  getJwtPayload(token) {
    try {
      const encoded = token.split(".")[1].replace(/-/g, "+").replace(/_/g, "/");
      return JSON.parse(atob(encoded.padEnd(Math.ceil(encoded.length / 4) * 4, "=")));
    } catch (error) {
      return {};
    }
  }

  setAvailability(reason) {
    const messages = {
      available: "This name is available",
      unavailable: "This name is unavailable",
      too_short: "This name is too short",
    };
    this.elements.usernameAvailabilityStatus.className = `username-availability ${reason || ""}`.trim();
    this.elements.usernameAvailabilityStatus.textContent = messages[reason] || "";
  }

  async checkUsernameAvailability() {
    const username = this.elements.signUpUsernameInput.value.trim();
    const requestId = ++this.availabilityRequest;
    if (!username) {
      this.setAvailability("");
      return true;
    }
    if (username.length < 3) {
      this.setAvailability("too_short");
      return false;
    }
    try {
      const data = await this.publicApiFetch(`/usernames/availability?username=${encodeURIComponent(username)}`);
      if (requestId !== this.availabilityRequest) return false;
      this.setAvailability(data.available ? "available" : "unavailable");
      return Boolean(data.available);
    } catch (error) {
      if (requestId === this.availabilityRequest) {
        this.setAvailability("");
        this.elements.signUpStatus.textContent = error.message;
      }
      return false;
    }
  }

  queueUsernameAvailabilityCheck() {
    window.clearTimeout(this.availabilityTimer);
    const username = this.elements.signUpUsernameInput.value.trim();
    if (!username || username.length < 3) {
      this.checkUsernameAvailability();
      return;
    }
    this.availabilityTimer = window.setTimeout(() => this.checkUsernameAvailability(), 300);
  }

  openSignUp() {
    this.elements.signUpStatus.textContent = "";
    this.elements.confirmationFields.classList.add("hidden");
    this.elements.signUpButton.classList.remove("hidden");
    this.elements.signUpDialog.showModal();
    this.elements.signUpEmailInput.focus();
  }

  closeSignUp() {
    window.clearTimeout(this.availabilityTimer);
    this.elements.signUpDialog.close();
    this.elements.signUpForm.reset();
    this.elements.confirmationFields.classList.add("hidden");
    this.elements.signUpButton.classList.remove("hidden");
    this.elements.signUpStatus.textContent = "";
    this.setAvailability("");
  }

  async signUp() {
    const email = this.elements.signUpEmailInput.value.trim();
    const password = this.elements.signUpPasswordInput.value;
    const enteredUsername = this.elements.signUpUsernameInput.value.trim();
    const username = enteredUsername || email;
    this.elements.signUpStatus.textContent = "";

    try {
      if (!email || !password) throw new Error("Enter an email and password first.");
      if (enteredUsername && !(await this.checkUsernameAvailability())) {
        throw new Error(enteredUsername.length < 3 ? "Username must be at least 3 characters." : "Choose an available username.");
      }
      await this.cognitoRequest("SignUp", {
        ClientId: this.backendConfig.userPoolClientId,
        Username: username,
        Password: password,
        UserAttributes: [{ Name: "email", Value: email }],
      });
      this.elements.confirmationFields.classList.remove("hidden");
      this.elements.signUpButton.classList.add("hidden");
      this.elements.signUpPasswordInput.value = "";
      this.elements.signUpStatus.textContent = "Check your email for a confirmation code.";
      this.elements.confirmationInput.focus();
    } catch (error) {
      this.elements.signUpStatus.textContent = error.message;
    }
  }

  async confirmAccount() {
    try {
      const email = this.elements.signUpEmailInput.value.trim();
      const username = this.elements.signUpUsernameInput.value.trim() || email;
      const code = this.elements.confirmationInput.value.trim();
      if (!email || !code) throw new Error("Enter email and confirmation code.");
      await this.cognitoRequest("ConfirmSignUp", {
        ClientId: this.backendConfig.userPoolClientId,
        Username: username,
        ConfirmationCode: code,
      });
      this.elements.signUpStatus.textContent = "Account confirmed. You can sign in now.";
      this.elements.usernameInput.value = this.elements.signUpUsernameInput.value.trim() || email;
    } catch (error) {
      this.elements.signUpStatus.textContent = error.message;
    }
  }

  async signIn() {
    const username = this.elements.usernameInput.value.trim();
    const password = this.elements.passwordInput.value;
    try {
      if (!username || !password) throw new Error("Enter a username and password first.");
      const data = await this.cognitoRequest("InitiateAuth", {
        ClientId: this.backendConfig.userPoolClientId,
        AuthFlow: "USER_PASSWORD_AUTH",
        AuthParameters: { USERNAME: username, PASSWORD: password },
      });
      const authentication = data.AuthenticationResult || {};
      this.state.idToken = authentication.IdToken;
      this.state.refreshToken = authentication.RefreshToken || this.state.refreshToken;
      this.state.email = this.getJwtPayload(this.state.idToken).email || username;
      sessionStorage.setItem("cardDesignerIdToken", this.state.idToken);
      sessionStorage.setItem("cardDesignerRefreshToken", this.state.refreshToken);
      sessionStorage.setItem("cardDesignerEmail", this.state.email);
      this.elements.passwordInput.value = "";
      this.renderAuthUi();
      this.setAuthStatus(`Signed in as ${username}`);
      await this.onSignedIn();
    } catch (error) {
      this.setAuthStatus(error.message);
    }
  }

  cancelSignIn() {
    this.elements.usernameInput.value = "";
    this.elements.passwordInput.value = "";
    this.setAuthStatus("");
  }

  attachEvents() {
    this.elements.signInButton.addEventListener("click", () => this.signIn());
    this.elements.cancelSignInButton.addEventListener("click", () => this.cancelSignIn());
    this.elements.openSignUpButton.addEventListener("click", () => this.openSignUp());
    this.elements.cancelSignUpButton.addEventListener("click", () => this.closeSignUp());
    this.elements.signUpUsernameInput.addEventListener("input", () => this.queueUsernameAvailabilityCheck());
    this.elements.signUpForm.addEventListener("submit", (event) => {
      event.preventDefault();
      this.signUp();
    });
    this.elements.confirmButton.addEventListener("click", () => this.confirmAccount());
  }
}
