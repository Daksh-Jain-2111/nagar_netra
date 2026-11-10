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

def test_tenant_isolation_complaints_list(client):
    smkmc_admin_token = create_access_token({"sub": "usr_admin", "role": "corp_admin", "corp": "SMKMC"})
    kdmc_admin_token = create_access_token({"sub": "usr_kdmc_admin", "role": "corp_admin", "corp": "KDMC"})

    # SMKMC complaints list
    res_smkmc = client.get("/api/v1/complaints", headers={"Authorization": f"Bearer {smkmc_admin_token}"})
    assert res_smkmc.status_code == 200
    smkmc_complaints = res_smkmc.json()
    for c in smkmc_complaints:
        assert c["corporation_id"] == "SMKMC"
        assert c["id"] != "NN-2026-000201" # KDMC complaint must never appear in SMKMC list

    # KDMC complaints list
    res_kdmc = client.get("/api/v1/complaints", headers={"Authorization": f"Bearer {kdmc_admin_token}"})
    assert res_kdmc.status_code == 200
    kdmc_complaints = res_kdmc.json()
    for c in kdmc_complaints:
        assert c["corporation_id"] == "KDMC"

def test_tenant_isolation_admin_dashboard(client):
    smkmc_token = create_access_token({"sub": "usr_admin", "role": "corp_admin", "corp": "SMKMC"})
    kdmc_token = create_access_token({"sub": "usr_kdmc_admin", "role": "corp_admin", "corp": "KDMC"})

    res_smk = client.get("/api/v1/admin/dashboard", headers={"Authorization": f"Bearer {smkmc_token}"})
    res_kdm = client.get("/api/v1/admin/dashboard", headers={"Authorization": f"Bearer {kdmc_token}"})

    assert res_smk.status_code == 200
    assert res_kdm.status_code == 200
    # The counts must be strictly distinct per tenant
    assert res_smk.json()["kpi"]["total_complaints"] != res_kdm.json()["kpi"]["total_complaints"]
