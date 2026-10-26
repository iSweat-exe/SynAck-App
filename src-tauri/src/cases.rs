//! The hidden tests of every exercise.
//!
//! Each exercise has two functions: `inputs` draws test inputs (some fixed edge cases, the rest
//! random, so they differ at every check), and `solve` is the reference solution that computes
//! the expected output for any input. Because the inputs are unknown in advance, a program that
//! hard-codes answers cannot pass: it has to implement the actual logic.

use std::collections::{BTreeMap, BTreeSet};
use std::fmt::Write;

use fastrand::Rng;

/// One test: what is sent to the program and what it must print.
pub struct Case {
    pub input: String,
    pub expected: String,
}

struct Spec {
    id: &'static str,
    inputs: fn(&mut Rng) -> Vec<String>,
    solve: fn(&str) -> String,
}

const SPECS: [Spec; 20] = [
    Spec {
        id: "fibonacci",
        inputs: fibonacci_inputs,
        solve: fibonacci_solve,
    },
    Spec {
        id: "dict_sum",
        inputs: dict_sum_inputs,
        solve: dict_sum_solve,
    },
    Spec {
        id: "list_extend",
        inputs: list_extend_inputs,
        solve: list_extend_solve,
    },
    Spec {
        id: "fizzbuzz",
        inputs: fizzbuzz_inputs,
        solve: fizzbuzz_solve,
    },
    Spec {
        id: "tips",
        inputs: tips_inputs,
        solve: tips_solve,
    },
    Spec {
        id: "max_in_list",
        inputs: max_in_list_inputs,
        solve: max_in_list_solve,
    },
    Spec {
        id: "count_vowels",
        inputs: count_vowels_inputs,
        solve: count_vowels_solve,
    },
    Spec {
        id: "palindrome",
        inputs: palindrome_inputs,
        solve: palindrome_solve,
    },
    Spec {
        id: "factorial",
        inputs: factorial_inputs,
        solve: factorial_solve,
    },
    Spec {
        id: "reverse_words",
        inputs: reverse_words_inputs,
        solve: reverse_words_solve,
    },
    Spec {
        id: "primes",
        inputs: primes_inputs,
        solve: primes_solve,
    },
    Spec {
        id: "word_count",
        inputs: word_count_inputs,
        solve: word_count_solve,
    },
    Spec {
        id: "dedupe",
        inputs: dedupe_inputs,
        solve: dedupe_solve,
    },
    Spec {
        id: "change_coins",
        inputs: change_coins_inputs,
        solve: change_coins_solve,
    },
    Spec {
        id: "caesar",
        inputs: caesar_inputs,
        solve: caesar_solve,
    },
    Spec {
        id: "lis",
        inputs: lis_inputs,
        solve: lis_solve,
    },
    Spec {
        id: "edit_distance",
        inputs: edit_distance_inputs,
        solve: edit_distance_solve,
    },
    Spec {
        id: "knapsack",
        inputs: knapsack_inputs,
        solve: knapsack_solve,
    },
    Spec {
        id: "shortest_path",
        inputs: shortest_path_inputs,
        solve: shortest_path_solve,
    },
    Spec {
        id: "topological_order",
        inputs: topological_order_inputs,
        solve: topological_order_solve,
    },
];

/// Draws the hidden test cases of an exercise, or `None` if the exercise has no spec.
pub fn generate(id: &str, rng: &mut Rng) -> Option<Vec<Case>> {
    let spec = SPECS.iter().find(|spec| spec.id == id)?;
    Some(
        (spec.inputs)(rng)
            .into_iter()
            .map(|input| Case {
                expected: (spec.solve)(&input),
                input,
            })
            .collect(),
    )
}

/// The reference output for `input`, or `None` if the exercise has no spec.
#[cfg(test)]
pub fn solve(id: &str, input: &str) -> Option<String> {
    SPECS
        .iter()
        .find(|spec| spec.id == id)
        .map(|spec| (spec.solve)(input))
}

/// Ids that have a spec, for the consistency test with the catalog.
#[cfg(test)]
pub fn ids() -> Vec<&'static str> {
    SPECS.iter().map(|spec| spec.id).collect()
}

fn first_line_number(input: &str) -> usize {
    input
        .lines()
        .next()
        .and_then(|line| line.trim().parse().ok())
        .unwrap_or_default()
}

