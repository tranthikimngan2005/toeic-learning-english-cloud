#!/usr/bin/env python
"""Crawl TOEIC questions from anhlestudent.com using Selenium.

Usage examples:
    python crawl_anhlestudent_selenium.py
    python crawl_anhlestudent_selenium.py --lesson-url "https://anhlestudent.com/vocabulary-exercise-bai-6-1655-29.html"

Dependencies:
    pip install selenium webdriver-manager
"""

from __future__ import annotations

import argparse
import json
import re
import time
from pathlib import Path

from selenium import webdriver
from selenium.common.exceptions import NoSuchElementException, TimeoutException, ElementNotInteractableException
from selenium.webdriver import ChromeOptions
from selenium.webdriver.chrome.service import Service
from selenium.webdriver.common.by import By
from selenium.webdriver.support import expected_conditions as EC
from selenium.webdriver.support.ui import WebDriverWait
from webdriver_manager.chrome import ChromeDriverManager

BASE_URL = "https://anhlestudent.com/"
LOGIN_URL = "https://anhlestudent.com/login"
DEFAULT_LESSON_URL = "https://anhlestudent.com/vocabulary-exercise-bai-6-1655-29.html"

# Hardcoded per your request. You can replace with env/config later if needed.
ACCOUNT_EMAIL = "tranquocsang2706@gmail.com"
ACCOUNT_PASSWORD = "sang0987360616@"

PART = 5
LEVEL = 500
DEFAULT_TAG = "AnhLeStudent"


def _repo_root() -> Path:
    # script path: backend/lingai/crawl_anhlestudent_selenium.py -> repo root parents[2]
    return Path(__file__).resolve().parents[2]


def _output_file() -> Path:
    return _repo_root() / "data" / "raw" / "toeic_reading.json"


def _clean_text(text: str) -> str:
    return re.sub(r"\s+", " ", text or "").strip()


def _create_driver(headless: bool = False) -> webdriver.Chrome:
    options = ChromeOptions()
    if headless:
        options.add_argument("--headless=new")
    options.add_argument("--disable-blink-features=AutomationControlled")
    options.add_argument("--start-maximized")
    options.add_argument("--no-sandbox")
    options.add_argument("--disable-dev-shm-usage")

    service = Service(ChromeDriverManager().install())
    return webdriver.Chrome(service=service, options=options)


def _find_first(driver: webdriver.Chrome, selectors: list[tuple[By, str]]):
    for by, value in selectors:
        try:
            return driver.find_element(by, value)
        except NoSuchElementException:
            continue
    raise NoSuchElementException(f"Could not find element with selectors: {selectors}")


def _wait_find_first(driver: webdriver.Chrome, selectors: list[tuple[By, str]], timeout: int = 15):
    end_time = time.time() + timeout
    last_error = None
    while time.time() < end_time:
        for by, value in selectors:
            try:
                elem = driver.find_element(by, value)
                if elem:
                    return elem
            except NoSuchElementException as exc:
                last_error = exc
                continue
        time.sleep(0.3)
    raise NoSuchElementException(f"Could not find element with selectors: {selectors}") from last_error


def _find_interactable_in_scope(scope, selectors: list[tuple[By, str]]):
    """Find first visible and enabled element in a given scope (driver or form element)."""
    for by, value in selectors:
        elems = scope.find_elements(by, value)
        for elem in elems:
            try:
                if elem.is_displayed() and elem.is_enabled():
                    return elem
            except Exception:
                continue
    return None


def _set_input_value(driver: webdriver.Chrome, elem, value: str) -> None:
    """Set input value with normal typing first, then JS fallback."""
    try:
        driver.execute_script("arguments[0].scrollIntoView({block: 'center'});", elem)
    except Exception:
        pass

    try:
        elem.clear()
        elem.send_keys(value)
        return
    except (ElementNotInteractableException, Exception):
        # Fallback for hidden overlay/input wrappers.
        driver.execute_script(
            "arguments[0].value = arguments[1]; arguments[0].dispatchEvent(new Event('input', {bubbles:true})); arguments[0].dispatchEvent(new Event('change', {bubbles:true}));",
            elem,
            value,
        )


