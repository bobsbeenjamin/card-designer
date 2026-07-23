const params = new URLSearchParams(window.location.search);
const user = params.get("user") || "";
const setName = params.get("set") || params.get("setName") || "";
const pageTitle = document.querySelector("#pageTitle");
const setMeta = document.querySelector("#setMeta");
const cardGrid = document.querySelector("#cardGrid");
const publicStatus = document.querySelector("#publicStatus");
const zoomDialog = document.querySelector("#cardZoomDialog");
const zoomViewer = document.querySelector(".card-zoom-viewer");
const zoomContent = document.querySelector("#cardZoomContent");
const zoomClose = document.querySelector("#cardZoomClose");
const previousZoomCardButton = document.querySelector("#previousZoomCardButton");
const nextZoomCardButton = document.querySelector("#nextZoomCardButton");

let zoomCards = [];
let zoomCardIndex = -1;
let zoomTouchStart = null;

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

/** Opens a public card in the zoom viewer. */
function openZoom(card) {
  zoomCardIndex = zoomCards.indexOf(card);
  renderZoomCard(card);
  if (!zoomDialog.open) zoomDialog.showModal();
}

/** Updates the zoom viewer content for the selected public card. */
function renderZoomCard(card) {
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

  previousZoomCardButton.disabled = zoomCardIndex <= 0;
  nextZoomCardButton.disabled = zoomCardIndex < 0 || zoomCardIndex >= zoomCards.length - 1;
}

/** Navigates to another card while keeping the zoom viewer open. */
function navigateZoomCard(offset) {
  const nextIndex = zoomCardIndex + offset;
  if (nextIndex < 0 || nextIndex >= zoomCards.length) return;

  zoomCardIndex = nextIndex;
  renderZoomCard(zoomCards[zoomCardIndex]);
}

/** Records the start of a possible horizontal card swipe. */
function handleZoomSwipeStart(event) {
  if (event.touches.length !== 1) return;
  zoomTouchStart = {
    x: event.touches[0].clientX,
    y: event.touches[0].clientY,
  };
}

/** Navigates on horizontal swipes without blocking vertical page movement. */
function handleZoomSwipeEnd(event) {
  if (!zoomTouchStart || event.changedTouches.length !== 1) return;

  const start = zoomTouchStart;
  zoomTouchStart = null;
  const deltaX = event.changedTouches[0].clientX - start.x;
  const deltaY = event.changedTouches[0].clientY - start.y;
  if (Math.abs(deltaX) < 40 || Math.abs(deltaX) <= Math.abs(deltaY)) return;

  navigateZoomCard(deltaX < 0 ? 1 : -1);
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
  document.title =
    cardSet.code
    ? `[${cardSet.code}] ${cardSet.name || setName} - public link - Card Designer`
    : `${cardSet.name || setName} - public link - Card Designer`;
  pageTitle.textContent = title;
  setMeta.textContent = cardSet.code ? `${cardSet.code} - ${cards.length} cards` : `${cards.length} cards`;
  zoomCards = cards;
  cardGrid.replaceChildren(...cards.map((card) => renderCard(card, cards.length)));
  setStatus(cards.length ? "" : "No cards are available in this set.");
}

previousZoomCardButton.addEventListener("click", () => navigateZoomCard(-1));
nextZoomCardButton.addEventListener("click", () => navigateZoomCard(1));
zoomViewer.addEventListener("touchstart", handleZoomSwipeStart, { passive: true });
zoomViewer.addEventListener("touchend", handleZoomSwipeEnd, { passive: true });
zoomClose.addEventListener("click", () => zoomDialog.close());
zoomDialog.addEventListener("click", (event) => {
  if (event.target === zoomDialog) zoomDialog.close();
});

loadPublicSet().catch((error) => {
  setMeta.textContent = "Unable to load set.";
  setStatus(error.message);
});
