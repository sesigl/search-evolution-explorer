export const levelSpellingContent = {
  mechanism:
    "Correct each unknown query word against the listing vocabulary: unique edit-distance neighbour first, compound split second. Retrieve and score on the corrected words, and show the correction next to the results.",
  tradeOff:
    "A rare but correct word can be rewritten into a common wrong one. The distance limit and the unique-best rule keep that rare; a word with two equally close neighbours is left alone.",
  fixesFailureMode:
    "A typo finds nothing: chapters 1 to 3 look the words up as typed, so 'ligth bulb' misses every light bulb.",
};