def login(driver: webdriver.Chrome) -> None:
    driver.get(LOGIN_URL)
    time.sleep(2)

    # /login currently returns 404 on this site; fallback to homepage login form.
    page_title = (driver.title or "").lower()
    page_source_lower = (driver.page_source or "").lower()
    if "404" in page_title or "404-not found" in page_source_lower:
        driver.get(BASE_URL)
        time.sleep(2)

    # Try scoped login form first.
    login_form = _wait_find_first(
        driver,
        [
            (By.ID, "form_s-sign-in-1"),
            (By.CSS_SELECTOR, "form[id*='sign-in']"),
            (By.CSS_SELECTOR, "form"),
        ],
        timeout=20,
    )

    email_selectors = [
        (By.NAME, "email"),
        (By.ID, "email"),
        (By.CSS_SELECTOR, "input[type='email']"),
        (By.CSS_SELECTOR, "input[name='email']"),
        (By.CSS_SELECTOR, "input[placeholder*='Tài khoản']"),
    ]

    email_input = _find_interactable_in_scope(login_form, email_selectors)

    if email_input is None:
        email_input = _find_interactable_in_scope(driver, email_selectors)
    if email_input is None:
        email_input = _wait_find_first(driver, email_selectors, timeout=20)

    _set_input_value(driver, email_input, ACCOUNT_EMAIL)
    time.sleep(2)

    password_selectors = [
        (By.NAME, "password"),
        (By.ID, "password"),
        (By.CSS_SELECTOR, "input[type='password']"),
    ]

    password_input = _find_interactable_in_scope(login_form, password_selectors)

    if password_input is None:
        password_input = _find_interactable_in_scope(driver, password_selectors)
    if password_input is None:
        password_input = _wait_find_first(driver, password_selectors, timeout=20)

    _set_input_value(driver, password_input, ACCOUNT_PASSWORD)
    time.sleep(2)

    login_btn_selectors = [
        (By.CSS_SELECTOR, "button[type='submit']"),
        (By.XPATH, ".//button[contains(., 'Đăng nhập') or contains(., 'Dang nhap') or contains(., 'Login') or contains(., 'Sign in') ]"),
        (By.XPATH, ".//input[@type='submit']"),
    ]

    login_btn = _find_interactable_in_scope(login_form, login_btn_selectors)

    if login_btn is None:
        login_btn = _find_interactable_in_scope(driver, login_btn_selectors)
    if login_btn is None:
        login_btn = _wait_find_first(driver, login_btn_selectors, timeout=20)

    try:
        driver.execute_script("arguments[0].scrollIntoView({block: 'center'});", login_btn)
    except Exception:
        pass

    try:
        login_btn.click()
    except Exception:
        driver.execute_script("arguments[0].click();", login_btn)
    time.sleep(2)

    # Wait for either URL change or body to be present after login submit.
    try:
        WebDriverWait(driver, 20).until(lambda d: d.current_url != LOGIN_URL)
    except TimeoutException:
        # Fallback wait to allow dynamic pages to settle.
        WebDriverWait(driver, 10).until(EC.presence_of_element_located((By.TAG_NAME, "body")))


def _parse_block_lines(lines: list[str]) -> tuple[str, list[str]]:
    content = ""
    options_map: dict[str, str] = {}

    for line in lines:
        line = _clean_text(line)
        if not line:
            continue

        # Content line: "Cau/Cau X: ..." or "Question X: ..."
        if ("Cau" in line or "Câu" in line or "Question" in line) and not content:
            content = re.sub(r"^(Cau|Cau\.|Câu|Question)\s*\d*\s*[:\-]?\s*", "", line, flags=re.IGNORECASE)
            content = _clean_text(content)
            continue

        # Option line: A:/B:/C:/D:
        m = re.match(r"^([A-D])\s*[:\.|\)|\-]?\s*(.+)$", line, flags=re.IGNORECASE)
        if m:
            options_map[m.group(1).upper()] = _clean_text(m.group(2))

    ordered = [options_map[k] for k in ["A", "B", "C", "D"] if k in options_map]
    return content, ordered


