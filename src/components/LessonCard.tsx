import type { Lesson } from "../protocols/types";

function capitalized(text: string): string {
  return text.charAt(0).toUpperCase() + text.slice(1);
}

/** One lesson of a protocol: a title, the points to know, and sometimes events in order. */
export function LessonCard({ lesson }: { lesson: Lesson }) {
  const { steps } = lesson;
  return (
    <article className="card lesson">
      <h5 className="lesson-title">
        {steps === undefined ? capitalized(lesson.subject) : `Dans l'ordre : ${lesson.subject}`}
      </h5>
      <ul className="lesson-points">
        {lesson.points.map((point) => (
          <li key={point}>{point}</li>
        ))}
      </ul>
      {steps !== undefined && (
        <ol className="lesson-steps">
          {steps.map((step) => (
            <li key={step}>{step}</li>
          ))}
        </ol>
      )}
    </article>
  );
}
