from fastapi import APIRouter, Depends
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from typing import List

from backend.app.db.session import get_db
from backend.app.routers.deps import get_current_user
from backend.app.models.catalog import (
    Empresa, AnomaliaNeumatico, AnomaliaAro,
    TapaValvula, DisenoReencauche, ConfiguracionVehiculo,
    UmbralRtd, UmbralPresion, Usuario
)
from backend.app.schemas.catalog import (
    EmpresaSchema, AnomaliaNeumaticoSchema, AnomaliaAroSchema,
    TapaValvulaSchema, DisenoReencaucheSchema, ConfiguracionVehiculoSchema,
    UmbralRtdSchema, UmbralPresionSchema
)

router = APIRouter(prefix="/catalog", tags=["catalog"])

@router.get("/empresas", response_model=List[EmpresaSchema])
async def get_empresas(db: AsyncSession = Depends(get_db)):
    """
    List all active companies (available without auth for splash selection).
    """
    result = await db.execute(select(Empresa).where(Empresa.activo == True).order_by(Empresa.nombre))
    return result.scalars().all()

@router.get("/anomalias-neumatico", response_model=List[AnomaliaNeumaticoSchema])
async def get_anomalias_neumatico(
    db: AsyncSession = Depends(get_db),
    current_user: Usuario = Depends(get_current_user)
):
    """
    List all tire anomalies.
    """
    result = await db.execute(select(AnomaliaNeumatico).order_by(AnomaliaNeumatico.nombre))
    return result.scalars().all()

@router.get("/anomalias-aro", response_model=List[AnomaliaAroSchema])
async def get_anomalias_aro(
    db: AsyncSession = Depends(get_db),
    current_user: Usuario = Depends(get_current_user)
):
    """
    List all wheel/aro anomalies.
    """
    result = await db.execute(select(AnomaliaAro).order_by(AnomaliaAro.nombre))
    return result.scalars().all()

@router.get("/tapas-valvula", response_model=List[TapaValvulaSchema])
async def get_tapas_valvula(
    db: AsyncSession = Depends(get_db),
    current_user: Usuario = Depends(get_current_user)
):
    """
    List all valve cap types.
    """
    result = await db.execute(select(TapaValvula).order_by(TapaValvula.nombre))
    return result.scalars().all()

@router.get("/disenos-reencauche", response_model=List[DisenoReencaucheSchema])
async def get_disenos_reencauche(
    db: AsyncSession = Depends(get_db),
    current_user: Usuario = Depends(get_current_user)
):
    """
    List all tread/reencauche designs.
    """
    result = await db.execute(select(DisenoReencauche).order_by(DisenoReencauche.marca, DisenoReencauche.nombre))
    return result.scalars().all()

@router.get("/configuraciones-vehiculo", response_model=List[ConfiguracionVehiculoSchema])
async def get_configuraciones_vehiculo(
    db: AsyncSession = Depends(get_db),
    current_user: Usuario = Depends(get_current_user)
):
    """
    List all vehicle configuration diagrams.
    """
    result = await db.execute(
        select(ConfiguracionVehiculo).order_by(
            ConfiguracionVehiculo.tipo_vehiculo, 
            ConfiguracionVehiculo.configuracion, 
            ConfiguracionVehiculo.posicion
        )
    )
    return result.scalars().all()

@router.get("/umbrales-rtd", response_model=List[UmbralRtdSchema])
async def get_umbrales_rtd(
    db: AsyncSession = Depends(get_db),
    current_user: Usuario = Depends(get_current_user)
):
    """
    List RTD thresholds. If user belongs to a company, lists only company thresholds + default thresholds.
    """
    if current_user.empresa_id:
        result = await db.execute(
            select(UmbralRtd).where(
                (UmbralRtd.empresa_id == current_user.empresa_id) | (UmbralRtd.empresa_id == None)
            ).order_by(UmbralRtd.medida)
        )
    else:
        result = await db.execute(select(UmbralRtd).order_by(UmbralRtd.medida))
    return result.scalars().all()

@router.get("/umbrales-presion", response_model=List[UmbralPresionSchema])
async def get_umbrales_presion(
    db: AsyncSession = Depends(get_db),
    current_user: Usuario = Depends(get_current_user)
):
    """
    List pressure thresholds. If user belongs to a company, lists only company thresholds + default thresholds.
    """
    if current_user.empresa_id:
        result = await db.execute(
            select(UmbralPresion).where(
                (UmbralPresion.empresa_id == current_user.empresa_id) | (UmbralPresion.empresa_id == None)
            ).order_by(UmbralPresion.medida, UmbralPresion.tipo_eje)
        )
    else:
        result = await db.execute(select(UmbralPresion).order_by(UmbralPresion.medida, UmbralPresion.tipo_eje))
    return result.scalars().all()
