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

def test_anonymous_complaint_staff_masking(client):
    officer_token = create_access_token({"sub": "usr_fo_elec", "role": "field_officer", "corp": "SMKMC"})
    supervisor_token = create_access_token({"sub": "usr_dmc1", "role": "supervisor", "corp": "SMKMC"})
    admin_token = create_access_token({"sub": "usr_admin", "role": "corp_admin", "corp": "SMKMC"})

    # NN-2026-000103 is anonymous
    for token in [officer_token, supervisor_token, admin_token]:
        res = client.get("/api/v1/complaints/NN-2026-000103", headers={"Authorization": f"Bearer {token}"})
        assert res.status_code == 200
        data = res.json()
        assert data["is_anonymous"] is True
        assert data["citizen_name"] == "Anonymous citizen"
        assert data["citizen_mobile"] is None

def test_public_lookup_has_no_personal_data(client):
    # Public tracking of NN-2026-000101 (which was submitted by Sunita Patil)
    res = client.get("/api/v1/complaints/public/NN-2026-000101")
    assert res.status_code == 200
    data = res.json()
    assert "status" in data
    assert "category_name" in data
    assert "response_due" in data
    assert "citizen_name" not in data
    assert "citizen_mobile" not in data
    assert "citizen_id" not in data

def test_dpdp_account_erasure(client):
    citizen_token = create_access_token({"sub": "usr_9822014589", "role": "citizen", "corp": "SMKMC"})
    res = client.delete("/api/v1/auth/me", headers={"Authorization": f"Bearer {citizen_token}"})
    assert res.status_code == 200
    assert res.json()["success"] is True

    # Profile now reports anonymous
    res_me = client.get("/api/v1/auth/me", headers={"Authorization": f"Bearer {citizen_token}"})
    assert res_me.status_code == 200
    assert res_me.json()["name"] == "Anonymous citizen"
    assert res_me.json()["mobile"] is None
