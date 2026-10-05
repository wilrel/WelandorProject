from tests.conftest import make_product


def test_register_and_login(client):
    res = client.post("/api/auth/register", json={"email": "Kasir@Toko.com", "password": "rahasia123"})
    assert res.status_code == 201
    assert res.json()["email"] == "kasir@toko.com"

    res = client.post("/api/auth/login", data={"username": "kasir@toko.com", "password": "rahasia123"})
    assert res.status_code == 200
    assert res.json()["access_token"]

    res = client.post("/api/auth/login", data={"username": "kasir@toko.com", "password": "salah"})
    assert res.status_code == 401


def test_requires_membership(client, owner):
    headers, ws = owner
    client.post("/api/auth/register", json={"email": "lain@toko.com", "password": "rahasia123"})
    token = client.post("/api/auth/login", data={"username": "lain@toko.com", "password": "rahasia123"}).json()["access_token"]
    other = {"Authorization": f"Bearer {token}"}
    assert client.get(f"/api/workspaces/{ws}/products", headers=other).status_code == 403
    assert client.get(f"/api/workspaces/{ws}/imports", headers=other).status_code == 403
    assert client.get(f"/api/workspaces/{ws}/products").status_code == 401


def test_product_crud(client, owner):
    headers, ws = owner
    product = make_product(client, headers, ws)

    dup = client.post(f"/api/workspaces/{ws}/products", json={
        "sku": "BRS-5KG", "name": "X", "unit": "pcs", "selling_price": 1, "current_hpp": 1,
    }, headers=headers)
    assert dup.status_code == 400

    res = client.put(f"/api/workspaces/{ws}/products/{product['id']}", json={
        "sku": "BRS-5KG", "name": "Beras Premium 5kg", "unit": "sak", "selling_price": 80000, "current_hpp": 70000,
    }, headers=headers)
    assert res.status_code == 200
    assert res.json()["name"] == "Beras Premium 5kg"
    assert res.json()["current_stock"] == 10  # stock is not editable through update

    assert client.delete(f"/api/workspaces/{ws}/products/{product['id']}", headers=headers).status_code == 204
    assert client.get(f"/api/workspaces/{ws}/products", headers=headers).json() == []
    assert len(client.get(f"/api/workspaces/{ws}/products?include_inactive=true", headers=headers).json()) == 1


def test_transaction_updates_stock_and_dashboard(client, owner):
    headers, ws = owner
    product = make_product(client, headers, ws)

    res = client.post(f"/api/workspaces/{ws}/transactions", json={
        "payment_method": "qris",
        "items": [{"product_id": product["id"], "quantity": 2}, {"product_id": product["id"], "quantity": 1}],
    }, headers=headers)
    assert res.status_code == 201, res.text
    body = res.json()
    assert body["total_amount"] == 225000
    assert body["payment_method"] == "QRIS"
    assert body["items"][0]["quantity"] == 3
    assert body["items"][0]["product_name"] == "Beras 5kg"

    stock = client.get(f"/api/workspaces/{ws}/products/{product['id']}", headers=headers).json()["current_stock"]
    assert stock == 7

    # Overselling (including via repeated lines) is rejected and leaves stock untouched.
    res = client.post(f"/api/workspaces/{ws}/transactions", json={
        "items": [{"product_id": product["id"], "quantity": 5}, {"product_id": product["id"], "quantity": 5}],
    }, headers=headers)
    assert res.status_code == 400
    assert client.get(f"/api/workspaces/{ws}/products/{product['id']}", headers=headers).json()["current_stock"] == 7

    assert client.post(f"/api/workspaces/{ws}/transactions", json={"items": []}, headers=headers).status_code == 422
    assert client.post(f"/api/workspaces/{ws}/transactions", json={
        "items": [{"product_id": product["id"], "quantity": 0}],
    }, headers=headers).status_code == 422

    dash = client.get(f"/api/workspaces/{ws}/dashboard", headers=headers).json()
    assert dash["today_revenue"] == 225000
    assert dash["today_profit"] == 15000
    assert dash["today_transactions"] == 1
    assert dash["inventory_value"] == 7 * 70000
    assert dash["top_products"][0]["quantity"] == 3
    assert len(dash["daily_sales"]) == 30

    today = dash["daily_sales"][-1]["date"]
    listed = client.get(f"/api/workspaces/{ws}/transactions?start_date={today}&end_date={today}", headers=headers).json()
    assert len(listed) == 1


