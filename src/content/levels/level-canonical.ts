export const levelCanonicalContent = {
  mechanism:
    "Annotate the query with one canonical product family plus brand and size, then apply a search policy: FILTER when the query confidence is high and the ad side is assumed clean, BOOST when medium, add nothing from the family when the reading is too weak. UNKNOWN ads are never filtered.",
  tradeOff:
    "The model is hand-written data: a new product family needs a table edit, and a wrong mapping filters good listings. There is no gate on the listing side, so once the query is confident the policy acts.",
  fixesFailureMode:
    "Attribute queries mix a product with its accessory: 'area rug' ranks rug pads with rugs, 'curtains' cannot tell panels from rods, 'queen mattress' puts a mattress pad at the top of the page. Bare 'marble' stays unannotated and 'lamp' only boosts: without evidence the policy abstains instead of filtering.",
};
