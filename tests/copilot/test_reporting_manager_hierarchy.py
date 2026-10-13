import pytest
import sys
import os

sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), "../..")))
sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), "../../backend")))

from backend.app.ai.orchestrator import LLMOrchestrator
from backend.app.ai.capability_registry import EntityNormalizer

@pytest.fixture(scope="module")
def orchestrator():
    return LLMOrchestrator()

class TestReportingManagerHierarchy:
    def test_irfan_is_reporting_to_whom(self, orchestrator):
        res = orchestrator.process("Irfan is reporting to whom?")
        assert res.get("intent") == "DETERMINISTIC_SQL"
        assert res.get("confidence") == 1.0
        assert "Radhakanta" in res.get("answer", "")
        assert "1010164" in res.get("answer", "")

    def test_who_is_irfanss_manager(self, orchestrator):
        res = orchestrator.process("who is irfan''ss manager?")
        assert res.get("intent") == "DETERMINISTIC_SQL"
        assert res.get("confidence") == 1.0
        assert "Radhakanta" in res.get("answer", "")

    def test_who_is_irfans_manager(self, orchestrator):
        res = orchestrator.process("who is irfan's manager?")
        assert res.get("intent") == "DETERMINISTIC_SQL"
        assert "res.get('confidence')" == "1.0" or res.get("confidence") == 1.0
        assert "Radhakanta" in res.get("answer", "")

    def test_who_reports_to_irfan(self, orchestrator):
        res = orchestrator.process("who reports to Irfan?")
        assert res.get("intent") == "DETERMINISTIC_SQL"
        assert res.get("confidence") == 1.0
        assert "10 employee(s)" in res.get("answer", "")

    def test_who_is_reporting_to_irfan(self, orchestrator):
        res = orchestrator.process("who is reporting to Irfan?")
        assert res.get("intent") == "DETERMINISTIC_SQL"
        assert "10 employee(s)" in res.get("answer", "")

    def test_reporting_skill_not_confused(self, orchestrator):
        res = orchestrator.process("How many employees have Reporting skill?")
        assert res.get("intent") == "DETERMINISTIC_SQL"
        assert "5 employees" in res.get("answer", "")

    def test_global_manager_breakdown(self, orchestrator):
        res = orchestrator.process("Show employees by manager")
        assert res.get("intent") == "DETERMINISTIC_SQL"
        assert "Kishore Kumar N" in res.get("answer", "")

    def test_largest_team_manager(self, orchestrator):
        res = orchestrator.process("Which manager has the largest team?")
        assert res.get("intent") == "DETERMINISTIC_SQL"
        assert "Kishore Kumar N" in res.get("answer", "")

    def test_generic_anand_potdar(self, orchestrator):
        res = orchestrator.process("who is Anand Potdar's manager?")
        assert res.get("intent") == "DETERMINISTIC_SQL"
        assert "Dipakbhai" in res.get("answer", "")

    def test_generic_suneetha(self, orchestrator):
        res = orchestrator.process("who is Suneetha's manager?")
        assert res.get("intent") == "DETERMINISTIC_SQL"
        assert "Vardhan" in res.get("answer", "")
