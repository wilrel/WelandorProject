import logging

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from core.config import settings
from routers import auth, dashboard, workspaces, products, transactions, imports, purchases, inventory

logging.basicConfig(level=logging.INFO)

app = FastAPI(
    title="TokoBerkah BI API",
    description="API Platform Business Intelligence untuk Toko Retail / Sembako",
    version="1.1.0",
)

# Configure CORS for frontend access
app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.CORS_ORIGINS,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(auth.router)
app.include_router(workspaces.router)
app.include_router(dashboard.router)
app.include_router(products.router)
app.include_router(transactions.router)
app.include_router(imports.router)
app.include_router(purchases.router)
app.include_router(inventory.router)

@app.get("/", tags=["health"])
def read_root():
    return {"message": "TokoBerkah BI API", "docs": "/docs"}

@app.get("/health", tags=["health"])
def health():
    return {"status": "ok"}
