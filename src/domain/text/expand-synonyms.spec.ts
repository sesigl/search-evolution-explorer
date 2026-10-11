import { describe, expect, it } from "vitest";
import { expandSynonyms } from "./expand-synonyms.ts";

describe("synonym expansion", () => {
  it("Given a token in a synonym group, When expansion runs, Then the other group members are added", () => {
    expect(expandSynonyms(["couch"], [["sofa", "couch"]])).toEqual(["couch", "sofa"]);
  });

  it("Given a token outside every group, When expansion runs, Then the token list is unchanged", () => {
    expect(expandSynonyms(["lamp"], [["sofa", "couch"]])).toEqual(["lamp"]);
  });
});
