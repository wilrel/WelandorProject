import os
import sys
import tempfile

import pytest

_tmpdir = tempfile.mkdtemp()
os.environ["DATABASE_URL"] = f"sqlite:///{os.path.join(_tmpdir, 'test.db')}"
os.environ["TEMP_IMPORT_DIR"] = os.path.join(_tmpdir, "imports")
os.environ.setdefault("SECRET_KEY", "test-secret")
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from fastapi.testclient import TestClient  # noqa: E402

from database import Base, engine  # noqa: E402
from main import app  # noqa: E402


@pytest.fixture()
def client():
    Base.metadata.drop_all(bind=engine)
    Base.metadata.create_all(bind=engine)
    with TestClient(app) as test_client:
        yield test_client


@pytest.fixture()
def owner(client):
    """Sign up a store owner and return (headers, workspace_id)."""
    res = client.post("/api/auth/signup", json={
        "email": "owner@toko.com", "password": "rahasia123", "workspace_name": "Toko Uji",
    })
    assert res.status_code == 201, res.text
    headers = {"Authorization": f"Bearer {res.json()['access_token']}"}
    me = client.get("/api/auth/me", headers=headers).json()
    return headers, me["workspaces"][0]["id"]


def make_product(client, headers, ws, **overrides):
    payload = {
        "sku": "BRS-5KG", "name": "Beras 5kg", "unit": "sak",
        "selling_price": 75000, "current_hpp": 70000, "current_stock": 10,
    }
    payload.update(overrides)
    res = client.post(f"/api/workspaces/{ws}/products", json=payload, headers=headers)
    assert res.status_code == 201, res.text
    return res.json()
