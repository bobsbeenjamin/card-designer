const defaults = {
  name: "Spanky and Our Gang",
  type: "Pop Culture",
  subtype: "Rock Band",
  cost: "4",
  statMode: "combat",
  attack: "1",
  health: "6",
  loyalty: "5",
  ability:
    "When this enters play or attacks, create a treasure token for each Rock Band you control.",
  flavor: '"Lazy day! Just right for lovin\' away!"',
  artist: "Ed Sullivan Show",
  collector: "012/180",
  rarity: "uncommon",
  fit: "cover",
  frame: "#263a31",
  accent: "#d69d42",
  text: "#f8f4e8",
  panel: "#fff7df",
};

const rarityColors = {
  common: "#b8c2bc",
  uncommon: "#8fb199",
  rare: "#5a8fcf",
  mythic: "#d07a35",
};

const rarityLabels = {
  common: "Common",
  uncommon: "Uncommon",
  rare: "Rare",
  mythic: "Mythic",
};

const elements = {
  card: document.querySelector("#card"),
  artWindow: document.querySelector(".art-window"),
  art: document.querySelector("#cardArt"),
  cardName: document.querySelector("#cardName"),
  cardType: document.querySelector("#cardType"),
  cardCost: document.querySelector("#cardCost"),
  cardAttack: document.querySelector("#cardAttack"),
  cardHealth: document.querySelector("#cardHealth"),
  cardLoyalty: document.querySelector("#cardLoyalty"),
  cardAbility: document.querySelector("#cardAbility"),
  cardFlavor: document.querySelector("#cardFlavor"),
  cardArtist: document.querySelector("#cardArtist"),
  cardCollector: document.querySelector("#cardCollector"),
  cardRarity: document.querySelector("#cardRarity"),
  nameInput: document.querySelector("#nameInput"),
  typeInput: document.querySelector("#typeInput"),
  subtypeInput: document.querySelector("#subtypeInput"),
  costInput: document.querySelector("#costInput"),
  statModeInput: document.querySelector("#statModeInput"),
  combatInputs: document.querySelector("#combatInputs"),
  loyaltyInputs: document.querySelector("#loyaltyInputs"),
  attackInput: document.querySelector("#attackInput"),
  healthInput: document.querySelector("#healthInput"),
  loyaltyInput: document.querySelector("#loyaltyInput"),
  abilityInput: document.querySelector("#abilityInput"),
  flavorInput: document.querySelector("#flavorInput"),
  artistInput: document.querySelector("#artistInput"),
  collectorInput: document.querySelector("#collectorInput"),
  rarityInput: document.querySelector("#rarityInput"),
  artInput: document.querySelector("#artInput"),
  fitInput: document.querySelector("#fitInput"),
  frameColor: document.querySelector("#frameColor"),
  accentColor: document.querySelector("#accentColor"),
  textColor: document.querySelector("#textColor"),
  panelColor: document.querySelector("#panelColor"),
  resetCard: document.querySelector("#resetCard"),
  exportPng: document.querySelector("#exportPng"),
};

function updateText(target, value, fallback) {
  target.textContent = value.trim() || fallback;
}

function formatCost(value) {
  return `$${value.trim() || "0"}`;
}

function syncCard() {
  const subtype = elements.subtypeInput.value.trim();
  const typeLine = subtype
    ? `${elements.typeInput.value.trim() || "Card"} - ${subtype}`
    : elements.typeInput.value;
  const isLoyalty = elements.statModeInput.value === "loyalty";
  const rarity = elements.rarityInput.value;

  updateText(elements.cardName, elements.nameInput.value, "Untitled Card");
  updateText(elements.cardType, typeLine, "Card");
  elements.cardCost.textContent = formatCost(elements.costInput.value);
  updateText(elements.cardAttack, elements.attackInput.value, "0");
  updateText(elements.cardHealth, elements.healthInput.value, "0");
  updateText(elements.cardLoyalty, elements.loyaltyInput.value, "0");
  updateText(elements.cardAbility, elements.abilityInput.value, "Add rules text.");
  updateText(elements.cardFlavor, elements.flavorInput.value, "");
  updateText(
    elements.cardArtist,
    elements.artistInput.value ? `Art: ${elements.artistInput.value}` : "",
    "Art: Unknown",
  );
  updateText(elements.cardCollector, elements.collectorInput.value, "000/000");
  updateText(elements.cardRarity, rarityLabels[rarity], "Common");

  elements.card.classList.toggle("is-loyalty", isLoyalty);
  elements.combatInputs.classList.toggle("hidden", isLoyalty);
  elements.loyaltyInputs.classList.toggle("hidden", !isLoyalty);
  elements.art.style.objectFit = elements.fitInput.value;
  document.documentElement.style.setProperty("--frame", elements.frameColor.value);
  document.documentElement.style.setProperty("--accent", elements.accentColor.value);
  document.documentElement.style.setProperty("--card-text", elements.textColor.value);
  document.documentElement.style.setProperty("--panel", elements.panelColor.value);
  document.documentElement.style.setProperty("--rarity-color", rarityColors[rarity]);
}

