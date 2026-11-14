import os
import shutil
import tempfile
from pathlib import Path
import pytest

from app.services.scenario_service import scenario_service
from app.services.mission_profile_service import mission_profile_service
from app.services.screening_service import screening_service
from app.services.window_planner_service import window_planner_service
from app.services.terrain_assessment_service import terrain_assessment_service
from app.services.trade_off_service import trade_off_service
from app.services.decision_report_service import decision_report_service


@pytest.fixture(scope="session", autouse=True)
def isolate_test_persistence():
    """
    Autouse fixture that isolates all test persistence writes to a temporary directory.
    This prevents pytest runs from mutating, polluting, or corrupting production data files.
    """
    prod_data_dir = Path(__file__).resolve().parent.parent / "data"
    temp_dir = tempfile.mkdtemp(prefix="lunavista_test_data_")
    temp_path = Path(temp_dir)

    # Copy baseline data files into temp dir
    for json_file in prod_data_dir.glob("*.json"):
        shutil.copy2(json_file, temp_path / json_file.name)

    # Store original paths
    services_and_files = [
        (scenario_service, "mission_scenarios.json"),
        (mission_profile_service, "mission_profiles.json"),
        (screening_service, "screening_runs.json"),
        (window_planner_service, "mission_window_searches.json"),
        (terrain_assessment_service, "terrain_assessments.json"),
        (trade_off_service, "trade_off_studies.json"),
        (decision_report_service, "mission_decision_reports.json"),
    ]

    original_paths = {}
    for svc, filename in services_and_files:
        original_paths[svc] = svc.storage_file
        svc.storage_file = temp_path / filename
        svc._load_from_storage()

    try:
        yield temp_path
    finally:
        # Restore production paths and reload pristine data
        for svc, _ in services_and_files:
            svc.storage_file = original_paths[svc]
            svc._load_from_storage()

        # Clean up temporary directory
        shutil.rmtree(temp_dir, ignore_errors=True)
