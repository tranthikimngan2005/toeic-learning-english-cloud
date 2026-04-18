"""Organize the backend project tree.

This script cleans generated files, archives legacy root-level utility scripts,
and prepares the raw data directory for new JSON imports.
"""

import os
import shutil


REPO_ROOT = os.path.dirname(os.path.abspath(__file__))
BACKEND_ROOT = os.path.join(REPO_ROOT, "backend", "lingai")
TESTS_DIR = os.path.join(BACKEND_ROOT, "tests")
ARCHIVE_DIR = os.path.join(BACKEND_ROOT, "archive")
RAW_DATA_DIR = os.path.join(REPO_ROOT, "data", "raw")

KEEP_ROOT_SCRIPTS = {"main.py", "seed_toeic.py"}
TEMP_DB_FILES = {"test_pengwin.db", "test_lingai.db"}
SQL_DELETE_DIRS = (BACKEND_ROOT, TESTS_DIR)


def remove_pycache_and_pyc(root_dir):
	removed_pyc = 0
	removed_cache = 0

	for current_root, dirs, files in os.walk(root_dir, topdown=False):
		for file_name in files:
			if file_name.endswith(".pyc"):
				file_path = os.path.join(current_root, file_name)
				try:
					os.remove(file_path)
					removed_pyc += 1
				except FileNotFoundError:
					pass

		for dir_name in dirs:
			if dir_name == "__pycache__":
				cache_path = os.path.join(current_root, dir_name)
				shutil.rmtree(cache_path, ignore_errors=True)
				removed_cache += 1

	return removed_pyc, removed_cache


def remove_sql_files():
	removed = 0
	for directory in SQL_DELETE_DIRS:
		if not os.path.isdir(directory):
			continue
		for entry in os.listdir(directory):
			if entry.endswith(".sql"):
				file_path = os.path.join(directory, entry)
				if os.path.isfile(file_path):
					try:
						os.remove(file_path)
						removed += 1
					except FileNotFoundError:
						pass
	return removed


def remove_temp_databases():
	removed = 0
	for file_name in TEMP_DB_FILES:
		file_path = os.path.join(BACKEND_ROOT, file_name)
		if os.path.exists(file_path):
			try:
				os.remove(file_path)
				removed += 1
			except FileNotFoundError:
				pass
	return removed


def unique_destination_path(directory, file_name):
	base_name, extension = os.path.splitext(file_name)
	candidate = os.path.join(directory, file_name)
	counter = 1
	while os.path.exists(candidate):
		candidate = os.path.join(directory, f"{base_name}_{counter}{extension}")
		counter += 1
	return candidate


def archive_legacy_scripts():
	os.makedirs(ARCHIVE_DIR, exist_ok=True)
	moved = []

	for entry in os.listdir(BACKEND_ROOT):
		source_path = os.path.join(BACKEND_ROOT, entry)
		if not os.path.isfile(source_path):
			continue
		if not entry.endswith(".py"):
			continue
		if entry in KEEP_ROOT_SCRIPTS:
			continue

		destination_path = unique_destination_path(ARCHIVE_DIR, entry)
		shutil.move(source_path, destination_path)
		moved.append(entry)

	return moved


def ensure_raw_data_dir_empty():
	if os.path.isdir(RAW_DATA_DIR):
		for entry in os.listdir(RAW_DATA_DIR):
			entry_path = os.path.join(RAW_DATA_DIR, entry)
			if os.path.isdir(entry_path):
				shutil.rmtree(entry_path, ignore_errors=True)
			else:
				try:
					os.remove(entry_path)
				except FileNotFoundError:
					pass
	else:
		os.makedirs(RAW_DATA_DIR, exist_ok=True)


def main():
	if not os.path.isdir(BACKEND_ROOT):
		raise FileNotFoundError(f"Backend folder not found: {BACKEND_ROOT}")

	removed_pyc, removed_cache = remove_pycache_and_pyc(BACKEND_ROOT)
	removed_sql = remove_sql_files()
	removed_dbs = remove_temp_databases()
	moved_scripts = archive_legacy_scripts()
	ensure_raw_data_dir_empty()

	print("Cleanup complete.")
	print(f"Removed {removed_pyc} .pyc files.")
	print(f"Removed {removed_cache} __pycache__ folders.")
	print(f"Removed {removed_sql} SQL files.")
	print(f"Removed {removed_dbs} temporary database files.")
	print(f"Archived {len(moved_scripts)} legacy script(s): {', '.join(moved_scripts) if moved_scripts else 'none'}")
	print(f"Prepared empty raw data directory at: {RAW_DATA_DIR}")


if __name__ == "__main__":
	main()
