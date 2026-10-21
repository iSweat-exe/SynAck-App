/// <reference types="node" />
import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { PROTOCOLS } from "./catalog";

/**
 * The quiz must only ask what the course teaches. The lessons follow the question bank of the
 * Rust side: one lesson per subject, and the events of an ordering question in the same order.
 */

interface Bank {
  topics: { subject: string }[];
  sequences: { subject: string; items: string[] }[];
}

const bankOf = (id: string): Bank =>
  JSON.parse(
    readFileSync(new URL(`../../src-tauri/protocols/${id}.json`, import.meta.url), "utf-8"),
  ) as Bank;

describe.each(PROTOCOLS.map((protocol) => [protocol.id, protocol] as const))(
  "the lessons of %s",
  (id, protocol) => {
    const bank = bankOf(id);
    const subjects = protocol.lessons.filter((lesson) => lesson.steps === undefined);
    const chronologies = protocol.lessons.filter((lesson) => lesson.steps !== undefined);

    it("teach every subject the quiz can ask about", () => {
      const taught = subjects.map((lesson) => lesson.subject);
      for (const topic of bank.topics) {
        expect(taught, `pas de leçon pour « ${topic.subject} »`).toContain(topic.subject);
      }
    });

    it("do not teach a subject the quiz never asks about", () => {
      const asked = bank.topics.map((topic) => topic.subject);
      for (const lesson of subjects) {
        expect(asked, `leçon sans question : « ${lesson.subject} »`).toContain(lesson.subject);
      }
    });

    it("give the events of every ordering question in the same order as the quiz", () => {
      for (const sequence of bank.sequences) {
        const lesson = chronologies.find((candidate) => candidate.subject === sequence.subject);
        expect(lesson, `pas de chronologie pour « ${sequence.subject} »`).toBeDefined();
        expect(lesson?.steps).toEqual(sequence.items);
      }
    });

    it("have no chronology the quiz never asks about", () => {
      const asked = bank.sequences.map((sequence) => sequence.subject);
      for (const lesson of chronologies) expect(asked).toContain(lesson.subject);
    });

    it("say enough about each subject to answer the questions on it", () => {
      for (const lesson of subjects) {
        expect(lesson.points.length, lesson.subject).toBeGreaterThanOrEqual(2);
      }
    });

    it("never repeat a subject", () => {
      const keys = protocol.lessons.map(
        (lesson) => `${lesson.subject}|${String(lesson.steps !== undefined)}`,
      );
      expect(new Set(keys).size).toBe(keys.length);
    });
  },
);