def test_purchase_moving_average_hpp(client, owner):
    headers, ws = owner
    product = make_product(client, headers, ws, current_stock=10, current_hpp=10000)
    res = client.post(f"/api/workspaces/{ws}/purchases", json={
        "supplier_name": "PT Sumber", "items": [{"product_id": product["id"], "quantity": 10, "unit_cost": 12000}],
    }, headers=headers)
    assert res.status_code == 201, res.text
    updated = client.get(f"/api/workspaces/{ws}/products/{product['id']}", headers=headers).json()
    assert updated["current_stock"] == 20
    assert updated["current_hpp"] == 11000


def test_inventory_adjust_and_movements(client, owner):
    headers, ws = owner
    product = make_product(client, headers, ws)
    res = client.post(f"/api/workspaces/{ws}/inventory/adjust?product_id={product['id']}", json={
        "actual_stock": 8, "reason": "Rusak",
    }, headers=headers)
    assert res.status_code == 200
    assert res.json()["new_stock"] == 8

    assert client.post(f"/api/workspaces/{ws}/inventory/adjust?product_id={product['id']}", json={
        "actual_stock": -1,
    }, headers=headers).status_code == 422

    movements = client.get(f"/api/workspaces/{ws}/inventory/movements", headers=headers).json()
    assert [m["type"] for m in movements] == ["ADJUSTMENT", "OPENING"]
    assert movements[0]["quantity"] == -2
    assert movements[0]["product_sku"] == "BRS-5KG"


def test_import_flow(client, owner):
    headers, ws = owner
    make_product(client, headers, ws, sku="BRS-5KG", current_stock=3)
    make_product(client, headers, ws, sku="00123", name="Kopi", unit="pcs", selling_price=2000, current_hpp=1500, current_stock=50)

    csv = (
        "Date,Item Code,Qty Sold,Sale Price\n"
        "2026-08-10,BRS-5KG,2,75000\n"
        "2026-08-10,00123,5,2000\n"
        "2026-08-10,UNKNOWN,1,5000\n"
        "2026-08-10,BRS-5KG,-1,75000\n"
        "bukan-tanggal,00123,1,2000\n"
        "2026-08-11,BRS-5KG,2,75000\n"
    )
    res = client.post(
        f"/api/workspaces/{ws}/imports/upload",
        files={"file": ("../../evil.csv", csv.encode(), "text/csv")},
        headers=headers,
    )
    assert res.status_code == 200, res.text
    job_id = res.json()["job_id"]
    assert res.json()["filename"] == "evil.csv"
    assert res.json()["columns"] == ["Date", "Item Code", "Qty Sold", "Sale Price"]

    mapping = {"date_col": "Date", "sku_col": "Item Code", "quantity_col": "Qty Sold", "price_col": "Sale Price"}
    res = client.post(f"/api/workspaces/{ws}/imports/{job_id}/validate", json=mapping, headers=headers)
    assert res.status_code == 200, res.text
    job = res.json()
    assert job["total_rows"] == 6
    assert job["error_rows"] == 4  # unknown SKU, negative qty, bad date, insufficient stock
    assert job["status"] == "CONFIRMED"

    res = client.post(f"/api/workspaces/{ws}/imports/{job_id}/confirm", json=mapping, headers=headers)
    assert res.status_code == 200, res.text
    assert res.json()["imported_rows"] == 2

    products = {p["sku"]: p for p in client.get(f"/api/workspaces/{ws}/products", headers=headers).json()}
    assert products["BRS-5KG"]["current_stock"] == 1
    assert products["00123"]["current_stock"] == 45

    imports = client.get(f"/api/workspaces/{ws}/imports", headers=headers).json()
    assert imports[0]["status"] == "COMPLETED"
    assert client.post(f"/api/workspaces/{ws}/imports/{job_id}/confirm", json=mapping, headers=headers).status_code == 400


def test_workspace_update(client, owner):
    headers, ws = owner
    res = client.put(f"/api/workspaces/{ws}", json={"name": "Toko Baru", "address": "Jl. Mawar", "phone": "08123"}, headers=headers)
    assert res.status_code == 200
    assert res.json()["name"] == "Toko Baru"
