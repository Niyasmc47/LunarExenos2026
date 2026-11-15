"""
Automated Test Suite for LUNAVISTA Swagger / OpenAPI Documentation.
Verifies /docs, /redoc, /openapi.json, logical tag groupings, and representative endpoint schemas.
"""

from fastapi.testclient import TestClient
from app.main import app

client = TestClient(app)

EXPECTED_TAG_GROUPS = [
    "Health / System",
    "Terrain",
    "Datasets",
    "Regional Analysis",
    "Exports",
    "Horizon",
    "Ephemeris",
    "Visibility",
    "Scenarios",
    "Mission Profiles",
    "Screening",
    "Mission Window Planning",
    "Terrain Assessment",
    "Trade-off Analysis",
    "Decision Reports",
]


def test_openapi_specification_availability_and_schema():
    """Verifies that /openapi.json is accessible and returns valid OpenAPI 3.x schema."""
    resp = client.get("/openapi.json")
    assert resp.status_code == 200
    data = resp.json()

    assert "openapi" in data
    assert data["info"]["title"] == "LUNAVISTA Lunar Mission Architecture & Scientific Analysis API"
    assert data["info"]["version"] == "0.3.0"
    assert len(data["paths"]) > 50

    # Verify that all expected tag groups are documented in the OpenAPI tags metadata
    meta_tag_names = [t["name"] for t in data.get("tags", [])]
    for tag in EXPECTED_TAG_GROUPS:
        assert tag in meta_tag_names, f"Expected tag group '{tag}' missing from OpenAPI metadata"


def test_swagger_ui_html_endpoint():
    """Verifies that /docs returns interactive Swagger UI HTML."""
    resp = client.get("/docs")
    assert resp.status_code == 200
    assert "text/html" in resp.headers["content-type"]
    assert "swagger-ui" in resp.text.lower()


def test_redoc_html_endpoint():
    """Verifies that /redoc returns alternative ReDoc documentation HTML."""
    resp = client.get("/redoc")
    assert resp.status_code == 200
    assert "text/html" in resp.headers["content-type"]
    assert "redoc" in resp.text.lower()


def test_root_redirect_to_swagger():
    """Verifies that visiting the backend root URL redirects directly to /docs."""
    resp = client.get("/", follow_redirects=False)
    assert resp.status_code in (307, 308, 302, 301)
    assert resp.headers.get("location") == "/docs"


def test_all_routes_assigned_to_logical_tags():
    """Verifies that no endpoint is left untagged or assigned to an unrecognized tag."""
    schema = client.get("/openapi.json").json()
    paths = schema.get("paths", {})

    for path, methods in paths.items():
        for method, operation in methods.items():
            if method.lower() in ("get", "post", "put", "delete", "patch"):
                tags = operation.get("tags", [])
                assert len(tags) > 0, f"Route {method.upper()} {path} has no tags assigned!"
                for t in tags:
                    assert t in EXPECTED_TAG_GROUPS, f"Route {method.upper()} {path} has unexpected tag '{t}'"


def test_representative_endpoints_in_openapi():
    """Verifies that representative endpoints from key groups have proper schemas and documentation."""
    schema = client.get("/openapi.json").json()
    paths = schema.get("paths", {})

    # 1. Health check
    assert "/health" in paths
    assert "get" in paths["/health"]
    assert paths["/health"]["get"]["tags"] == ["Health / System"]

    # 2. Terrain elevation
    assert "/api/terrain/elevation" in paths
    assert "get" in paths["/api/terrain/elevation"]
    assert "Terrain" in paths["/api/terrain/elevation"]["get"]["tags"]

    # 3. Horizon analyze
    assert "/api/horizon/analyze" in paths
    assert "post" in paths["/api/horizon/analyze"]
    assert "Horizon" in paths["/api/horizon/analyze"]["post"]["tags"]

    # 4. Ephemeris position
    assert "/api/ephemeris/position" in paths
    assert "post" in paths["/api/ephemeris/position"]
    assert "Ephemeris" in paths["/api/ephemeris/position"]["post"]["tags"]

    # 5. Visibility instant
    assert "/api/visibility/instant" in paths
    assert "post" in paths["/api/visibility/instant"]
    assert "Visibility" in paths["/api/visibility/instant"]["post"]["tags"]

    # 6. Scenarios
    assert "/api/scenarios" in paths
    assert "get" in paths["/api/scenarios"]
    assert "Scenarios" in paths["/api/scenarios"]["get"]["tags"]

    # 7. Screening
    assert "/api/screening/run" in paths
    assert "post" in paths["/api/screening/run"]
    assert "Screening" in paths["/api/screening/run"]["post"]["tags"]

    # 8. Window Planner
    assert "/api/window-planner/search" in paths
    assert "post" in paths["/api/window-planner/search"]
    assert "Mission Window Planning" in paths["/api/window-planner/search"]["post"]["tags"]
