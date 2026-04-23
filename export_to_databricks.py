#!/usr/bin/env python3
"""Export selected SQLite tables from lingai.db into CSV files for Databricks DBFS upload."""

from __future__ import annotations

import argparse
import csv
import sqlite3
from pathlib import Path


# Logical output name -> possible source table names in SQLite.
TABLE_MAPPING = {
    "Questions": ["questions"],
    "Users": ["users"],
    "Results": ["results", "question_attempts"],
}


def get_existing_tables(conn: sqlite3.Connection) -> dict[str, str]:
    """Return existing tables keyed by lowercase name, value is original table name."""
    rows = conn.execute(
        "SELECT name FROM sqlite_master WHERE type='table' ORDER BY name"
    ).fetchall()
    return {name.lower(): name for (name,) in rows}


def resolve_source_table(
    logical_name: str,
    candidates: list[str],
    existing_tables: dict[str, str],
) -> str:
    """Find the first matching source table from candidates (case-insensitive)."""
    for candidate in candidates:
        table = existing_tables.get(candidate.lower())
        if table:
            return table

    available = ", ".join(sorted(existing_tables.values()))
    raise ValueError(
        f"Could not find source table for '{logical_name}'. "
        f"Tried: {candidates}. Available tables: {available}"
    )


def export_table_to_csv(
    conn: sqlite3.Connection,
    source_table: str,
    output_file: Path,
) -> int:
    """Export all rows from source_table to output_file and return row count."""
    query = f'SELECT * FROM "{source_table}"'
    cursor = conn.execute(query)
    headers = [description[0] for description in cursor.description or []]

    output_file.parent.mkdir(parents=True, exist_ok=True)
    with output_file.open("w", newline="", encoding="utf-8") as f:
        writer = csv.writer(f)
        if headers:
            writer.writerow(headers)
        rows = cursor.fetchall()
        writer.writerows(rows)

    return len(rows)


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(
        description="Export Questions/Users/Results tables from lingai.db to CSV files."
    )
    parser.add_argument(
        "--db-path",
        default="backend/lingai/lingai.db",
        help="Path to SQLite database file (default: backend/lingai/lingai.db)",
    )
    parser.add_argument(
        "--output-dir",
        default="exports/databricks",
        help="Directory for exported CSV files (default: exports/databricks)",
    )
    return parser.parse_args()


def main() -> None:
    args = parse_args()
    db_path = Path(args.db_path).resolve()
    output_dir = Path(args.output_dir).resolve()

    if not db_path.exists():
        raise FileNotFoundError(f"Database file not found: {db_path}")

    with sqlite3.connect(db_path) as conn:
        existing_tables = get_existing_tables(conn)

        print(f"Using database: {db_path}")
        print(f"Output directory: {output_dir}")

        for logical_name, candidates in TABLE_MAPPING.items():
            source_table = resolve_source_table(logical_name, candidates, existing_tables)
            output_file = output_dir / f"{logical_name}.csv"
            row_count = export_table_to_csv(conn, source_table, output_file)
            print(
                f"Exported {logical_name}.csv from table '{source_table}' "
                f"with {row_count} rows"
            )


if __name__ == "__main__":
    main()
