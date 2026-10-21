#!/usr/bin/env python3
"""Print the destructive statements found in the given SQL migration files.

Used by the "DB migrations" CI job: a PR that adds such a statement needs the `breaking-change` label.
Function bodies ($$ ... $$) and comments are ignored, because the migration itself does not execute them
(a `delete from` inside a function is not a data migration).

Usage: find-destructive-sql.py FILE [FILE...]   (prints "file:line: statement", exits 0 either way)
"""
import re
import sys

DESTRUCTIVE = re.compile(
    r"\bdrop\s+(table|column|schema|type)\b|\btruncate\b|\bdelete\s+from\b", re.IGNORECASE
)


def blank(match: re.Match) -> str:
    """Replace a matched block by spaces, keeping its line breaks so line numbers stay correct."""
    return re.sub(r"[^\n]", " ", match.group(0))


def strip_non_executed(sql: str) -> str:
    sql = re.sub(r"\$([A-Za-z_]*)\$.*?\$\1\$", blank, sql, flags=re.DOTALL)
    sql = re.sub(r"/\*.*?\*/", blank, sql, flags=re.DOTALL)
    return re.sub(r"--[^\n]*", "", sql)


def main(paths: list[str]) -> None:
    for path in paths:
        with open(path, encoding="utf-8") as handle:
            sql = strip_non_executed(handle.read())
        for number, line in enumerate(sql.splitlines(), start=1):
            if DESTRUCTIVE.search(line):
                print(f"{path}:{number}: {line.strip()}")


if __name__ == "__main__":
    main(sys.argv[1:])
