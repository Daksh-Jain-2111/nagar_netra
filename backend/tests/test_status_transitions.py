import pytest
from fastapi.testclient import TestClient

from backend.app.main import app
from backend.app.seed.seed_data import seed_database
from backend.app.services.auth_service import create_access_token

@pytest.fixture(scope="module")
def client():
    seed_database(force_reseed=False)
    with TestClient(app) as c:
        yield c

@pytest.fixture
def tokens():
    return {
        "citizen": create_access_token({"sub": "usr_9822014589", "role": "citizen", "corp": "SMKMC"}),
        "field_officer": create_access_token({"sub": "usr_fo_roads", "role": "field_officer", "corp": "SMKMC"}),
        "supervisor": create_access_token({"sub": "usr_dmc1", "role": "supervisor", "corp": "SMKMC"}),
    }

def test_legal_status_transition(client, tokens):
    # NN-2026-000113 is ASSIGNED. Field officer transitions to IN_PROGRESS.
    res = client.post(
        "/api/v1/complaints/NN-2026-000113/status",
        headers={"Authorization": f"Bearer {tokens['field_officer']}"},
        json={"status": "IN_PROGRESS", "comment": "Officer reached site and began inspection."}
    )
    assert res.status_code == 200
    assert res.json()["status"] == "IN_PROGRESS"

def test_illegal_status_jump_returns_409(client, tokens):
    # NN-2026-000105 is TO_CHECK. Transitioning directly to RESOLVED or CLOSED is illegal.
    res = client.post(
        "/api/v1/complaints/NN-2026-000105/status",
        headers={"Authorization": f"Bearer {tokens['supervisor']}"},
        json={"status": "RESOLVED", "comment": "Skipping assignment and work"}
    )
    assert res.status_code == 409
    assert "Illegal status transition" in res.json()["detail"]

def test_wrong_role_transition_returns_403(client, tokens):
    # Citizen trying to mark complaint as IN_PROGRESS
    res = client.post(
        "/api/v1/complaints/NN-2026-000101/status",
        headers={"Authorization": f"Bearer {tokens['citizen']}"},
        json={"status": "WORK_SCHEDULED", "comment": "Citizen trying to schedule work"}
    )
    assert res.status_code == 403
    assert "not authorized" in res.json()["detail"]
