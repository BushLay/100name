import assert from "node:assert/strict"
import test from "node:test"

import {
  validateFemaleActor,
  validateFemaleFictionalCharacter,
  validateFemaleHuman,
  type WikidataEntity,
} from "./wikidata.ts"

test("validateFemaleHuman accepts female humans with wikipedia sitelinks", () => {
  const entity: WikidataEntity = {
    id: "Q7259",
    labels: {
      en: { value: "Ada Lovelace" },
    },
    claims: {
      P31: [{ mainsnak: { datavalue: { value: { id: "Q5" } } } }],
      P21: [{ mainsnak: { datavalue: { value: { id: "Q6581072" } } } }],
    },
    sitelinks: {
      enwiki: { title: "Ada Lovelace" },
    },
  }

  assert.deepEqual(validateFemaleHuman(entity), {
    valid: true,
    qid: "Q7259",
    name: "Ada Lovelace",
  })
})

test("validateFemaleHuman rejects non-wikipedia sitelinks", () => {
  const entity: WikidataEntity = {
    id: "Q1",
    labels: {
      en: { value: "Example" },
    },
    claims: {
      P31: [{ mainsnak: { datavalue: { value: { id: "Q5" } } } }],
      P21: [{ mainsnak: { datavalue: { value: { id: "Q6581072" } } } }],
    },
    sitelinks: {
      commonswiki: { title: "Example" },
    },
  }

  assert.equal(validateFemaleHuman(entity).valid, false)
})

test("validateFemaleActor accepts female humans with actor occupation", () => {
  const entity: WikidataEntity = {
    id: "Q42",
    labels: {
      en: { value: "Example Actor" },
    },
    claims: {
      P31: [{ mainsnak: { datavalue: { value: { id: "Q5" } } } }],
      P21: [{ mainsnak: { datavalue: { value: { id: "Q6581072" } } } }],
      P106: [{ mainsnak: { datavalue: { value: { id: "Q33999" } } } }],
    },
    sitelinks: {
      enwiki: { title: "Example Actor" },
    },
  }

  assert.equal(validateFemaleActor(entity).valid, true)
})

test("validateFemaleFictionalCharacter accepts fictional female characters", () => {
  const entity: WikidataEntity = {
    id: "Q99",
    labels: {
      en: { value: "Example Character" },
    },
    claims: {
      P31: [{ mainsnak: { datavalue: { value: { id: "Q95074" } } } }],
      P21: [{ mainsnak: { datavalue: { value: { id: "Q6581072" } } } }],
    },
    sitelinks: {
      enwiki: { title: "Example Character" },
    },
  }

  assert.equal(validateFemaleFictionalCharacter(entity).valid, true)
})
