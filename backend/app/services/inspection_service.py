from sqlalchemy import select, or_
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload
from typing import List

from backend.app.models.catalog import UmbralRtd, UmbralPresion, AnomaliaNeumatico, ConfiguracionVehiculo
from backend.app.models.tenant import Vehiculo, InspeccionCabecera, InspeccionNeumatico
from backend.app.schemas.inspection import InspeccionCabeceraCreate
from backend.app.core.calculations import calcular_rtd_movi, calcular_idi, calcular_estado_rtd, calcular_estado_presion

async def process_and_create_inspection(
    db: AsyncSession, 
    empresa_id: int, 
    inspector_id: int, 
    inspection_in: InspeccionCabeceraCreate
) -> InspeccionCabecera:
    # 1. Fetch vehicle info
    result = await db.execute(select(Vehiculo).where(Vehiculo.numero == inspection_in.numero_vehiculo))
    vehicle = result.scalar_one_or_none()
    if not vehicle:
        raise ValueError(f"Vehicle '{inspection_in.numero_vehiculo}' does not exist.")
        
    # Create the cabecera record
    db_cabecera = InspeccionCabecera(
        numero_vehiculo=inspection_in.numero_vehiculo,
        fecha=inspection_in.fecha,
        km_odometro=inspection_in.km_odometro,
        inspector_id=inspector_id
    )
    db.add(db_cabecera)
    await db.flush() # get cabecera id
    
    # 2. Fetch all configuration positions for this vehicle configuration to map positions to axes
    config_result = await db.execute(
        select(ConfiguracionVehiculo).where(
            ConfiguracionVehiculo.tipo_vehiculo == vehicle.tipo_vehiculo,
            ConfiguracionVehiculo.configuracion == vehicle.configuracion
        )
    )
    configs = {c.posicion: c.tipo_eje for c in config_result.scalars().all()}
    
    # 3. Process each tire
    for t_in in inspection_in.neumaticos:
        rtd_movi = calcular_rtd_movi(t_in.rtd_a, t_in.rtd_b, t_in.rtd_c, t_in.rtd_d)
        idi = calcular_idi(t_in.rtd_a, t_in.rtd_b, t_in.rtd_c, t_in.rtd_d)
        
        # Determine tipo_eje for the position
        tipo_eje = configs.get(t_in.posicion, "Libre")
        
        # Look up RTD threshold
        rtd_stmt = select(UmbralRtd).where(
            UmbralRtd.medida == t_in.medida,
            or_(UmbralRtd.empresa_id == empresa_id, UmbralRtd.empresa_id == None)
        )
        rtd_thresh_result = await db.execute(rtd_stmt)
        rtd_thresholds = rtd_thresh_result.scalars().all()
        # Find company specific, otherwise default
        rtd_thresh = next((t for t in rtd_thresholds if t.empresa_id == empresa_id), None)
        if not rtd_thresh:
            rtd_thresh = next((t for t in rtd_thresholds if t.empresa_id is None), None)
            
        rtd_cambio = rtd_thresh.rtd_cambio if rtd_thresh else 4.0
        rtd_proximo = rtd_thresh.rtd_proximo if rtd_thresh else 7.0
        estado_rtd = calcular_estado_rtd(rtd_movi, rtd_cambio, rtd_proximo)
        
        # Look up Pressure threshold
        pres_stmt = select(UmbralPresion).where(
            UmbralPresion.medida == t_in.medida,
            UmbralPresion.tipo_eje == tipo_eje,
            or_(UmbralPresion.empresa_id == empresa_id, UmbralPresion.empresa_id == None)
        )
        pres_thresh_result = await db.execute(pres_stmt)
        pres_thresholds = pres_thresh_result.scalars().all()
        pres_thresh = next((t for t in pres_thresholds if t.empresa_id == empresa_id), None)
        if not pres_thresh:
            pres_thresh = next((t for t in pres_thresholds if t.empresa_id is None), None)
            
        if pres_thresh:
            ref = pres_thresh.presion_frio
            delta_alto = pres_thresh.delta_alto_pct
            delta_bajo = pres_thresh.delta_bajo_pct
        else:
            ref = 110.0
            delta_alto = 0.05
            delta_bajo = 0.10
            
        estado_presion = calcular_estado_presion(
            t_in.presion, t_in.temperatura, ref, delta_alto, delta_bajo
        )
        
        # Check desecho in catalog anomaly
        desecho = False
        if t_in.anomalia_neumatico_id:
            anom_result = await db.execute(
                select(AnomaliaNeumatico).where(AnomaliaNeumatico.id == t_in.anomalia_neumatico_id)
            )
            anom = anom_result.scalar_one_or_none()
            if anom and anom.desecho:
                desecho = True
                
        db_neumatico = InspeccionNeumatico(
            cabecera_id=db_cabecera.id,
            posicion=t_in.posicion,
            codigo=t_in.codigo,
            medida=t_in.medida,
            marca=t_in.marca,
            diseno_original=t_in.diseno_original,
            diseno_actual=t_in.diseno_actual,
            condicion=t_in.condicion,
            rtd_a=t_in.rtd_a,
            rtd_b=t_in.rtd_b,
            rtd_c=t_in.rtd_c,
            rtd_d=t_in.rtd_d,
            presion=t_in.presion,
            temperatura=t_in.temperatura,
            tapa_valvula_id=t_in.tapa_valvula_id,
            sin_medir=t_in.sin_medir,
            anomalia_aro_id=t_in.anomalia_aro_id,
            anomalia_neumatico_id=t_in.anomalia_neumatico_id,
            rtd_movi=rtd_movi,
            idi=idi,
            estado_rtd=estado_rtd,
            estado_presion=estado_presion,
            desecho=desecho,
            foto_url=t_in.foto_url
        )
        db.add(db_neumatico)
        
    await db.commit()
    
    # Reload cabecera with eager loaded tires
    result = await db.execute(
        select(InspeccionCabecera)
        .options(selectinload(InspeccionCabecera.neumaticos))
        .where(InspeccionCabecera.id == db_cabecera.id)
    )
    return result.scalar_one()