fn numbers_line(rng: &mut Rng, count: usize, max: u32) -> String {
    (0..count)
        .map(|_| rng.u32(0..=max).to_string())
        .collect::<Vec<_>>()
        .join(" ")
}

// --- Fibonacci: the n first terms ------------------------------------------------------------

fn fibonacci_inputs(rng: &mut Rng) -> Vec<String> {
    let mut sizes = vec![1, 2, 3, 10, 40];
    sizes.extend((0..5).map(|_| rng.usize(1..=40)));
    sizes.into_iter().map(|n| format!("{n}\n")).collect()
}

fn fibonacci_solve(input: &str) -> String {
    let (mut a, mut b) = (0_u64, 1_u64);
    let mut terms = Vec::new();
    for _ in 0..first_line_number(input) {
        terms.push(a.to_string());
        (a, b) = (b, a + b);
    }
    terms.join(" ")
}

// --- Dictionary: sum of the values, the last value of a repeated key wins ----------------------

const WORDS: [&str; 6] = ["pomme", "poire", "kiwi", "fraise", "mangue", "cerise"];

fn dict_sum_inputs(rng: &mut Rng) -> Vec<String> {
    let mut inputs = vec![
        "1\nsolo 7\n".to_owned(),
        "2\na 1\na 5\n".to_owned(),
        "3\nx -4\ny 10\nz -1\n".to_owned(),
        "4\nk 3\nk 3\nk -8\nk 2\n".to_owned(),
    ];
    for _ in 0..6 {
        let lines = rng.usize(1..=12);
        let mut input = format!("{lines}\n");
        for _ in 0..lines {
            let word = WORDS[rng.usize(0..WORDS.len())];
            let _ = writeln!(input, "{word} {}", rng.i32(-50..=100));
        }
        inputs.push(input);
    }
    inputs
}

fn dict_sum_solve(input: &str) -> String {
    let mut dictionary: BTreeMap<&str, i64> = BTreeMap::new();
    for line in input.lines().skip(1) {
        let mut parts = line.split_whitespace();
        if let (Some(key), Some(value)) = (parts.next(), parts.next()) {
            dictionary.insert(key, value.parse().unwrap_or_default());
        }
    }
    dictionary.values().sum::<i64>().to_string()
}

// --- List: append several elements at the end -------------------------------------------------

fn list_extend_inputs(rng: &mut Rng) -> Vec<String> {
    let mut inputs = vec![
        "\n1 2 3\n".to_owned(),
        "4 5\n\n".to_owned(),
        "\n\n".to_owned(),
        "7\n7 7\n".to_owned(),
    ];
    for _ in 0..6 {
        let start = rng.usize(0..=8);
        let added = rng.usize(0..=6);
        inputs.push(format!(
            "{}\n{}\n",
            numbers_line(rng, start, 99),
            numbers_line(rng, added, 99)
        ));
    }
    inputs
}

fn list_extend_solve(input: &str) -> String {
    let mut lines = input.lines();
    let mut list: Vec<&str> = lines
        .next()
        .unwrap_or_default()
        .split_whitespace()
        .collect();
    list.extend(lines.next().unwrap_or_default().split_whitespace());
    format!("{}\n{}", list.join(" "), list.len())
}

// --- FizzBuzz ---------------------------------------------------------------------------------

fn fizzbuzz_inputs(rng: &mut Rng) -> Vec<String> {
    let mut sizes = vec![1, 2, 3, 5, 15, 100];
    sizes.extend((0..4).map(|_| rng.usize(1..=100)));
    sizes.into_iter().map(|n| format!("{n}\n")).collect()
}

fn fizzbuzz_solve(input: &str) -> String {
    (1..=first_line_number(input))
        .map(|i| match (i % 3, i % 5) {
            (0, 0) => "FizzBuzz".to_owned(),
            (0, _) => "Fizz".to_owned(),
            (_, 0) => "Buzz".to_owned(),
            _ => i.to_string(),
        })
        .collect::<Vec<_>>()
        .join("\n")
}

// --- Tips: percentage of each bill, total rounded to 2 decimals --------------------------------

const PERCENTAGES: [u32; 6] = [5, 10, 12, 15, 18, 20];

