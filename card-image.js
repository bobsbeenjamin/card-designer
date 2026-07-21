/** Regenerates and persists affected cards through the full browser renderer. */
async function regenerateCardImages({ cards, apiFetch, onProgress, renderCardPng, setTotal }) {
  const cardsToRegenerate = cards.filter((card) => card?.cardId);
  if (!cardsToRegenerate.length) return 0;

  const failures = [];
  let regeneratedCount = 0;
  onProgress?.(`Regenerating card images (0/${cardsToRegenerate.length})...`);

  for (const card of cardsToRegenerate) {
    try {
      const data = await apiFetch(`/cards/${encodeURIComponent(card.cardId)}`);
      const fullCard = { ...card, ...(data.card || {}) };
      const cardImagePng = await renderCardPng(fullCard, setTotal);
      await apiFetch(`/cards/${encodeURIComponent(card.cardId)}/image`, {
        method: "PUT",
        body: JSON.stringify({ cardImagePng }),
      });
      card.imageUrl = cardImagePng;
      regeneratedCount += 1;
    } catch (error) {
      failures.push(`${card.name || "Untitled Card"}: ${error.message}`);
    }
    onProgress?.(`Regenerating card images (${regeneratedCount + failures.length}/${cardsToRegenerate.length})...`);
  }

  if (failures.length) {
    throw new Error(`${regeneratedCount} of ${cardsToRegenerate.length} card images regenerated. Failed: ${failures.join("; ")}`);
  }
  return regeneratedCount;
}

window.cardImageTools = { regenerateCardImages };
