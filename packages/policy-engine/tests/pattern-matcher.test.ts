import { describe, it, expect } from "vitest"
import { matchPattern, patternSpecificity } from "../src/pattern-matcher.js"

describe("matchPattern", () => {
  it("matches exact strings", () => {
    expect(matchPattern("delete_secret", "delete_secret")).toBe(true)
    expect(matchPattern("delete_secret", "get_secret")).toBe(false)
  })

  it("matches universal wildcard *", () => {
    expect(matchPattern("*", "delete_secret")).toBe(true)
    expect(matchPattern("*", "anything")).toBe(true)
    expect(matchPattern("*", "")).toBe(true)
  })

  it("matches prefix glob: get_*", () => {
    expect(matchPattern("get_*", "get_secret")).toBe(true)
    expect(matchPattern("get_*", "get_config")).toBe(true)
    expect(matchPattern("get_*", "set_secret")).toBe(false)
  })

  it("matches suffix glob: *_secret", () => {
    expect(matchPattern("*_secret", "get_secret")).toBe(true)
    expect(matchPattern("*_secret", "delete_secret")).toBe(true)
    expect(matchPattern("*_secret", "get_config")).toBe(false)
  })

  it("matches namespace-style globs: prod/*", () => {
    expect(matchPattern("prod/*", "prod/stripe")).toBe(true)
    expect(matchPattern("prod/*", "prod/db")).toBe(true)
    expect(matchPattern("prod/*", "dev/stripe")).toBe(false)
  })

  it("handles regex special characters in pattern safely", () => {
    expect(matchPattern("file.txt", "file.txt")).toBe(true)
    expect(matchPattern("file.txt", "filextxt")).toBe(false) // . should be escaped
  })
})

describe("patternSpecificity", () => {
  it("returns 0 for exact match (no wildcards)", () => {
    expect(patternSpecificity("delete_secret")).toBe(0)
  })

  it("returns 1 for single wildcard", () => {
    expect(patternSpecificity("get_*")).toBe(1)
    expect(patternSpecificity("*")).toBe(1)
  })

  it("returns 2 for double wildcard", () => {
    expect(patternSpecificity("*_*")).toBe(2)
  })
})