fn tips_inputs(rng: &mut Rng) -> Vec<String> {
    let mut inputs = vec![
        "1\n40 15\n".to_owned(),
        "2\n100 10\n20 20\n".to_owned(),
        "3\n1 5\n1 5\n1 5\n".to_owned(),
    ];
    for _ in 0..6 {
        let tables = rng.usize(1..=8);
        let mut input = format!("{tables}\n");
        for _ in 0..tables {
            let bill = rng.u32(5..=200);
            let percentage = PERCENTAGES[rng.usize(0..PERCENTAGES.len())];
            let _ = writeln!(input, "{bill} {percentage}");
        }
        inputs.push(input);
    }
    inputs
}

/// Computed in integer cents: `bill * percentage / 100` euros is exactly `bill * percentage`
/// cents, so there is no rounding ambiguity whatever the language does with floats.
fn tips_solve(input: &str) -> String {
    let cents: u64 = input
        .lines()
        .skip(1)
        .filter_map(|line| {
            let mut parts = line.split_whitespace();
            let bill: u64 = parts.next()?.parse().ok()?;
            let percentage: u64 = parts.next()?.parse().ok()?;
            Some(bill * percentage)
        })
        .sum();
    format!(
        "Total des pourboires : {}.{:02} €",
        cents / 100,
        cents % 100
    )
}

// --- Shared helpers for the text exercises ----------------------------------------------------

const SENTENCE_WORDS: [&str; 10] = [
    "chat", "soleil", "arbre", "riviere", "nuage", "pomme", "code", "lune", "fleur", "vent",
];

/// Between `min` and `max` words from the shared pool.
fn random_words(rng: &mut Rng, min: usize, max: usize) -> Vec<&'static str> {
    let count = rng.usize(min..=max);
    (0..count)
        .map(|_| SENTENCE_WORDS[rng.usize(0..SENTENCE_WORDS.len())])
        .collect()
}

fn random_letters(rng: &mut Rng, count: usize, alphabet: &[char]) -> String {
    (0..count)
        .map(|_| alphabet[rng.usize(0..alphabet.len())])
        .collect()
}

fn with_newline(values: &[&str]) -> Vec<String> {
    values.iter().map(|value| format!("{value}\n")).collect()
}

// --- Largest number: all of them can be negative ------------------------------------------------

fn max_in_list_inputs(rng: &mut Rng) -> Vec<String> {
    let mut inputs = vec![
        "3\n-5 -2 -9\n".to_owned(),
        "1\n-7\n".to_owned(),
        "4\n3 3 3 3\n".to_owned(),
        "5\n-1 0 -3 2 -8\n".to_owned(),
    ];
    for _ in 0..6 {
        let count = rng.usize(1..=10);
        let numbers: Vec<String> = (0..count)
            .map(|_| rng.i32(-100..=100).to_string())
            .collect();
        inputs.push(format!("{count}\n{}\n", numbers.join(" ")));
    }
    inputs
}

fn max_in_list_solve(input: &str) -> String {
    input
        .lines()
        .nth(1)
        .unwrap_or_default()
        .split_whitespace()
        .filter_map(|number| number.parse::<i64>().ok())
        .max()
        .unwrap_or_default()
        .to_string()
}

// --- Vowels: a e i o u y, in upper case too ---------------------------------------------------

fn count_vowels_inputs(rng: &mut Rng) -> Vec<String> {
    let mut inputs = with_newline(&["Bonjour", "AEIOUY", "bcd", "YOYO", "rhythm", "Le Chat Noir"]);
    for _ in 0..5 {
        let words = random_words(rng, 1, 4).join(" ");
        let text: String = words
            .chars()
            .map(|letter| {
                if rng.bool() {
                    letter.to_ascii_uppercase()
                } else {
                    letter
                }
            })
            .collect();
        inputs.push(format!("{text}\n"));
    }
    inputs
}

fn count_vowels_solve(input: &str) -> String {
    input
        .lines()
        .next()
        .unwrap_or_default()
        .to_lowercase()
        .chars()
        .filter(|letter| "aeiouy".contains(*letter))
        .count()
        .to_string()
}

// --- Palindrome ---------------------------------------------------------------------------------

