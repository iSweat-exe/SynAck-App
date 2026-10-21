//! The quiz that validates a protocol. Like the exercises, it is judged here and not in the
//! front end: the web view receives a quiz with no answers in it, sends back what the learner
//! chose, and only this module decides whether the protocol is validated.
//!
//! The quiz is never the same twice, so that the only way through is to have understood:
//! the questions come in another order, their wording changes, the options are shuffled, and
//! the same facts are asked in opposite ways ("which one is true" / "which one is false",
//! "put in order" / "put in reverse order").
//!
//! The content lives in `protocols/<id>.json`: for each subject, true statements and false
//! statements, from which every question is drawn.

use std::collections::HashMap;
use std::sync::{Mutex, PoisonError};

use fastrand::Rng;
use serde::{Deserialize, Serialize};
use tauri::State;

use crate::error::AppError;
use crate::progress::ProgressStore;

/// Every question must be right: this is what "validated" means.
const QUESTIONS: usize = 8;

const SOURCES: [(&str, &str); 8] = [
    ("tcp", include_str!("../protocols/tcp.json")),
    ("udp", include_str!("../protocols/udp.json")),
    ("dns", include_str!("../protocols/dns.json")),
    ("http", include_str!("../protocols/http.json")),
    ("tls", include_str!("../protocols/tls.json")),
    ("https", include_str!("../protocols/https.json")),
    ("ssh", include_str!("../protocols/ssh.json")),
    ("ipc", include_str!("../protocols/ipc.json")),
];

#[derive(Debug, Deserialize)]
struct Topic {
    /// What the questions are about, in lower case: "la poignée de main en trois temps".
    subject: String,
    truths: Vec<String>,
    falsehoods: Vec<String>,
    /// Shown when the learner got the question wrong.
    explanation: String,
}

#[derive(Debug, Deserialize)]
struct Sequence {
    subject: String,
    /// In the right order.
    items: Vec<String>,
    explanation: String,
}

#[derive(Debug, Deserialize)]
struct Bank {
    topics: Vec<Topic>,
    sequences: Vec<Sequence>,
}

fn bank(protocol: &str) -> Result<Bank, AppError> {
    let (_, source) = SOURCES
        .iter()
        .find(|(id, _)| *id == protocol)
        .ok_or_else(|| AppError::UnknownProtocol(protocol.to_owned()))?;
    Ok(serde_json::from_str(source)?)
}

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize)]
#[serde(rename_all = "camelCase")]
pub enum Kind {
    /// Pick one option.
    Single,
    /// Pick every option that fits.
    Multiple,
    /// Put the options in order.
    Order,
}

#[derive(Debug, Serialize)]
pub struct QuizOption {
    /// Only its position in this quiz: it says nothing about whether the option is right.
    pub id: String,
    pub text: String,
}

#[derive(Debug, Serialize)]
pub struct QuizQuestion {
    pub kind: Kind,
    pub prompt: String,
    pub options: Vec<QuizOption>,
}

/// What the web view receives. There is no answer in it.
#[derive(Debug, Serialize)]
pub struct Quiz {
    pub questions: Vec<QuizQuestion>,
}

/// What a question expects, kept here until the learner answers.
#[derive(Debug)]
struct Expected {
    kind: Kind,
    prompt: String,
    /// Option ids: the right set for `Single` and `Multiple`, the right sequence for `Order`.
    answer: Vec<String>,
    /// The same, as text, to show the learner what they missed.
    answer_texts: Vec<String>,
    explanation: String,
}

/// One generated quiz, waiting for its answers.
#[derive(Debug)]
pub struct Attempt {
    expected: Vec<Expected>,
}

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct Review {
    pub ok: bool,
    /// Only for a wrong answer: what was asked, what was right, and why.
    #[serde(skip_serializing_if = "Option::is_none")]
    pub prompt: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub correct_answer: Option<Vec<String>>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub explanation: Option<String>,
}

