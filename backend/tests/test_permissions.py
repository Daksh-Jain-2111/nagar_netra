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
        "corp_admin": create_access_token({"sub": "usr_admin", "role": "corp_admin", "corp": "SMKMC"}),
        "helpdesk": create_access_token({"sub": "usr_helpdesk", "role": "helpdesk", "corp": "SMKMC"}),
        "platform_admin": create_access_token({"sub": "usr_platform", "role": "platform_admin", "corp": "SMKMC"}),
    }

def test_admin_dashboard_permissions(client, tokens):
    # Only corp_admin and platform_admin can access /api/v1/admin/dashboard
    res_citizen = client.get("/api/v1/admin/dashboard", headers={"Authorization": f"Bearer {tokens['citizen']}"})
    assert res_citizen.status_code == 403

    res_officer = client.get("/api/v1/admin/dashboard", headers={"Authorization": f"Bearer {tokens['field_officer']}"})
    assert res_officer.status_code == 403

    res_admin = client.get("/api/v1/admin/dashboard", headers={"Authorization": f"Bearer {tokens['corp_admin']}"})
    assert res_admin.status_code == 200
    assert "kpi" in res_admin.json()

def test_supervisor_queues_permissions(client, tokens):
    # Field officer cannot access supervisor queues
    res_officer = client.get("/api/v1/supervisor/to-check", headers={"Authorization": f"Bearer {tokens['field_officer']}"})
    assert res_officer.status_code == 403

    # Supervisor can access
    res_sup = client.get("/api/v1/supervisor/to-check", headers={"Authorization": f"Bearer {tokens['supervisor']}"})
    assert res_sup.status_code == 200

def test_admin_invite_user_restrictions(client, tokens):
    # Corp admin inviting field_officer directly must return 403
    res = client.post(
        "/api/v1/admin/users/invite",
        headers={"Authorization": f"Bearer {tokens['corp_admin']}"},
        json={
            "name": "New Officer",
            "email": "new.officer@smkmc.demo",
            "role": "field_officer",
            "unit_id": "unit_roads"
        }
    )
    assert res.status_code == 403

    # Corp admin inviting supervisor is allowed
    res_sup = client.post(
        "/api/v1/admin/users/invite",
        headers={"Authorization": f"Bearer {tokens['corp_admin']}"},
        json={
            "name": "Second Supervisor",
            "email": "supervisor2@smkmc.demo",
            "role": "supervisor",
            "unit_id": "unit_roads"
        }
    )
    assert res_sup.status_code == 200

def test_platform_admin_endpoints(client, tokens):
    # Only platform_admin can access /api/v1/platform/corporations
    res_admin = client.get("/api/v1/platform/corporations", headers={"Authorization": f"Bearer {tokens['corp_admin']}"})
    assert res_admin.status_code == 403

    res_platform = client.get("/api/v1/platform/corporations", headers={"Authorization": f"Bearer {tokens['platform_admin']}"})
    assert res_platform.status_code == 200
    assert len(res_platform.json()) >= 1
