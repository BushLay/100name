import assert from "node:assert/strict"
import test from "node:test"

import {
  checkDuplicate,
  checkWinCondition,
  updateScore,
  validateGuess,
  validateGuessWithRules,
  type ValidationDependencies,
  type WikidataEntity,
} from "./game.ts"

function createDependencies(entity: WikidataEntity | null): ValidationDependencies {
  return {
    async searchEntity(name) {
      if (name === "Missing Person") {
        return { valid: false, qid: "", name }
      }

      return { valid: true, qid: "Q123", name }
    },
    async getEntityData() {
      return entity
    },
    validateFemaleHuman(currentEntity) {
      if (!currentEntity) {
        return { valid: false, qid: "", name: "" }
      }

      const isHuman =
        currentEntity.claims?.P31?.[0]?.mainsnak?.datavalue?.value?.id === "Q5"
      const isFemale =
        currentEntity.claims?.P21?.[0]?.mainsnak?.datavalue?.value?.id ===
        "Q6581072"
      const hasWikipedia = Boolean(currentEntity.sitelinks?.enwiki)

      return {
        valid: isHuman && isFemale && hasWikipedia,
        qid: currentEntity.id,
        name: currentEntity.labels?.en?.value ?? currentEntity.id,
      }
    },
  }
}

test("checkDuplicate returns true when qid already exists", () => {
  assert.equal(checkDuplicate("Q1", ["Q1", "Q2"]), true)
  assert.equal(checkDuplicate("Q3", ["Q1", "Q2"]), false)
})

test("updateScore increments by one", () => {
  assert.equal(updateScore(9), 10)
})

test("checkWinCondition unlocks at one hundred points", () => {
  assert.equal(checkWinCondition(99), false)
  assert.equal(checkWinCondition(100), true)
})

test("validateGuess rejects empty input", async () => {
  const result = await validateGuess("   ", [], 0, createDependencies(null))

  assert.equal(result.valid, false)
  assert.match(result.message, /enter a full name/i)
})

test("validateGuess rejects duplicate qids", async () => {
  const entity: WikidataEntity = {
    id: "Q123",
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

  const result = await validateGuess(
    "Ada Lovelace",
    ["Q123"],
    3,
    createDependencies(entity)
  )

  assert.equal(result.valid, false)
  assert.match(result.message, /already been guessed/i)
})

test("validateGuess accepts a female human with wikipedia and increments score", async () => {
  const entity: WikidataEntity = {
    id: "Q123",
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

  const result = await validateGuess(
    "Ada Lovelace",
    [],
    99,
    createDependencies(entity)
  )

  assert.equal(result.valid, true)
  assert.equal(result.score, 100)
  assert.equal(result.won, true)
})

test("validateGuess rejects entities that do not meet game rules", async () => {
  const entity: WikidataEntity = {
    id: "Q123",
    labels: {
      en: { value: "Example Person" },
    },
    claims: {
      P31: [{ mainsnak: { datavalue: { value: { id: "Q5" } } } }],
      P21: [{ mainsnak: { datavalue: { value: { id: "Q6581097" } } } }],
    },
    sitelinks: {},
  }

  const result = await validateGuess(
    "Example Person",
    [],
    7,
    createDependencies(entity)
  )

  assert.equal(result.valid, false)
  assert.equal(result.score, 7)
  assert.match(result.message, /female human with a wikipedia page/i)
})

test("validateGuessWithRules supports themed target counts and validators", async () => {
  const entity: WikidataEntity = {
    id: "Q777",
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

  const result = await validateGuessWithRules(
    "Example Actor",
    [],
    19,
    createDependencies(entity),
    {
      targetScore: 20,
      validateEntity(currentEntity) {
        const occupationId =
          currentEntity?.claims?.P106?.[0]?.mainsnak?.datavalue?.value?.id

        return {
          valid: occupationId === "Q33999",
          qid: currentEntity?.id ?? "",
          name: currentEntity?.labels?.en?.value ?? "",
        }
      },
      invalidEntityMessage: "Actor required.",
      successMessage: "Correct actor added.",
    }
  )

  assert.equal(result.valid, true)
  assert.equal(result.score, 20)
  assert.equal(result.won, true)
  assert.match(result.message, /correct actor added/i)
})