function resetCard() {
  elements.nameInput.value = defaults.name;
  elements.typeInput.value = defaults.type;
  elements.subtypeInput.value = defaults.subtype;
  elements.costInput.value = defaults.cost;
  elements.statModeInput.value = defaults.statMode;
  elements.attackInput.value = defaults.attack;
  elements.healthInput.value = defaults.health;
  elements.loyaltyInput.value = defaults.loyalty;
  elements.abilityInput.value = defaults.ability;
  elements.flavorInput.value = defaults.flavor;
  elements.artistInput.value = defaults.artist;
  elements.collectorInput.value = defaults.collector;
  elements.rarityInput.value = defaults.rarity;
  elements.fitInput.value = defaults.fit;
  elements.frameColor.value = defaults.frame;
  elements.accentColor.value = defaults.accent;
  elements.textColor.value = defaults.text;
  elements.panelColor.value = defaults.panel;
  elements.artInput.value = "";
  elements.art.removeAttribute("src");
  elements.artWindow.classList.remove("has-image");
  syncCard();
}

function loadArt(event) {
  const [file] = event.target.files;
  if (!file) return;

  const reader = new FileReader();
  reader.addEventListener("load", () => {
    elements.art.src = reader.result;
    elements.artWindow.classList.add("has-image");
  });
  reader.readAsDataURL(file);
}

function drawWrappedText(ctx, text, x, y, maxWidth, lineHeight, maxLines) {
  const words = text.split(/\s+/).filter(Boolean);
  let line = "";
  let lines = 0;

  for (const word of words) {
    const testLine = line ? `${line} ${word}` : word;
    if (ctx.measureText(testLine).width > maxWidth && line) {
      ctx.fillText(line, x, y);
      y += lineHeight;
      line = word;
      lines += 1;
      if (lines >= maxLines - 1) break;
    } else {
      line = testLine;
    }
  }

  if (line && lines < maxLines) {
    ctx.fillText(line, x, y);
  }
}

function roundRect(ctx, x, y, width, height, radius) {
  ctx.beginPath();
  ctx.moveTo(x + radius, y);
  ctx.arcTo(x + width, y, x + width, y + height, radius);
  ctx.arcTo(x + width, y + height, x, y + height, radius);
  ctx.arcTo(x, y + height, x, y, radius);
  ctx.arcTo(x, y, x + width, y, radius);
  ctx.closePath();
}

function drawImageFit(ctx, image, x, y, width, height, fit) {
  if (fit === "fill") {
    ctx.drawImage(image, x, y, width, height);
    return;
  }

  const imageRatio = image.naturalWidth / image.naturalHeight;
  const targetRatio = width / height;
  const shouldCover = fit === "cover";
  const useWidth = shouldCover ? imageRatio < targetRatio : imageRatio > targetRatio;
  const drawWidth = useWidth ? width : height * imageRatio;
  const drawHeight = useWidth ? width / imageRatio : height;
  const drawX = x + (width - drawWidth) / 2;
  const drawY = y + (height - drawHeight) / 2;

  ctx.drawImage(image, drawX, drawY, drawWidth, drawHeight);
}