fn palindrome_inputs(rng: &mut Rng) -> Vec<String> {
    let mut inputs = with_newline(&["a", "kayak", "ab", "abca", "abba", "racecar", "zz"]);
    let alphabet = ['a', 'b', 'c'];
    for _ in 0..6 {
        let half_length = rng.usize(1..=4);
        let half = random_letters(rng, half_length, &alphabet);
        let mirrored: String = half.chars().rev().collect();
        let middle = if rng.bool() {
            random_letters(rng, 1, &alphabet)
        } else {
            String::new()
        };
        let mut word = format!("{half}{middle}{mirrored}");
        if rng.bool() {
            // A near miss: one letter changed, so a sloppy check is not enough.
            let position = rng.usize(0..word.chars().count());
            word = word
                .chars()
                .enumerate()
                .map(|(index, letter)| if index == position { 'd' } else { letter })
                .collect();
        }
        inputs.push(format!("{word}\n"));
    }
    inputs
}

fn palindrome_solve(input: &str) -> String {
    let word = input.lines().next().unwrap_or_default().trim();
    let reversed: String = word.chars().rev().collect();
    if word == reversed { "oui" } else { "non" }.to_owned()
}

// --- Factorial -----------------------------------------------------------------------------------

fn factorial_inputs(rng: &mut Rng) -> Vec<String> {
    let mut sizes = vec![0, 1, 2, 5, 10, 15];
    sizes.extend((0..4).map(|_| rng.usize(0..=15)));
    sizes.into_iter().map(|n| format!("{n}\n")).collect()
}

fn factorial_solve(input: &str) -> String {
    (1..=first_line_number(input) as u64)
        .product::<u64>()
        .to_string()
}

// --- Reverse the order of the words -------------------------------------------------------------

fn reverse_words_inputs(rng: &mut Rng) -> Vec<String> {
    let mut inputs = with_newline(&["bonjour", "un deux trois", "a b"]);
    for _ in 0..5 {
        inputs.push(format!("{}\n", random_words(rng, 1, 8).join(" ")));
    }
    inputs
}

fn reverse_words_solve(input: &str) -> String {
    let mut words: Vec<&str> = input
        .lines()
        .next()
        .unwrap_or_default()
        .split_whitespace()
        .collect();
    words.reverse();
    words.join(" ")
}

// --- Primes up to n: 1 is not prime -----------------------------------------------------------

fn primes_inputs(rng: &mut Rng) -> Vec<String> {
    let mut sizes = vec![2, 3, 4, 10, 30, 97, 100];
    sizes.extend((0..4).map(|_| rng.usize(2..=100)));
    sizes.into_iter().map(|n| format!("{n}\n")).collect()
}

fn primes_solve(input: &str) -> String {
    let limit = first_line_number(input);
    (2..=limit)
        .filter(|candidate| (2..*candidate).all(|divisor| candidate % divisor != 0))
        .map(|prime| prime.to_string())
        .collect::<Vec<_>>()
        .join(" ")
}

// --- Word count: one line per distinct word, in alphabetical order --------------------------------

const COUNTED_WORDS: [&str; 5] = ["pomme", "poire", "kiwi", "fraise", "mangue"];

fn word_count_inputs(rng: &mut Rng) -> Vec<String> {
    let mut inputs = with_newline(&["a a a", "pomme poire pomme", "kiwi"]);
    for _ in 0..5 {
        let words: Vec<&str> = (0..rng.usize(1..=12))
            .map(|_| COUNTED_WORDS[rng.usize(0..COUNTED_WORDS.len())])
            .collect();
        inputs.push(format!("{}\n", words.join(" ")));
    }
    inputs
}

fn word_count_solve(input: &str) -> String {
    let mut counts: BTreeMap<&str, usize> = BTreeMap::new();
    for word in input.lines().next().unwrap_or_default().split_whitespace() {
        *counts.entry(word).or_default() += 1;
    }
    counts
        .iter()
        .map(|(word, count)| format!("{word}: {count}"))
        .collect::<Vec<_>>()
        .join("\n")
}

// --- Remove duplicates, keeping the order of first appearance -------------------------------------

fn dedupe_inputs(rng: &mut Rng) -> Vec<String> {
    let mut inputs = with_newline(&["1 1 1", "3 1 3 2 1", "5", "9 8 7 8 9 6"]);
    for _ in 0..6 {
        let count = rng.usize(1..=12);
        inputs.push(format!("{}\n", numbers_line(rng, count, 9)));
    }
    inputs
}

fn dedupe_solve(input: &str) -> String {
    let mut seen: Vec<&str> = Vec::new();
    for number in input.lines().next().unwrap_or_default().split_whitespace() {
        if !seen.contains(&number) {
            seen.push(number);
        }
    }
    seen.join(" ")
}

