from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload
from typing import List

from backend.app.routers.deps import get_tenant_db, get_current_user
from backend.app.models.tenant import InspeccionCabecera
from backend.app.models.catalog import Usuario
from backend.app.schemas.inspection import (
    InspeccionCabeceraCreate, InspeccionCabeceraResponse,
    SyncRequest, SyncResponse
)
from backend.app.services.inspection_service import process_and_create_inspection

router = APIRouter(prefix="/inspections", tags=["inspections"])

@router.post("", response_model=InspeccionCabeceraResponse, status_code=status.HTTP_210_CREATED if not hasattr(status, "HTTP_201_CREATED") else status.HTTP_201_CREATED)
async def create_inspection(
    inspection_in: InspeccionCabeceraCreate,
    db: AsyncSession = Depends(get_tenant_db),
    current_user: Usuario = Depends(get_current_user)
):
    """
    Create a new inspection (cabecera and neumaticos) for the current tenant.
    Calculates derived metrics (RTD MOVI, IDI, state RTD, state pressure, desecho) dynamically.
    """
    if not current_user.empresa_id:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="System admins cannot create inspections directly. Please use a tenant user."
        )
    try:
        db_inspection = await process_and_create_inspection(
            db, 
            empresa_id=current_user.empresa_id, 
            inspector_id=current_user.id, 
            inspection_in=inspection_in
        )
        return db_inspection
    except ValueError as e:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=str(e)
        )

@router.get("", response_model=List[InspeccionCabeceraResponse])
async def list_inspections(
    db: AsyncSession = Depends(get_tenant_db),
    current_user: Usuario = Depends(get_current_user)
):
    """
    List all inspections for the current tenant.
    """
    result = await db.execute(
        select(InspeccionCabecera)
        .options(selectinload(InspeccionCabecera.neumaticos))
        .order_by(InspeccionCabecera.fecha.desc())
    )
    return result.scalars().all()

@router.get("/{id}", response_model=InspeccionCabeceraResponse)
async def get_inspection(
    id: int,
    db: AsyncSession = Depends(get_tenant_db),
    current_user: Usuario = Depends(get_current_user)
):
    """
    Get a single inspection details by its ID.
    """
    result = await db.execute(
        select(InspeccionCabecera)
        .options(selectinload(InspeccionCabecera.neumaticos))
        .where(InspeccionCabecera.id == id)
    )
    inspection = result.scalar_one_or_none()
    if not inspection:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Inspection ID {id} not found"
        )
    return inspection

@router.post("/sync", response_model=SyncResponse)
async def sync_offline_inspections(
    sync_in: SyncRequest,
    db: AsyncSession = Depends(get_tenant_db),
    current_user: Usuario = Depends(get_current_user)
):
    """
    Bulk synchronize a batch of inspections captured while offline.
    Ignores duplicates (checks if cabecera with same vehicle, date, and km exists)
    and processes calculations for each.
    """
    if not current_user.empresa_id:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="System admins cannot sync inspections directly. Please use a tenant user."
        )
        
    succeeded = 0
    for insp_in in sync_in.inspecciones:
        # Check if this exact inspection already exists (de-duplication)
        existing_stmt = select(InspeccionCabecera).where(
            InspeccionCabecera.numero_vehiculo == insp_in.numero_vehiculo,
            InspeccionCabecera.fecha == insp_in.fecha,
            InspeccionCabecera.km_odometro == insp_in.km_odometro
        )
        existing_result = await db.execute(existing_stmt)
        if existing_result.scalar_one_or_none() is not None:
            # Skip duplicate silently
            succeeded += 1
            continue
            
        try:
            # We process inside a nested transaction savepoint to isolate failures
            async with db.begin_nested():
                await process_and_create_inspection(
                    db,
                    empresa_id=current_user.empresa_id,
                    inspector_id=current_user.id,
                    inspection_in=insp_in
                )
            succeeded += 1
        except Exception as e:
            # Log individual record error, but don't crash the whole sync batch
            # We can log this in standard output or a logger
            print(f"Failed to sync inspection for vehicle {insp_in.numero_vehiculo}: {str(e)}")
            continue
            
    await db.commit()
    return {"count": succeeded, "status": "success"}
