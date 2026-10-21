import { useState } from "react";
import {
  startProtocolQuiz,
  submitProtocolQuiz,
  type Quiz,
  type QuizResult,
} from "../api/protocols";
import { initialAnswers, move, select, type Answers } from "./answers";

export type QuizState =
  | { status: "idle" }
  | { status: "loading" }
  | { status: "answering"; quiz: Quiz; answers: Answers }
  | { status: "submitting"; quiz: Quiz; answers: Answers }
  | { status: "done"; result: QuizResult }
  | { status: "failed"; message: string };

function toMessage(error: unknown): string {
  return error instanceof Error ? error.message : "Erreur inconnue.";
}

/**
 * The quiz of one protocol: it asks the Rust side for a new quiz, keeps what the learner chooses,
 * and sends it back. The verdict, and the recording of the validation, are the Rust side's.
 *
 * @param onValidated called once the protocol has just been validated
 */
export function useQuiz(protocol: string, onValidated: () => void) {
  const [state, setState] = useState<QuizState>({ status: "idle" });

  async function start() {
    setState({ status: "loading" });
    try {
      const quiz = await startProtocolQuiz(protocol);
      setState({ status: "answering", quiz, answers: initialAnswers(quiz) });
    } catch (error) {
      setState({ status: "failed", message: toMessage(error) });
    }
  }

  function choose(index: number, multiple: boolean, id: string) {
    setState((previous) =>
      previous.status === "answering"
        ? { ...previous, answers: select(previous.answers, index, multiple, id) }
        : previous,
    );
  }

  function reorder(index: number, position: number, delta: -1 | 1) {
    setState((previous) =>
      previous.status === "answering"
        ? { ...previous, answers: move(previous.answers, index, position, delta) }
        : previous,
    );
  }

  async function submit() {
    if (state.status !== "answering") return;
    const { quiz, answers } = state;
    setState({ status: "submitting", quiz, answers });
    try {
      const result = await submitProtocolQuiz(protocol, answers);
      setState({ status: "done", result });
      if (result.validated) onValidated();
    } catch (error) {
      setState({ status: "failed", message: toMessage(error) });
    }
  }

  return { state, start, choose, reorder, submit };
}