#[derive(Debug, Serialize)]
pub struct QuizResult {
    pub validated: bool,
    pub correct: usize,
    pub total: usize,
    /// One entry per question, in the order of the quiz.
    pub review: Vec<Review>,
}

/// How a choice question is turned around: which statements are asked for.
#[derive(Debug, Clone, Copy)]
enum Mode {
    OneTrue,
    OneFalse,
    TwoTrue,
    TwoFalse,
}

const MODES: [Mode; 4] = [Mode::OneTrue, Mode::OneFalse, Mode::TwoTrue, Mode::TwoFalse];

impl Mode {
    /// `(true statements are asked for, how many are asked for, how many others are shown)`
    fn shape(self) -> (bool, usize, usize) {
        match self {
            Self::OneTrue => (true, 1, 3),
            Self::OneFalse => (false, 1, 3),
            Self::TwoTrue => (true, 2, 2),
            Self::TwoFalse => (false, 2, 2),
        }
    }

    fn stems(self) -> &'static [&'static str] {
        match self {
            Self::OneTrue => &[
                "{S} : quelle affirmation est vraie ?",
                "Parmi ces affirmations sur {s}, laquelle est exacte ?",
                "Une seule de ces phrases sur {s} est correcte. Laquelle ?",
                "Qu'est-ce qui est juste sur {s} ?",
            ],
            Self::OneFalse => &[
                "{S} : quelle affirmation est fausse ?",
                "Trois de ces phrases sur {s} sont exactes. Laquelle est erronée ?",
                "Laquelle de ces affirmations sur {s} est incorrecte ?",
                "Trouve l'intrus : quelle phrase sur {s} est fausse ?",
            ],
            Self::TwoTrue => &[
                "Sur {s}, coche toutes les affirmations vraies.",
                "{S} : sélectionne les deux phrases exactes.",
                "Quelles phrases sur {s} sont correctes ? Plusieurs réponses.",
            ],
            Self::TwoFalse => &[
                "Sur {s}, coche toutes les affirmations fausses.",
                "{S} : sélectionne les deux phrases erronées.",
                "Quelles phrases sur {s} sont incorrectes ? Plusieurs réponses.",
            ],
        }
    }
}

const FORWARD_STEMS: [&str; 3] = [
    "Remets dans l'ordre chronologique : {s}.",
    "Classe ces événements dans l'ordre où ils se produisent : {s}.",
    "{S} : du premier au dernier, quel est l'ordre ?",
];

const REVERSE_STEMS: [&str; 3] = [
    "Classe du dernier au premier : {s}.",
    "À l'envers : remets ces événements du plus tardif au plus précoce : {s}.",
    "{S} : dans l'ordre inverse (le dernier en haut), comment s'enchaînent-ils ?",
];

fn capitalized(text: &str) -> String {
    let mut chars = text.chars();
    chars.next().map_or_else(String::new, |first| {
        first.to_uppercase().chain(chars).collect()
    })
}

/// Picks one wording and puts the subject in it (`{s}` as is, `{S}` with a capital).
fn word(stems: &[&str], subject: &str, rng: &mut Rng) -> String {
    let stem = stems[rng.usize(..stems.len())];
    stem.replace("{S}", &capitalized(subject))
        .replace("{s}", subject)
}

/// `count` distinct statements, taken at random.
fn draw(pool: &[String], count: usize, rng: &mut Rng) -> Vec<String> {
    let mut shuffled = pool.to_vec();
    rng.shuffle(&mut shuffled);
    shuffled.truncate(count);
    shuffled
}

/// Options with ids that are only their position, so the id never gives the answer away.
fn options(texts: Vec<String>) -> Vec<QuizOption> {
    texts
        .into_iter()
        .enumerate()
        .map(|(index, text)| QuizOption {
            id: index.to_string(),
            text,
        })
        .collect()
}

