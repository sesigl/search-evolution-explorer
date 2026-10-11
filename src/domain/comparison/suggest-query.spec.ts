import { describe, expect, it } from "vitest";
import { suggestDistinguishingQuery } from "./suggest-query.ts";

describe("distinguishing query suggestion", () => {
  it("suggests the chapter 10 guided example when reranking is compared", () => {
    expect(suggestDistinguishingQuery("level-4-hybrid", "level-5-cross-encoder")).toBe(
      "lamp shade",
    );
  });
  it("suggests the chapter 11 guided example when trained retrieval is compared", () => {
    expect(suggestDistinguishingQuery("level-5-cross-encoder", "level-6-two-tower")).toBe(
      "3 1/2 inch drawer pull",
    );
  });
  it("Given a typo chapter pair, When a suggestion is asked, Then ligth bulb is returned", () => {
    expect(suggestDistinguishingQuery("level-1-lexical", "level-1-spelling")).toBe("ligth bulb");
  });
  it("Given an entity chapter pair, When a suggestion is asked, Then the faucet query is returned", () => {
    expect(suggestDistinguishingQuery("level-1-spelling", "level-1-entities")).toBe("moen faucet");
  });
  it("Given lexical and boosting levels, When a suggestion is asked, Then couch is returned", () => {
    expect(suggestDistinguishingQuery("level-1-lexical", "level-2-boosting")).toBe("couch");
  });

  it("Given strict recency and normalization levels, When a suggestion is asked, Then carpet is returned", () => {
    expect(suggestDistinguishingQuery("level-1-recency", "level-1-normalization")).toBe("carpet");
  });
  it("Given normalization and lexical levels, When a suggestion is asked, Then sofa is returned", () => {
    expect(suggestDistinguishingQuery("level-1-normalization", "level-1-lexical")).toBe("sofa");
  });
  it("Given unrelated levels, When a suggestion is asked, Then area rug is returned", () => {
    expect(suggestDistinguishingQuery("level-3-learned", "level-4-hybrid")).toBe("area rug");
  });
});
