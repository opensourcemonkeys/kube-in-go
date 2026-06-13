import os
import sys
import pytest
from selenium import webdriver
from selenium.webdriver.chrome.options import Options
from pytest_html import extras as html_extras

# Make helpers.py importable regardless of the working directory pytest is
# invoked from (e.g. `make test-e2e` runs from the repo root via `cd e2e_tests`).
sys.path.insert(0, os.path.dirname(__file__))

# ── Configuration ─────────────────────────────────────────────────────────────
# Headless is env-driven so CI can run without a visible window while local runs
# stay headed by default. Set E2E_HEADLESS=1 (as the GitHub Actions e2e job does)
# to enable headless Chrome.
HEADLESS = os.environ.get("E2E_HEADLESS", "0") == "1"

BASE_URL = "http://localhost:34115"


# ── Session-scoped WebDriver ──────────────────────────────────────────────────

@pytest.fixture(scope="session")
def driver():
    """
    Single Chrome WebDriver instance shared across the entire test session.

    The browser navigates to BASE_URL once on startup and is kept open for all
    tests.  Because kube-ins is a single-page app, page state (open Dockview
    tabs, sidebar state) carries forward between test modules — tests must not
    assume a clean slate beyond what they explicitly set up.
    """
    options = Options()
    if HEADLESS:
        options.add_argument("--headless=new")
        options.add_argument("--disable-gpu")
    options.add_argument("--window-size=1280,800")
    options.add_argument("--no-sandbox")
    options.add_argument("--disable-dev-shm-usage")

    drv = webdriver.Chrome(options=options)
    drv.set_page_load_timeout(30)
    drv.get(BASE_URL)
    yield drv
    drv.quit()


# ── Failure screenshot hook ────────────────────────────────────────────────────

# pytest-html v4 uses tryfirst=True in its own pytest_runtest_makereport hook:
# it reads `report.extras` in its after-yield phase and builds the final list.
# We use trylast=True so that OUR after-yield runs BEFORE the plugin's after-yield,
# meaning the plugin will pick up our screenshot when it reads `report.extras`.

@pytest.hookimpl(hookwrapper=True, trylast=True)
def pytest_runtest_makereport(item, call):
    """
    Capture a full-page screenshot whenever a test fails and embed it in the
    pytest-html report as an inline PNG image.

    Covers all failure phases (setup, call, teardown) so that fixture errors
    are also documented with a browser snapshot.
    """
    outcome = yield
    report = outcome.get_result()

    if not report.failed:
        return

    # item.funcargs contains the resolved fixture values for this test.
    # For session-scoped fixtures (like `driver`) pytest caches and exposes
    # them here, so this works even when the driver fixture is indirect.
    driver = item.funcargs.get("driver")
    if driver is None:
        return

    try:
        # get_screenshot_as_base64() returns a raw base64 string (no data-URI
        # prefix) which is exactly what pytest_html.extras.png() expects.
        screenshot_b64 = driver.get_screenshot_as_base64()

        # Build a label that includes the failure phase so it's easy to tell
        # apart setup failures from assertion failures in the HTML report.
        label = f"Screenshot ({report.when})"

        existing = getattr(report, "extras", [])
        report.extras = existing + [html_extras.png(screenshot_b64, name=label)]
    except Exception:
        # Never let the screenshot hook break the test run.
        pass
