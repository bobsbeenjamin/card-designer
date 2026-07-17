const params = new URLSearchParams(window.location.search);
const user = params.get("user") || "";
const setName = params.get("set") || params.get("setName") || "";
const pageTitle = document.querySelector("#pageTitle");
const setMeta = document.querySelector("#setMeta");
const cardGrid = document.querySelector("#cardGrid");
const publicStatus = document.querySelector("#publicStatus");
const zoomDialog = document.querySelector("#cardZoomDialog");
const zoomContent = document.querySelector("#cardZoomContent");
const zoomClose = document.querySelector("#cardZoomClose");

function setStatus(message) {
  publicStatus.textContent = message;
}

/** Formats a stored collector number with the public set total. */
function formatCollectorNumber(number, total) {
  const rawValue = String(number || "").trim();
  const cardNumber = rawValue.split("/", 1)[0].trim();
  const parsedNumber = Number.parseInt(cardNumber, 10);
  const normalizedNumber = Number.isFinite(parsedNumber) && parsedNumber > 0 ? parsedNumber : 1;
  return `${normalizedNumber}/${Math.max(total, 1)}`;
}

function replaceMissingImage(image, card) {
  const empty = document.createElement("div");
  empty.className = "library-card-empty";
  empty.textContent = card.name || "Untitled Card";
  image.replaceWith(empty);
}

function openZoom(card) {
  zoomContent.innerHTML = "";
  if (card.imageUrl) {
    const image = document.createElement("img");
    image.alt = card.name || "Card image";
    image.src = card.imageUrl;
    image.addEventListener("error", () => replaceMissingImage(image, card));
    zoomContent.append(image);
  } else {
    const empty = document.createElement("div");
    empty.className = "library-card-empty";
    empty.textContent = card.name || "Untitled Card";
    zoomContent.append(empty);
  }
  zoomDialog.showModal();
}

function renderCard(card, total) {
  const tile = document.createElement("button");
  tile.className = "library-card-tile";
  tile.type = "button";
  tile.addEventListener("click", () => openZoom(card));

  if (card.imageUrl) {
    const image = document.createElement("img");
    image.className = "library-card-art";
    image.alt = card.name || "Card image";
    image.src = card.imageUrl;
    image.addEventListener("error", () => replaceMissingImage(image, card));
    tile.append(image);
  } else {
    const empty = document.createElement("div");
    empty.className = "library-card-empty";
    empty.textContent = card.name || "Untitled Card";
    tile.append(empty);
  }

  const label = document.createElement("span");
  label.className = "library-card-name";
  label.textContent = `[${formatCollectorNumber(card.collectorNumber, total)}] ${card.name || "Untitled Card"}`;
  tile.append(label);
  return tile;
}

async function loadPublicSet() {
  if (!user || !setName) {
    setMeta.textContent = "Missing public set parameters.";
    setStatus("Use /public/?user=<user>&set=<set-name>.");
    return;
  }

  const query = new URLSearchParams({ user, set: setName });
  const response = await fetch(`${window.backendConfig.apiUrl}/public/sets?${query}`);
  const data = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(data.error || data.message || "Unable to load this public set.");

  const cardSet = data.set || {};
  const cards = data.cards || [];
  const title = `Custom Set: ${cardSet.name || setName}`;
  document.title = title;
  pageTitle.textContent = title;
  setMeta.textContent = cardSet.code ? `${cardSet.code} - ${cards.length} cards` : `${cards.length} cards`;
  cardGrid.replaceChildren(...cards.map((card) => renderCard(card, cards.length)));
  setStatus(cards.length ? "" : "No cards are available in this set.");
}

zoomClose.addEventListener("click", () => zoomDialog.close());
zoomDialog.addEventListener("click", (event) => {
  if (event.target === zoomDialog) zoomDialog.close();
});

loadPublicSet().catch((error) => {
  setMeta.textContent = "Unable to load set.";
  setStatus(error.message);
});
