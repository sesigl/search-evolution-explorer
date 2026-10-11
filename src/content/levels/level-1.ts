export const level1Content = {
  mechanism:
    "Keep the chapter 2 candidates unchanged, then order them by text fit: score each candidate with BM25 over the normalised words.",
  tradeOff:
    "Text fit beats age, but words are still the unit: a different word for the same thing only matches through the chapter 2 synonym table, and a long listing needs length normalisation to stay fair.",
  fixesFailureMode: "Newest-first ordering buries the best match under fresh listings.",
};
