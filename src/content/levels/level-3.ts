export const level3Content = {
  mechanism:
    "Clicks come from chapter 7's full match list, paginated the same way the search page is. Training fits a linear model so a clicked listing scores above a skipped one. Inverse-propensity weighting down-weights clicks that were almost sure because they sat at rank 1. At serving time each listing is scored alone.",
  tradeOff:
    "A model trained on raw clicks still copies position. Inverse-propensity weighting is extra machinery and is only as good as the propensity estimate. The model cannot beat a signal that never appeared in the log.",
  fixesFailureMode:
    "Hand-tuned boosts fight each other. Learning the weights from engagement data replaces the manual tug of war.",
};