struct Built {
    question: QuizQuestion,
    expected: Expected,
}

fn choice(topic: &Topic, rng: &mut Rng) -> Built {
    let mode = MODES[rng.usize(..MODES.len())];
    let (asked_true, asked, others) = mode.shape();
    let (asked_pool, other_pool) = if asked_true {
        (&topic.truths, &topic.falsehoods)
    } else {
        (&topic.falsehoods, &topic.truths)
    };

    let mut statements: Vec<(String, bool)> = draw(asked_pool, asked, rng)
        .into_iter()
        .map(|text| (text, true))
        .chain(
            draw(other_pool, others, rng)
                .into_iter()
                .map(|text| (text, false)),
        )
        .collect();
    rng.shuffle(&mut statements);

    let answer: Vec<String> = statements
        .iter()
        .enumerate()
        .filter(|(_, (_, wanted))| *wanted)
        .map(|(index, _)| index.to_string())
        .collect();
    let answer_texts = statements
        .iter()
        .filter(|(_, wanted)| *wanted)
        .map(|(text, _)| text.clone())
        .collect();
    let prompt = word(mode.stems(), &topic.subject, rng);
    let kind = if asked == 1 {
        Kind::Single
    } else {
        Kind::Multiple
    };

    Built {
        question: QuizQuestion {
            kind,
            prompt: prompt.clone(),
            options: options(statements.into_iter().map(|(text, _)| text).collect()),
        },
        expected: Expected {
            kind,
            prompt,
            answer,
            answer_texts,
            explanation: topic.explanation.clone(),
        },
    }
}

fn ordering(sequence: &Sequence, rng: &mut Rng) -> Built {
    let reverse = rng.bool();
    let mut correct = sequence.items.clone();
    if reverse {
        correct.reverse();
    }

    // The options start in an order that is not the right one.
    let mut shown = correct.clone();
    for _ in 0..32 {
        rng.shuffle(&mut shown);
        if shown != correct {
            break;
        }
    }

    let answer = correct
        .iter()
        .filter_map(|item| shown.iter().position(|candidate| candidate == item))
        .map(|index| index.to_string())
        .collect();
    let stems: &[&str] = if reverse {
        &REVERSE_STEMS
    } else {
        &FORWARD_STEMS
    };
    let prompt = word(stems, &sequence.subject, rng);

    Built {
        question: QuizQuestion {
            kind: Kind::Order,
            prompt: prompt.clone(),
            options: options(shown),
        },
        expected: Expected {
            kind: Kind::Order,
            prompt,
            answer,
            answer_texts: correct,
            explanation: sequence.explanation.clone(),
        },
    }
}

/// Builds a quiz for `protocol`: one question on a sequence when there is one, the others on
/// distinct subjects, all in a random order.
fn generate(protocol: &str, rng: &mut Rng) -> Result<(Quiz, Attempt), AppError> {
    let bank = bank(protocol)?;

    let mut built = Vec::with_capacity(QUESTIONS);
    if !bank.sequences.is_empty() {
        built.push(ordering(
            &bank.sequences[rng.usize(..bank.sequences.len())],
            rng,
        ));
    }

    let mut topics: Vec<&Topic> = bank.topics.iter().collect();
    rng.shuffle(&mut topics);
    for topic in topics.into_iter().take(QUESTIONS - built.len()) {
        built.push(choice(topic, rng));
    }
    rng.shuffle(&mut built);

    let (questions, expected) = built
        .into_iter()
        .map(|item| (item.question, item.expected))
        .unzip();
    Ok((Quiz { questions }, Attempt { expected }))
}

fn same_set(left: &[String], right: &[String]) -> bool {
    let mut left = left.to_vec();
    let mut right = right.to_vec();
    left.sort();
    right.sort();
    left == right
}

