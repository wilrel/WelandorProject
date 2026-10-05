from collections import defaultdict
from datetime import timedelta

from fastapi import APIRouter, Depends, Query
from sqlalchemy.orm import Session, selectinload

import models
import schemas
from core.dependencies import get_workspace_member
from core.timeutil import get_zone, local_date, local_range_to_db, today
from database import get_db

router = APIRouter(prefix="/api/workspaces/{workspace_id}", tags=["dashboard"])

@router.get("/dashboard", response_model=schemas.DashboardSummary)
def get_dashboard(
    workspace_id: int,
    days: int = Query(default=30, ge=1, le=365),
    low_stock_threshold: int = Query(default=5, ge=0),
    db: Session = Depends(get_db),
    member: models.WorkspaceMember = Depends(get_workspace_member),
):
    zone = get_zone(member.workspace.timezone)
    end_day = today(zone)
    start_day = end_day - timedelta(days=days - 1)
    lower, upper = local_range_to_db(start_day, end_day, zone)

    transactions = db.query(models.Transaction).options(
        selectinload(models.Transaction.items).joinedload(models.TransactionItem.product)
    ).filter(
        models.Transaction.workspace_id == workspace_id,
        models.Transaction.timestamp >= lower,
        models.Transaction.timestamp < upper,
    ).all()

    # Bucket by the store's local date so "today" matches the cashier's day.
    daily = {start_day + timedelta(days=i): {"revenue": 0.0, "profit": 0.0, "transactions": 0} for i in range(days)}
    product_totals: dict[int, dict] = defaultdict(lambda: {"quantity": 0, "revenue": 0.0})

    for trx in transactions:
        bucket = daily.get(local_date(trx.timestamp, zone))
        if bucket is None:
            continue
        bucket["transactions"] += 1
        for item in trx.items:
            revenue = item.quantity * item.selling_price
            bucket["revenue"] += revenue
            bucket["profit"] += item.quantity * (item.selling_price - item.hpp)
            totals = product_totals[item.product_id]
            totals["quantity"] += item.quantity
            totals["revenue"] += revenue
            if item.product is not None:
                totals["name"] = item.product.name
                totals["sku"] = item.product.sku

    daily_sales = [
        schemas.DailySales(date=day, revenue=round(v["revenue"], 2), profit=round(v["profit"], 2), transactions=v["transactions"])
        for day, v in sorted(daily.items())
    ]
    today_stats = daily[end_day]
    period_revenue = sum(d.revenue for d in daily_sales)
    period_transactions = sum(d.transactions for d in daily_sales)

    top_products = sorted(
        (
            schemas.TopProduct(product_id=pid, name=v.get("name", "-"), sku=v.get("sku", "-"), quantity=v["quantity"], revenue=round(v["revenue"], 2))
            for pid, v in product_totals.items()
        ),
        key=lambda p: p.revenue,
        reverse=True,
    )[:5]

    products = db.query(models.Product).filter(
        models.Product.workspace_id == workspace_id,
        models.Product.is_active.is_(True),
    ).all()
    low_stock = sorted(
        (p for p in products if p.current_stock <= low_stock_threshold),
        key=lambda p: p.current_stock,
    )

    return schemas.DashboardSummary(
        today_revenue=round(today_stats["revenue"], 2),
        today_profit=round(today_stats["profit"], 2),
        today_transactions=today_stats["transactions"],
        period_revenue=round(period_revenue, 2),
        period_profit=round(sum(d.profit for d in daily_sales), 2),
        period_transactions=period_transactions,
        average_basket=round(period_revenue / period_transactions, 2) if period_transactions else 0.0,
        inventory_value=round(sum(max(p.current_stock, 0) * p.current_hpp for p in products), 2),
        active_products=len(products),
        low_stock_threshold=low_stock_threshold,
        low_stock=[
            schemas.LowStockProduct(id=p.id, name=p.name, sku=p.sku, unit=p.unit, current_stock=p.current_stock)
            for p in low_stock[:10]
        ],
        daily_sales=daily_sales,
        top_products=top_products,
    )
