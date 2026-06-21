from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import select, func, text
from sqlalchemy.ext.asyncio import AsyncSession
from typing import List, Optional

from backend.app.routers.deps import get_tenant_db, get_current_user
from backend.app.models.tenant import Vehiculo
from backend.app.models.catalog import Usuario
from backend.app.schemas.vehicle import VehiculoCreate, VehiculoResponse

router = APIRouter(prefix="/vehicles", tags=["vehicles"])

@router.get("", response_model=List[VehiculoResponse])
async def list_vehicles(
    query: Optional[str] = None,
    db: AsyncSession = Depends(get_tenant_db)
):
    """
    List all vehicles for the current tenant.
    If a query parameter is provided, performs a fuzzy search ignoring spaces and hyphens.
    """
    stmt = select(Vehiculo)
    if query:
        # Fuzzy match: strip spaces and hyphens from both sides for comparison
        clean_q = query.replace("-", "").replace(" ", "").upper()
        # Using PostgreSQL REPLACE functions dynamically
        stmt = stmt.where(
            func.upper(func.replace(func.replace(Vehiculo.numero, '-', ''), ' ', '')).like(f"%{clean_q}%")
        )
    
    result = await db.execute(stmt.order_by(Vehiculo.numero))
    return result.scalars().all()

@router.get("/{numero}", response_model=VehiculoResponse)
async def get_vehicle(
    numero: str,
    db: AsyncSession = Depends(get_tenant_db)
):
    """
    Get details of a single vehicle by its number.
    """
    result = await db.execute(select(Vehiculo).where(Vehiculo.numero == numero))
    vehicle = result.scalar_one_or_none()
    if not vehicle:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Vehicle '{numero}' not found"
        )
    return vehicle

@router.post("", response_model=VehiculoResponse, status_code=status.HTTP_210_CREATED if not hasattr(status, "HTTP_201_CREATED") else status.HTTP_201_CREATED)
async def create_vehicle(
    vehicle_in: VehiculoCreate,
    db: AsyncSession = Depends(get_tenant_db),
    current_user: Usuario = Depends(get_current_user)
):
    """
    Create a new vehicle for the current tenant.
    """
    # Check if exists
    result = await db.execute(select(Vehiculo).where(Vehiculo.numero == vehicle_in.numero))
    existing = result.scalar_one_or_none()
    if existing:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Vehicle '{vehicle_in.numero}' already exists"
        )
        
    # Standard status is HTTP_201_CREATED, checking attribute fallback just in case
    created_status = getattr(status, "HTTP_201_CREATED", 201)
    
    db_vehicle = Vehiculo(
        numero=vehicle_in.numero,
        tipo_vehiculo=vehicle_in.tipo_vehiculo.upper(),
        configuracion=vehicle_in.configuracion,
        estado="activo" if current_user.rol in ["supervisor", "admin"] else "pendiente",
        creado_por=current_user.id,
        validado_por_supervisor=True if current_user.rol in ["supervisor", "admin"] else False
    )
    
    db.add(db_vehicle)
    await db.commit()
    await db.refresh(db_vehicle)
    return db_vehicle
