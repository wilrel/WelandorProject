from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from routers import auth, workspaces, products, transactions, imports, purchases, inventory

app = FastAPI(
    title="Platform BI Retail",
    description="API for Platform Business Intelligence Toko Retail / Sembako",
    version="1.0.0"
)

# Configure CORS for frontend access
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:3000"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(auth.router)
app.include_router(workspaces.router)
app.include_router(products.router)
app.include_router(transactions.router)
app.include_router(imports.router)
app.include_router(purchases.router)
app.include_router(inventory.router)

@app.get("/")
def read_root():
    return {"message": "Welcome to Platform BI Retail API"}