def _extract_explanation(block) -> str:
    explanation = ""

    # Try clicking 'Show result' / 'Giai thich' button if present.
    for xpath in [
        ".//button[contains(translate(., 'ABCDEFGHIJKLMNOPQRSTUVWXYZ', 'abcdefghijklmnopqrstuvwxyz'), 'show result')]",
        ".//button[contains(translate(., 'ABCDEFGHIJKLMNOPQRSTUVWXYZ', 'abcdefghijklmnopqrstuvwxyz'), 'giai thich')]",
        ".//a[contains(translate(., 'ABCDEFGHIJKLMNOPQRSTUVWXYZ', 'abcdefghijklmnopqrstuvwxyz'), 'show result')]",
        ".//a[contains(translate(., 'ABCDEFGHIJKLMNOPQRSTUVWXYZ', 'abcdefghijklmnopqrstuvwxyz'), 'giai thich')]",
    ]:
        try:
            btn = block.find_element(By.XPATH, xpath)
            btn.click()
            time.sleep(2)
            break
        except NoSuchElementException:
            continue
        except Exception:
            # If click fails, continue to text extraction fallback.
            continue

    for css in [
        ".explanation",
        ".giai-thich",
        ".result-content",
        ".show-result-content",
        ".answer-detail",
        ".solution",
    ]:
        elems = block.find_elements(By.CSS_SELECTOR, css)
        for elem in elems:
            txt = _clean_text(elem.text)
            if txt:
                explanation = txt
                break
        if explanation:
            break

    if not explanation:
        # Last fallback: search in block text
        block_text = _clean_text(block.text)
        m = re.search(r"(Giai\s*thich|Giải\s*thích|Explanation)\s*[:\-]?\s*(.+)$", block_text, flags=re.IGNORECASE)
        if m:
            explanation = _clean_text(m.group(2))

    return explanation


def _extract_correct_answer(explanation: str) -> str:
    if not explanation:
        return "A"
    m = re.search(r"(?:Dap\s*an|Đáp\s*án|Correct\s*answer|Answer)\s*[:\-]?\s*([A-D])\b", explanation, flags=re.IGNORECASE)
    if m:
        return m.group(1).upper()
    return "A"


def crawl_lesson(driver: webdriver.Chrome, lesson_url: str) -> list[dict]:
    driver.get(lesson_url)
    # Wait for dynamic lesson content to render fully.
    time.sleep(10)
    try:
        WebDriverWait(driver, 20).until(
            EC.presence_of_element_located((By.XPATH, "//*[contains(., '_______')]"))
        )
    except TimeoutException:
        # Keep going with current DOM snapshot even if explicit marker not found.
        pass

    # Broaden selector: find any element that contains blank marker in TOEIC items.
    blank_elements = driver.find_elements(By.XPATH, "//*[contains(., '_______')]")
    print(f"Found {len(blank_elements)} potential question elements")

    # Parse from parent blocks to capture options A/B/C/D and explanation sections.
    blocks = []
    for elem in blank_elements:
        parent = None
        try:
            parent = elem.find_element(By.XPATH, "./..")
        except Exception:
            parent = elem
        blocks.append(parent)

    # Fallback for pages that do not render explicit blank marker.
    if not blocks:
        blocks = driver.find_elements(
            By.XPATH,
            "//*[contains(., 'Cau ') or contains(., 'Câu ') or contains(., 'Cau:') or contains(., 'Câu:')]",
        )
        print(f"Fallback found {len(blocks)} question-like blocks")

    questions = []
    seen = set()

    for block in blocks:
        text = _clean_text(block.text)
        if not text:
            continue

        # Avoid processing giant parent containers repeatedly.
        if len(text) > 2500:
            continue

        lines = [ln for ln in block.text.splitlines() if _clean_text(ln)]
        content, options = _parse_block_lines(lines)
        if not content or len(options) < 4:
            continue

        if content in seen:
            continue
        seen.add(content)

        explanation = _extract_explanation(block)
        correct_answer = _extract_correct_answer(explanation)

        questions.append(
            {
                "part": PART,
                "level": LEVEL,
                "type": "mcq",
                "question_text": content,
                "options": options[:4],
                "correct_answer": correct_answer,
                "explanation": explanation,
                "tags": DEFAULT_TAG,
            }
        )

        time.sleep(2)

    return questions


def save_output(rows: list[dict]) -> Path:
    output_path = _output_file()
    output_path.parent.mkdir(parents=True, exist_ok=True)
    with output_path.open("w", encoding="utf-8") as f:
        json.dump(rows, f, ensure_ascii=False, indent=2)
    return output_path


def main() -> None:
    parser = argparse.ArgumentParser(description="Crawl TOEIC questions from anhlestudent.com")
    parser.add_argument("--lesson-url", default=DEFAULT_LESSON_URL, help="Lesson URL to crawl")
    parser.add_argument("--headless", action="store_true", help="Run Chrome in headless mode")
    args = parser.parse_args()

    driver = _create_driver(headless=args.headless)
    try:
        login(driver)
        rows = crawl_lesson(driver, args.lesson_url)
        out = save_output(rows)
        print(f"Saved {len(rows)} questions to {out}")
    finally:
        driver.quit()


if __name__ == "__main__":
    main()