/// Grades the answers. Every question must be right for the protocol to be validated.
///
/// # Errors
///
/// Returns an error if there is not one answer per question.
fn grade(attempt: &Attempt, answers: &[Vec<String>]) -> Result<QuizResult, AppError> {
    if answers.len() != attempt.expected.len() {
        return Err(AppError::QuizMalformed);
    }

    let review: Vec<Review> = attempt
        .expected
        .iter()
        .zip(answers)
        .map(|(expected, given)| {
            let ok = match expected.kind {
                Kind::Single | Kind::Order => *given == expected.answer,
                Kind::Multiple => same_set(given, &expected.answer),
            };
            if ok {
                Review {
                    ok,
                    prompt: None,
                    correct_answer: None,
                    explanation: None,
                }
            } else {
                Review {
                    ok,
                    prompt: Some(expected.prompt.clone()),
                    correct_answer: Some(expected.answer_texts.clone()),
                    explanation: Some(expected.explanation.clone()),
                }
            }
        })
        .collect();

    let correct = review.iter().filter(|item| item.ok).count();
    let total = review.len();
    Ok(QuizResult {
        validated: correct == total,
        correct,
        total,
        review,
    })
}

/// The quizzes handed out and not yet answered, one per protocol.
#[derive(Default)]
pub struct QuizSessions(Mutex<HashMap<String, Attempt>>);

impl QuizSessions {
    fn put(&self, protocol: &str, attempt: Attempt) {
        self.0
            .lock()
            .unwrap_or_else(PoisonError::into_inner)
            .insert(protocol.to_owned(), attempt);
    }

    /// An attempt can be answered once: a new quiz is needed to try again.
    fn take(&self, protocol: &str) -> Option<Attempt> {
        self.0
            .lock()
            .unwrap_or_else(PoisonError::into_inner)
            .remove(protocol)
    }
}

/// Hands out a new quiz for a protocol. Each call gives a different one.
#[tauri::command]
pub async fn start_protocol_quiz(
    sessions: State<'_, QuizSessions>,
    protocol: String,
) -> Result<Quiz, AppError> {
    let (quiz, attempt) = generate(&protocol, &mut Rng::new())?;
    sessions.put(&protocol, attempt);
    Ok(quiz)
}

/// Grades a quiz and, when every answer is right, records the protocol as validated.
#[tauri::command]
pub async fn submit_protocol_quiz(
    sessions: State<'_, QuizSessions>,
    store: State<'_, ProgressStore>,
    protocol: String,
    answers: Vec<Vec<String>>,
) -> Result<QuizResult, AppError> {
    let attempt = sessions.take(&protocol).ok_or(AppError::QuizExpired)?;
    let result = grade(&attempt, &answers)?;
    if result.validated {
        store.mark_protocol_validated(&protocol)?;
    }
    Ok(result)
}

#[cfg(test)]
mod tests {
    use std::collections::HashSet;

    use super::*;

