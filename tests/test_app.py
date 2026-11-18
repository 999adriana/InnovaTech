import json
import os
import tempfile
import unittest
from pathlib import Path
from types import SimpleNamespace
from unittest.mock import AsyncMock, patch

os.environ.setdefault("LLM_PROXY_URL", "http://127.0.0.1:1")
os.environ.setdefault("TEAM_KEY", "test-key")

import app
from fastapi.testclient import TestClient
from openai import OpenAIError


class FakeCompletions:
    def __init__(self, content="{}", error=None):
        self.content = content
        self.error = error

    def create(self, **kwargs):
        self.last_request = kwargs
        if self.error:
            raise self.error
        message = SimpleNamespace(content=self.content)
        return SimpleNamespace(choices=[SimpleNamespace(message=message)])


class AppTests(unittest.TestCase):
    def setUp(self):
        self.case_id = "daniel-emily-johnson"
        case_dir = app.BASE_DIR / "cases" / self.case_id
        self.raw_data = {
            "financial_health": json.loads((case_dir / "financial-health.json").read_text(encoding="utf-8")),
            "investment_analysis": json.loads((case_dir / "investment-analysis.json").read_text(encoding="utf-8")),
            "persona": (case_dir / "persona.md").read_text(encoding="utf-8"),
        }
        self.fetch_patcher = patch.object(
            app,
            "fetch_family_data",
            new=AsyncMock(return_value=self.raw_data),
        )
        self.fetch_patcher.start()
        self.addCleanup(self.fetch_patcher.stop)
        self.client_patcher = patch.object(
            app,
            "llm",
            SimpleNamespace(chat=SimpleNamespace(completions=FakeCompletions())),
        )
        self.client_patcher.start()
        self.addCleanup(self.client_patcher.stop)
        app.ISLAND_MAP_CACHE.clear()
        self.client = TestClient(app.app)

    def test_frontend_and_cases_load_outside_the_repository_directory(self):
        original_directory = Path.cwd()
        with tempfile.TemporaryDirectory() as temporary_directory:
            try:
                os.chdir(temporary_directory)
                home = self.client.get("/")
                cases = self.client.get("/api/cases")
            finally:
                os.chdir(original_directory)

        self.assertEqual(home.status_code, 200)
        self.assertIn(b'id="savingsView"', home.content)
        self.assertEqual(cases.status_code, 200)
        self.assertEqual(len(cases.json()), 4)

    def test_case_api_returns_local_financial_data(self):
        response = self.client.get(f"/api/case/{self.case_id}")

        self.assertEqual(response.status_code, 200)
        payload = response.json()
        self.assertIn("pillars", payload)
        self.assertIn("savings_data", payload)
        self.assertIn("protection_rings", payload)
        self.assertIn("investment_data", payload)

    def test_ai_failure_returns_actionable_gateway_error(self):
        failing_client = SimpleNamespace(
            chat=SimpleNamespace(completions=FakeCompletions(error=OpenAIError("offline")))
        )
        with patch.object(app, "llm", failing_client):
            response = self.client.get(f"/api/case/{self.case_id}")

        self.assertEqual(response.status_code, 502)
        self.assertIn("TEAM_KEY", response.json()["detail"])


if __name__ == "__main__":
    unittest.main()