// --- Change: the fewest coins, biggest first -------------------------------------------------------

const COINS: [usize; 6] = [50, 20, 10, 5, 2, 1];

fn change_coins_inputs(rng: &mut Rng) -> Vec<String> {
    let mut amounts = vec![1, 3, 99, 500, 7, 40];
    amounts.extend((0..5).map(|_| rng.usize(1..=500)));
    amounts
        .into_iter()
        .map(|amount| format!("{amount}\n"))
        .collect()
}

fn change_coins_solve(input: &str) -> String {
    let mut remaining = first_line_number(input);
    let mut lines = Vec::new();
    for coin in COINS {
        let count = remaining / coin;
        remaining -= count * coin;
        if count > 0 {
            lines.push(format!("{coin}: {count}"));
        }
    }
    lines.join("\n")
}

// --- Caesar cipher: shift the letters, wrap after z, keep the spaces -------------------------------

fn caesar_inputs(rng: &mut Rng) -> Vec<String> {
    let mut inputs = vec![
        "3\nabc xyz\n".to_owned(),
        "0\nbonjour\n".to_owned(),
        "25\nb a\n".to_owned(),
        "13\nnouveau monde\n".to_owned(),
    ];
    for _ in 0..6 {
        let shift = rng.usize(0..=25);
        let text = random_words(rng, 1, 4).join(" ");
        inputs.push(format!("{shift}\n{text}\n"));
    }
    inputs
}

fn caesar_solve(input: &str) -> String {
    let mut lines = input.lines();
    let shift: u8 = lines
        .next()
        .and_then(|line| line.trim().parse().ok())
        .unwrap_or_default();
    lines
        .next()
        .unwrap_or_default()
        .chars()
        .map(|letter| {
            if letter.is_ascii_lowercase() {
                let offset = (letter as u8 - b'a' + shift) % 26;
                char::from(b'a' + offset)
            } else {
                letter
            }
        })
        .collect()
}

// --- The hard exercises ----------------------------------------------------------------------------

/// The whitespace separated numbers of a line.
fn parse_numbers(line: &str) -> Vec<usize> {
    line.split_whitespace()
        .filter_map(|word| word.parse().ok())
        .collect()
}

// --- Longest increasing subsequence: strictly increasing -------------------------------------------

fn lis_inputs(rng: &mut Rng) -> Vec<String> {
    let mut inputs = vec![
        "1\n5\n".to_owned(),
        "5\n3 3 3 3 3\n".to_owned(),
        "5\n5 4 3 2 1\n".to_owned(),
        "5\n1 2 3 4 5\n".to_owned(),
        "8\n10 9 2 5 3 7 101 18\n".to_owned(),
        "6\n1 3 2 3 4 4\n".to_owned(),
    ];
    for _ in 0..5 {
        let count = rng.usize(1..=30);
        inputs.push(format!("{count}\n{}\n", numbers_line(rng, count, 20)));
    }
    // Long enough for a program that tries every subsequence to give up.
    inputs.push(format!("800\n{}\n", numbers_line(rng, 800, 1000)));
    inputs
}

fn lis_solve(input: &str) -> String {
    let values = parse_numbers(input.lines().nth(1).unwrap_or_default());
    let mut best = vec![1_usize; values.len()];
    for i in 0..values.len() {
        for j in 0..i {
            if values[j] < values[i] {
                best[i] = best[i].max(best[j] + 1);
            }
        }
    }
    best.into_iter().max().unwrap_or_default().to_string()
}

// --- Edit distance: insert, delete or replace a letter ---------------------------------------------

fn random_word(rng: &mut Rng, length: usize, alphabet: u8) -> String {
    (0..length)
        .map(|_| char::from(b'a' + rng.u8(0..alphabet)))
        .collect()
}

fn edit_distance_inputs(rng: &mut Rng) -> Vec<String> {
    let mut inputs = vec![
        "kitten\nsitting\n".to_owned(),
        "\nabc\n".to_owned(),
        "abc\n\n".to_owned(),
        "\n\n".to_owned(),
        "same\nsame\n".to_owned(),
        "a\nb\n".to_owned(),
    ];
    for _ in 0..6 {
        let (first, second) = (rng.usize(0..=12), rng.usize(0..=12));
        inputs.push(format!(
            "{}\n{}\n",
            random_word(rng, first, 3),
            random_word(rng, second, 3)
        ));
    }
    // Long enough for a program that tries every sequence of operations to give up.
    let (first, second) = (rng.usize(25..=30), rng.usize(25..=30));
    inputs.push(format!(
        "{}\n{}\n",
        random_word(rng, first, 4),
        random_word(rng, second, 4)
    ));
    inputs
}