    fn ids() -> Vec<&'static str> {
        SOURCES.iter().map(|(id, _)| *id).collect()
    }

    fn rng(seed: u64) -> Rng {
        Rng::with_seed(seed)
    }

    /// The right answer to every question, as the learner would give it.
    fn perfect(attempt: &Attempt) -> Vec<Vec<String>> {
        attempt.expected.iter().map(|e| e.answer.clone()).collect()
    }

    #[test]
    fn bank_should_load_when_the_protocol_exists() {
        for id in ids() {
            assert!(bank(id).is_ok(), "{id} does not load");
        }
    }

    #[test]
    fn bank_should_fail_when_the_protocol_is_unknown() {
        assert!(matches!(bank("nope"), Err(AppError::UnknownProtocol(_))));
    }

    #[test]
    fn bank_should_have_enough_subjects_for_a_whole_quiz_when_a_sequence_is_asked() {
        for id in ids() {
            let bank = bank(id).unwrap();
            assert!(bank.topics.len() >= QUESTIONS, "{id}: not enough subjects");
        }
    }

    #[test]
    fn bank_should_have_enough_statements_when_any_mode_can_be_drawn() {
        for id in ids() {
            for topic in bank(id).unwrap().topics {
                assert!(topic.truths.len() >= 3, "{id}/{}: truths", topic.subject);
                assert!(
                    topic.falsehoods.len() >= 3,
                    "{id}/{}: falsehoods",
                    topic.subject
                );
                assert_ne!(topic.explanation.trim(), "");
            }
        }
    }

    #[test]
    fn bank_should_not_repeat_a_statement_within_a_protocol() {
        for id in ids() {
            let bank = bank(id).unwrap();
            let mut seen = HashSet::new();
            for text in bank
                .topics
                .iter()
                .flat_map(|t| t.truths.iter().chain(&t.falsehoods))
            {
                assert!(seen.insert(text.clone()), "{id}: repeated « {text} »");
            }
        }
    }

    #[test]
    fn bank_should_keep_statements_short_enough_to_read_when_shown_as_options() {
        for id in ids() {
            for topic in bank(id).unwrap().topics {
                for text in topic.truths.iter().chain(&topic.falsehoods) {
                    assert!(text.chars().count() <= 150, "{id}: too long « {text} »");
                    assert_ne!(text.trim(), "");
                }
            }
        }
    }

    #[test]
    fn bank_should_have_ordered_sequences_of_distinct_items_when_it_has_sequences() {
        for id in ids() {
            for sequence in bank(id).unwrap().sequences {
                let distinct: HashSet<_> = sequence.items.iter().collect();
                assert!(sequence.items.len() >= 3, "{id}: sequence too short");
                assert_eq!(distinct.len(), sequence.items.len(), "{id}: repeated item");
            }
        }
    }

    #[test]
    fn generate_should_ask_the_expected_number_of_questions_when_a_protocol_has_enough_content() {
        for id in ids() {
            let (quiz, attempt) = generate(id, &mut rng(1)).unwrap();
            assert_eq!(quiz.questions.len(), QUESTIONS, "{id}");
            assert_eq!(attempt.expected.len(), QUESTIONS, "{id}");
        }
    }

    #[test]
    fn generate_should_not_send_any_answer_to_the_web_view() {
        for id in ids() {
            let (quiz, attempt) = generate(id, &mut rng(2)).unwrap();
            let json = serde_json::to_string(&quiz).unwrap();
            assert!(!json.contains("answer"), "{id}");
            assert!(!json.contains("explanation"), "{id}");
            // Nor the explanation text, which would hint at the right option.
            for expected in &attempt.expected {
                assert!(!json.contains(&expected.explanation), "{id}");
            }
        }
    }

    #[test]
    fn generate_should_give_options_ids_that_are_only_positions() {
        let (quiz, _) = generate("tcp", &mut rng(3)).unwrap();
        for question in quiz.questions {
            let ids: Vec<_> = question.options.iter().map(|o| o.id.clone()).collect();
            let positions: Vec<_> = (0..ids.len()).map(|i| i.to_string()).collect();
            assert_eq!(ids, positions);
        }
    }

    #[test]
    fn generate_should_give_a_different_quiz_when_the_seed_changes() {
        let prompts = |seed| {
            let (quiz, _) = generate("tcp", &mut rng(seed)).unwrap();
            quiz.questions
                .into_iter()
                .map(|q| q.prompt)
                .collect::<Vec<_>>()
        };
        let all: HashSet<_> = (0..20).map(prompts).collect();
        assert!(all.len() > 15, "quizzes repeat too much: {}", all.len());
    }

    #[test]
    fn generate_should_not_always_put_the_right_option_in_the_same_place() {
        let mut positions = HashSet::new();
        for seed in 0..40 {
            let (_, attempt) = generate("http", &mut rng(seed)).unwrap();
            for expected in &attempt.expected {
                if expected.kind == Kind::Single {
                    positions.insert(expected.answer[0].clone());
                }
            }
        }
        assert_eq!(
            positions.len(),
            4,
            "the right option only takes {positions:?}"
        );
    }

    #[test]
    fn generate_should_ask_for_the_false_statement_as_often_as_for_the_true_one() {
        let (mut truthful, mut negated) = (0, 0);
        for seed in 0..60 {
            let (quiz, _) = generate("dns", &mut rng(seed)).unwrap();
            for question in quiz.questions.iter().filter(|q| q.kind != Kind::Order) {
                let p = &question.prompt;
                if p.contains("fausse")
                    || p.contains("erron")
                    || p.contains("incorrecte")
                    || p.contains("intrus")
                {
                    negated += 1;
                } else {
                    truthful += 1;
                }
            }
        }
        assert!(negated > truthful / 3, "{negated} negated vs {truthful}");
        assert!(truthful > negated / 3, "{truthful} true vs {negated}");
    }

    #[test]
    fn generate_should_start_a_sequence_in_an_order_that_is_not_the_right_one() {
        for seed in 0..40 {
            let (quiz, attempt) = generate("tcp", &mut rng(seed)).unwrap();
            for (question, expected) in quiz.questions.iter().zip(&attempt.expected) {
                if expected.kind == Kind::Order {
                    let shown: Vec<_> = question.options.iter().map(|o| o.id.clone()).collect();
                    assert_ne!(shown, expected.answer);
                }
            }
        }
    }

    #[test]
    fn generate_should_sometimes_ask_a_sequence_in_reverse() {
        let mut reversed = 0;
        for seed in 0..40 {
            let (quiz, attempt) = generate("tcp", &mut rng(seed)).unwrap();
            for (question, expected) in quiz.questions.iter().zip(&attempt.expected) {
                if expected.kind == Kind::Order && question.prompt.contains("dernier") {
                    reversed += 1;
                }
            }
        }
        assert!(
            reversed > 5 && reversed < 35,
            "{reversed} reversed out of 40"
        );
    }

    #[test]
    fn generate_should_fail_when_the_protocol_is_unknown() {
        assert!(generate("nope", &mut rng(1)).is_err());
    }

    #[test]
    fn grade_should_validate_the_protocol_when_every_answer_is_right() {
        for id in ids() {
            let (_, attempt) = generate(id, &mut rng(4)).unwrap();
            let result = grade(&attempt, &perfect(&attempt)).unwrap();
            assert!(result.validated, "{id}");
            assert_eq!(result.correct, QUESTIONS);
        }
    }

    #[test]
    fn grade_should_not_validate_the_protocol_when_one_answer_is_wrong() {
        let (_, attempt) = generate("ssh", &mut rng(5)).unwrap();
        let mut answers = perfect(&attempt);
        answers[0] = vec!["9".to_owned()];
        let result = grade(&attempt, &answers).unwrap();
        assert!(!result.validated);
        assert_eq!(result.correct, QUESTIONS - 1);
    }

    #[test]
    fn grade_should_not_validate_the_protocol_when_nothing_is_answered() {
        let (_, attempt) = generate("tls", &mut rng(6)).unwrap();
        let answers = vec![Vec::new(); QUESTIONS];
        assert!(!grade(&attempt, &answers).unwrap().validated);
    }

    #[test]
    fn grade_should_accept_the_options_of_a_multiple_choice_in_any_order() {
        let (_, attempt) = (0..200)
            .map(|seed| generate("https", &mut rng(seed)).unwrap())
            .find(|(_, a)| a.expected.iter().any(|e| e.kind == Kind::Multiple))
            .unwrap();
        let mut answers = perfect(&attempt);
        for (given, expected) in answers.iter_mut().zip(&attempt.expected) {
            if expected.kind == Kind::Multiple {
                given.reverse();
            }
        }
        assert!(grade(&attempt, &answers).unwrap().validated);
    }

    #[test]
    fn grade_should_refuse_a_multiple_choice_when_only_part_of_the_answer_is_given() {
        let (_, attempt) = (0..200)
            .map(|seed| generate("https", &mut rng(seed)).unwrap())
            .find(|(_, a)| a.expected.iter().any(|e| e.kind == Kind::Multiple))
            .unwrap();
        let mut answers = perfect(&attempt);
        for (given, expected) in answers.iter_mut().zip(&attempt.expected) {
            if expected.kind == Kind::Multiple {
                given.pop();
            }
        }
        assert!(!grade(&attempt, &answers).unwrap().validated);
    }

    #[test]
    fn grade_should_refuse_a_multiple_choice_when_every_option_is_ticked() {
        let (quiz, attempt) = (0..200)
            .map(|seed| generate("https", &mut rng(seed)).unwrap())
            .find(|(_, a)| a.expected.iter().any(|e| e.kind == Kind::Multiple))
            .unwrap();
        let mut answers = perfect(&attempt);
        for ((given, expected), question) in answers
            .iter_mut()
            .zip(&attempt.expected)
            .zip(&quiz.questions)
        {
            if expected.kind == Kind::Multiple {
                *given = question.options.iter().map(|o| o.id.clone()).collect();
            }
        }
        assert!(!grade(&attempt, &answers).unwrap().validated);
    }

    #[test]
    fn grade_should_refuse_a_sequence_when_two_items_are_swapped() {
        let (_, attempt) = (0..200)
            .map(|seed| generate("tcp", &mut rng(seed)).unwrap())
            .find(|(_, a)| a.expected.iter().any(|e| e.kind == Kind::Order))
            .unwrap();
        let mut answers = perfect(&attempt);
        for (given, expected) in answers.iter_mut().zip(&attempt.expected) {
            if expected.kind == Kind::Order {
                given.swap(0, 1);
            }
        }
        assert!(!grade(&attempt, &answers).unwrap().validated);
    }

    #[test]
    fn grade_should_fail_when_the_number_of_answers_is_wrong() {
        let (_, attempt) = generate("ipc", &mut rng(7)).unwrap();
        assert!(matches!(grade(&attempt, &[]), Err(AppError::QuizMalformed)));
    }

    #[test]
    fn grade_should_only_reveal_the_answer_of_the_questions_that_were_wrong() {
        let (_, attempt) = generate("udp", &mut rng(8)).unwrap();
        let mut answers = perfect(&attempt);
        answers[2] = Vec::new();
        let result = grade(&attempt, &answers).unwrap();
        for (index, item) in result.review.iter().enumerate() {
            assert_eq!(item.ok, index != 2);
            assert_eq!(item.correct_answer.is_some(), index == 2);
            assert_eq!(item.explanation.is_some(), index == 2);
        }
    }

    #[test]
    fn sessions_should_let_an_attempt_be_answered_only_once() {
        let sessions = QuizSessions::default();
        let (_, attempt) = generate("dns", &mut rng(9)).unwrap();
        sessions.put("dns", attempt);
        assert!(sessions.take("dns").is_some());
        assert!(sessions.take("dns").is_none());
    }

    #[test]
    fn sessions_should_replace_the_attempt_when_a_new_quiz_is_started() {
        let sessions = QuizSessions::default();
        let (_, first) = generate("dns", &mut rng(10)).unwrap();
        let (_, second) = generate("dns", &mut rng(11)).unwrap();
        let wanted = second.expected[0].prompt.clone();
        sessions.put("dns", first);
        sessions.put("dns", second);
        assert_eq!(sessions.take("dns").unwrap().expected[0].prompt, wanted);
    }

    #[test]
    fn capitalized_should_raise_the_first_letter_when_it_is_accented() {
        assert_eq!(capitalized("été"), "Été");
        assert_eq!(capitalized(""), "");
    }
}