async function exportPng() {
  if (elements.art.src && !elements.art.complete) {
    await elements.art.decode().catch(() => {});
  }

  const scale = 3;
  const width = 630;
  const height = 880;
  const subtype = elements.subtypeInput.value.trim();
  const typeLine = subtype
    ? `${elements.typeInput.value.trim() || "Card"} - ${subtype}`
    : elements.typeInput.value || "Card";
  const rarity = elements.rarityInput.value;
  const isLoyalty = elements.statModeInput.value === "loyalty";
  const canvas = document.createElement("canvas");
  canvas.width = width * scale;
  canvas.height = height * scale;
  const ctx = canvas.getContext("2d");
  ctx.scale(scale, scale);

  ctx.fillStyle = elements.frameColor.value;
  roundRect(ctx, 0, 0, width, height, 32);
  ctx.fill();

  ctx.strokeStyle = elements.accentColor.value;
  ctx.lineWidth = 8;
  roundRect(ctx, 28, 28, width - 56, height - 56, 18);
  ctx.stroke();

  ctx.fillStyle = elements.textColor.value;
  ctx.font = "700 20px system-ui";
  ctx.fillText(typeLine, 48, 72);
  ctx.font = "700 40px Georgia";
  ctx.fillText(elements.nameInput.value || "Untitled Card", 48, 118);

  ctx.fillStyle = elements.accentColor.value;
  ctx.beginPath();
  ctx.arc(550, 82, 39, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = "#191510";
  ctx.font = "900 38px system-ui";
  ctx.textAlign = "center";
  ctx.fillText(formatCost(elements.costInput.value), 550, 96);
  ctx.textAlign = "left";

  ctx.save();
  roundRect(ctx, 48, 148, 534, 356, 14);
  ctx.clip();
  if (elements.art.src) {
    drawImageFit(ctx, elements.art, 48, 148, 534, 356, elements.fitInput.value);
  } else {
    const gradient = ctx.createLinearGradient(48, 148, 582, 504);
    gradient.addColorStop(0, elements.accentColor.value);
    gradient.addColorStop(1, "#35473d");
    ctx.fillStyle = gradient;
    ctx.fillRect(48, 148, 534, 356);
    ctx.fillStyle = "rgba(255,255,255,0.72)";
    ctx.font = "900 72px system-ui";
    ctx.textAlign = "center";
    ctx.fillText("ART", 315, 345);
    ctx.textAlign = "left";
  }
  ctx.restore();

  ctx.save();
  ctx.fillStyle = elements.panelColor.value;
  roundRect(ctx, 48, 528, 534, 212, 14);
  ctx.fill();
  ctx.fillStyle = "#242014";
  ctx.font = "26px system-ui";
  drawWrappedText(ctx, elements.abilityInput.value || "Add rules text.", 68, 575, 494, 34, 4);
  ctx.strokeStyle = "rgba(0,0,0,0.2)";
  ctx.beginPath();
  ctx.moveTo(68, 665);
  ctx.lineTo(562, 665);
  ctx.stroke();
  ctx.fillStyle = "#66573b";
  ctx.font = "italic 22px Georgia";
  drawWrappedText(ctx, elements.flavorInput.value, 68, 704, 494, 29, 2);
  ctx.restore();

  ctx.save();
  ctx.translate(62, 862);
  ctx.rotate(Math.PI / 4);
  ctx.fillStyle = rarityColors[rarity];
  ctx.fillRect(-9, -9, 18, 18);
  ctx.restore();
  ctx.fillStyle = elements.textColor.value;
  ctx.font = "700 15px system-ui";
  ctx.fillText(rarityLabels[rarity], 84, 868);
  ctx.fillText(`Art: ${elements.artistInput.value || "Unknown"}`, 162, 868);
  ctx.textAlign = "right";
  ctx.fillText(elements.collectorInput.value || "000/000", 562, 868);
  ctx.textAlign = "left";

  ctx.fillStyle = "rgba(0,0,0,0.22)";
  if (isLoyalty) {
    roundRect(ctx, 442, 766, 134, 54, 27);
    ctx.fill();
  } else {
    roundRect(ctx, 388, 766, 82, 54, 27);
    ctx.fill();
    roundRect(ctx, 494, 766, 82, 54, 27);
    ctx.fill();
  }
  ctx.fillStyle = elements.textColor.value;
  ctx.font = "900 18px system-ui";
  ctx.font = "900 30px system-ui";
  if (isLoyalty) {
    ctx.font = "900 15px system-ui";
    ctx.fillText("LOYALTY", 460, 799);
    ctx.font = "900 30px system-ui";
    ctx.fillText(elements.loyaltyInput.value || "0", 540, 802);
  } else {
    ctx.font = "900 18px system-ui";
    ctx.fillText("ATK", 405, 799);
    ctx.fillText("HP", 514, 799);
    ctx.font = "900 30px system-ui";
    ctx.fillText(elements.attackInput.value || "0", 445, 802);
    ctx.fillText(elements.healthInput.value || "0", 550, 802);
  }

  const link = document.createElement("a");
  link.download = `${(elements.nameInput.value || "card").trim().replace(/\W+/g, "-").toLowerCase()}-front.png`;
  link.href = canvas.toDataURL("image/png");
  link.click();
}

document.querySelectorAll("input, textarea, select").forEach((control) => {
  control.addEventListener("input", syncCard);
});

elements.artInput.addEventListener("change", loadArt);
elements.resetCard.addEventListener("click", resetCard);
elements.exportPng.addEventListener("click", () => {
  exportPng();
});

syncCard();