fn edit_distance_solve(input: &str) -> String {
    let mut lines = input.split('\n');
    let first: Vec<char> = lines.next().unwrap_or_default().chars().collect();
    let second: Vec<char> = lines.next().unwrap_or_default().chars().collect();
    let mut previous: Vec<usize> = (0..=second.len()).collect();
    for (i, a) in first.iter().enumerate() {
        let mut current = vec![i + 1];
        for (j, b) in second.iter().enumerate() {
            let cost = usize::from(a != b);
            current.push(
                (previous[j + 1] + 1)
                    .min(current[j] + 1)
                    .min(previous[j] + cost),
            );
        }
        previous = current;
    }
    previous[second.len()].to_string()
}

// --- Knapsack: the best value in a bag that holds a limited weight ---------------------------------

fn random_knapsack(rng: &mut Rng, items: usize, capacity: usize, max_weight: usize) -> String {
    let mut lines = vec![format!("{items} {capacity}")];
    for _ in 0..items {
        lines.push(format!(
            "{} {}",
            rng.usize(1..=max_weight),
            rng.usize(1..=100)
        ));
    }
    lines.join("\n") + "\n"
}

fn knapsack_inputs(rng: &mut Rng) -> Vec<String> {
    let mut inputs = vec![
        // The classic: the best choice is not the most profitable item per kilo.
        "3 50\n10 60\n20 100\n30 120\n".to_owned(),
        // No item at all.
        "0 10\n".to_owned(),
        // Nothing fits.
        "2 5\n6 10\n7 20\n".to_owned(),
        // One item that fits exactly.
        "1 10\n10 7\n".to_owned(),
        // An item may be taken only once.
        "2 10\n5 10\n20 1\n".to_owned(),
    ];
    for _ in 0..5 {
        let (items, capacity) = (rng.usize(1..=8), rng.usize(1..=40));
        inputs.push(random_knapsack(rng, items, capacity, 20));
    }
    // Too many combinations for a program that tries them all.
    let capacity = rng.usize(100..=200);
    inputs.push(random_knapsack(rng, 30, capacity, 60));
    inputs
}

fn knapsack_solve(input: &str) -> String {
    let mut lines = input.lines();
    let &[items, capacity] = parse_numbers(lines.next().unwrap_or_default()).as_slice() else {
        return String::new();
    };
    let mut best = vec![0_usize; capacity + 1];
    for line in lines.take(items) {
        let &[weight, value] = parse_numbers(line).as_slice() else {
            continue;
        };
        for room in (weight..=capacity).rev() {
            best[room] = best[room].max(best[room - weight] + value);
        }
    }
    best[capacity].to_string()
}

// --- Shortest path: Dijkstra on two-way roads ------------------------------------------------------

fn random_roads(rng: &mut Rng, cities: usize, roads: usize) -> String {
    let mut lines = vec![format!("{cities} {roads}")];
    for _ in 0..roads {
        let from = rng.usize(1..=cities);
        let mut to = rng.usize(1..=cities);
        while to == from {
            to = rng.usize(1..=cities);
        }
        lines.push(format!("{from} {to} {}", rng.usize(1..=20)));
    }
    lines.push(format!(
        "{} {}",
        rng.usize(1..=cities),
        rng.usize(1..=cities)
    ));
    lines.join("\n") + "\n"
}

fn shortest_path_inputs(rng: &mut Rng) -> Vec<String> {
    let mut inputs = vec![
        "4 3\n1 2 5\n2 3 2\n3 4 1\n1 4\n".to_owned(),
        // The arrival cannot be reached.
        "4 1\n1 2 3\n3 4\n".to_owned(),
        // The start is the arrival.
        "3 1\n1 2 4\n2 2\n".to_owned(),
        // The shortest way is not the one with the fewest roads.
        "4 5\n1 2 1\n2 4 10\n1 3 4\n3 4 3\n1 4 20\n1 4\n".to_owned(),
        // Two roads between the same cities.
        "2 2\n1 2 9\n1 2 3\n1 2\n".to_owned(),
        // No road at all.
        "3 0\n1 3\n".to_owned(),
    ];
    for _ in 0..5 {
        let (cities, roads) = (rng.usize(2..=10), rng.usize(0..=15));
        inputs.push(random_roads(rng, cities, roads));
    }
    inputs.push(random_roads(rng, 150, 400));
    inputs
}

