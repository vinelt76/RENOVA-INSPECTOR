from sqlalchemy import text
from sqlalchemy.ext.asyncio import AsyncConnection
from backend.app.db.session import Base
# Make sure models are registered to Base.metadata
from backend.app.models.catalog import (
    Empresa, Usuario, AnomaliaNeumatico, AnomaliaAro,
    TapaValvula, DisenoReencauche, ConfiguracionVehiculo,
    UmbralRtd, UmbralPresion
)
from backend.app.models.tenant import Vehiculo, InspeccionCabecera, InspeccionNeumatico

async def init_public_db(conn: AsyncConnection):
    """
    Initializes the public schema tables.
    """
    await conn.execute(text("CREATE SCHEMA IF NOT EXISTS public;"))
    # Filter only tables belonging to public schema
    public_tables = [
        table for name, table in Base.metadata.tables.items()
        if name.startswith("public.")
    ]
    # Create the public tables
    await conn.run_sync(Base.metadata.create_all, tables=public_tables)

async def init_tenant_db(conn: AsyncConnection, empresa_id: int):
    """
    Initializes the schema and tables for a specific tenant.
    """
    schema_name = f"empresa_{empresa_id}"
    await conn.execute(text(f"CREATE SCHEMA IF NOT EXISTS {schema_name};"))
    await conn.execute(text(f"SET search_path TO {schema_name}, public;"))
    
    # Filter tables that are NOT part of public schema
    tenant_tables = [
        table for name, table in Base.metadata.tables.items()
        if not name.startswith("public.")
    ]
    # Create the tenant tables in the tenant schema
    await conn.run_sync(Base.metadata.create_all, tables=tenant_tables)
