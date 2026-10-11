export const level6Content = {
  mechanism:
    "Two separately trained heads project frozen MiniLM embeddings into 96-dimensional unit vectors. Item inputs emphasize title embeddings because many bundled descriptions are off topic. Training uses graded preferences from training queries only. Validation selects the epoch, neighbour budget and one global score weight. The final score is joint relevance plus weighted learned similarity. Chapter 10's joint scores are reused; new candidates use the same cross-encoder.",
  tradeOff:
    "Training and validation must be separated from test query groups. More candidates add inference cost and possible false positives, so validation controls both budget and score fusion. The item index must be rebuilt with each new item head. This small inventory uses exact vector search. The grades are WANDS human labels and the clicks are simulated, so improved offline relevance is not a measured gain in buyer engagement.",
  fixesFailureMode:
    "Chapter 10 cannot rank a useful listing outside its shortlist. A trained retrieval branch can bring that listing into the cascade.",
};