fn shortest_path_solve(input: &str) -> String {
    let mut lines = input.lines();
    let &[cities, roads] = parse_numbers(lines.next().unwrap_or_default()).as_slice() else {
        return String::new();
    };
    let mut graph = vec![Vec::new(); cities + 1];
    for line in lines.by_ref().take(roads) {
        let &[from, to, length] = parse_numbers(line).as_slice() else {
            continue;
        };
        graph[from].push((to, length));
        graph[to].push((from, length));
    }
    let &[start, goal] = parse_numbers(lines.next().unwrap_or_default()).as_slice() else {
        return String::new();
    };

    let mut distance = vec![usize::MAX; cities + 1];
    let mut done = vec![false; cities + 1];
    distance[start] = 0;
    while let Some(city) = (1..=cities)
        .filter(|&city| !done[city] && distance[city] != usize::MAX)
        .min_by_key(|&city| distance[city])
    {
        done[city] = true;
        for &(next, length) in &graph[city] {
            distance[next] = distance[next].min(distance[city] + length);
        }
    }
    if distance[goal] == usize::MAX {
        "-1".to_owned()
    } else {
        distance[goal].to_string()
    }
}

// --- Topological order: the smallest available task at each step -----------------------------------

fn edges_text(tasks: usize, edges: &[(usize, usize)]) -> String {
    let mut lines = vec![format!("{tasks} {}", edges.len())];
    lines.extend(edges.iter().map(|(a, b)| format!("{a} {b}")));
    lines.join("\n") + "\n"
}

/// A random order of the tasks, and edges that all go forward in it: no cycle is possible.
fn forward_edges(rng: &mut Rng, tasks: usize, chance: f64) -> (Vec<usize>, Vec<(usize, usize)>) {
    let mut order: Vec<usize> = (1..=tasks).collect();
    rng.shuffle(&mut order);
    let mut edges = Vec::new();
    for i in 0..tasks {
        for j in (i + 1)..tasks {
            if rng.f64() < chance {
                edges.push((order[i], order[j]));
            }
        }
    }
    rng.shuffle(&mut edges);
    (order, edges)
}

fn topological_order_inputs(rng: &mut Rng) -> Vec<String> {
    let mut inputs = vec![
        // The smallest available task is chosen again at each step.
        "4 2\n3 1\n4 2\n".to_owned(),
        // No constraint.
        "3 0\n".to_owned(),
        // A cycle.
        "3 3\n1 2\n2 3\n3 1\n".to_owned(),
        "1 0\n".to_owned(),
        // A constraint that is repeated.
        "2 2\n1 2\n1 2\n".to_owned(),
        "5 4\n5 4\n4 3\n3 2\n2 1\n".to_owned(),
    ];
    for _ in 0..4 {
        let tasks = rng.usize(2..=8);
        let (_, edges) = forward_edges(rng, tasks, 0.3);
        inputs.push(edges_text(tasks, &edges));
    }
    // A chain closed on itself: a cycle for sure.
    for _ in 0..2 {
        let tasks = rng.usize(3..=8);
        let (order, mut edges) = forward_edges(rng, tasks, 0.0);
        edges.extend(order.windows(2).map(|pair| (pair[0], pair[1])));
        edges.push((order[tasks - 1], order[0]));
        rng.shuffle(&mut edges);
        inputs.push(edges_text(tasks, &edges));
    }
    let (_, edges) = forward_edges(rng, 40, 0.08);
    inputs.push(edges_text(40, &edges));
    inputs
}

fn topological_order_solve(input: &str) -> String {
    let mut lines = input.lines();
    let &[tasks, edges] = parse_numbers(lines.next().unwrap_or_default()).as_slice() else {
        return String::new();
    };
    let mut after = vec![Vec::new(); tasks + 1];
    let mut waiting = vec![0_usize; tasks + 1];
    for line in lines.take(edges) {
        let &[before, later] = parse_numbers(line).as_slice() else {
            continue;
        };
        after[before].push(later);
        waiting[later] += 1;
    }
    let mut ready: BTreeSet<usize> = (1..=tasks).filter(|&task| waiting[task] == 0).collect();
    let mut order = Vec::new();
    while let Some(task) = ready.pop_first() {
        order.push(task);
        for &follower in &after[task] {
            waiting[follower] -= 1;
            if waiting[follower] == 0 {
                ready.insert(follower);
            }
        }
    }
    if order.len() == tasks {
        order
            .iter()
            .map(ToString::to_string)
            .collect::<Vec<_>>()
            .join(" ")
    } else {
        "IMPOSSIBLE".to_owned()
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn fibonacci_solve_should_list_the_first_terms_when_n_is_seven() {
        assert_eq!(fibonacci_solve("7\n"), "0 1 1 2 3 5 8");
    }

    #[test]
    fn dict_sum_solve_should_keep_only_the_last_value_when_a_key_repeats() {
        assert_eq!(dict_sum_solve("3\na 1\nb 2\na 10\n"), "12");
    }

    #[test]
    fn list_extend_solve_should_handle_an_empty_starting_list() {
        assert_eq!(list_extend_solve("\n7 8\n"), "7 8\n2");
    }

    #[test]
    fn fizzbuzz_solve_should_replace_multiples_when_n_is_fifteen() {
        assert!(fizzbuzz_solve("15\n").ends_with("14\nFizzBuzz"));
    }

    #[test]
    fn tips_solve_should_sum_in_cents_when_bills_have_decimal_tips() {
        assert_eq!(
            tips_solve("2\n18 12\n45 15\n"),
            "Total des pourboires : 8.91 €"
        );
    }

    #[test]
    fn lis_solve_should_not_count_equal_values_when_the_sequence_must_strictly_increase() {
        assert_eq!(lis_solve("6\n1 3 2 3 4 4\n"), "4");
    }

    #[test]
    fn edit_distance_solve_should_count_three_operations_when_turning_kitten_into_sitting() {
        assert_eq!(edit_distance_solve("kitten\nsitting\n"), "3");
    }

    #[test]
    fn edit_distance_solve_should_be_the_other_length_when_a_word_is_empty() {
        assert_eq!(edit_distance_solve("\nabc\n"), "3");
    }

    #[test]
    fn knapsack_solve_should_not_take_the_most_profitable_item_per_kilo_when_it_is_worse() {
        assert_eq!(knapsack_solve("3 50\n10 60\n20 100\n30 120\n"), "220");
    }

    #[test]
    fn knapsack_solve_should_take_an_item_only_once() {
        assert_eq!(knapsack_solve("2 10\n5 10\n20 1\n"), "10");
    }

    #[test]
    fn shortest_path_solve_should_prefer_the_shortest_way_over_the_fewest_roads() {
        assert_eq!(
            shortest_path_solve("4 5\n1 2 1\n2 4 10\n1 3 4\n3 4 3\n1 4 20\n1 4\n"),
            "7"
        );
    }

    #[test]
    fn shortest_path_solve_should_be_minus_one_when_the_arrival_cannot_be_reached() {
        assert_eq!(shortest_path_solve("4 1\n1 2 3\n3 4\n"), "-1");
    }

    #[test]
    fn topological_order_solve_should_pick_the_smallest_available_task_at_each_step() {
        assert_eq!(topological_order_solve("4 2\n3 1\n4 2\n"), "3 1 4 2");
    }

    #[test]
    fn topological_order_solve_should_be_impossible_when_the_constraints_form_a_cycle() {
        assert_eq!(
            topological_order_solve("3 3\n1 2\n2 3\n3 1\n"),
            "IMPOSSIBLE"
        );
    }

    #[test]
    fn generate_should_draw_different_inputs_when_the_seed_changes() {
        let first = generate("fibonacci", &mut Rng::with_seed(1)).unwrap();
        let second = generate("fibonacci", &mut Rng::with_seed(2)).unwrap();
        let inputs = |cases: &[Case]| cases.iter().map(|c| c.input.clone()).collect::<Vec<_>>();
        assert_ne!(inputs(&first), inputs(&second));
    }

    #[test]
    fn generate_should_be_none_when_the_exercise_is_unknown() {
        assert!(generate("nope", &mut Rng::with_seed(1)).is_none());
    }
}
