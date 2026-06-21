from pydantic import BaseModel
from datetime import datetime
from typing import List, Optional

class InspeccionNeumaticoCreate(BaseModel):
    posicion: int
    codigo: str
    medida: str
    marca: str
    diseno_original: Optional[str] = None
    diseno_actual: Optional[str] = None
    condicion: str  # 'N', 'R1', 'R2'
    
    # Measurements
    rtd_a: Optional[float] = None
    rtd_b: Optional[float] = None
    rtd_c: Optional[float] = None
    rtd_d: Optional[float] = None
    presion: Optional[float] = None
    temperatura: str = "FRÍO"  # 'FRÍO', 'CALIENTE'
    tapa_valvula_id: Optional[int] = None
    sin_medir: bool = False
    
    # Anomalies
    anomalia_aro_id: Optional[int] = None
    anomalia_neumatico_id: Optional[int] = None
    
    # Photos / Wear
    foto_url: Optional[str] = None

class InspeccionCabeceraCreate(BaseModel):
    numero_vehiculo: str
    fecha: datetime
    km_odometro: int
    neumaticos: List[InspeccionNeumaticoCreate]

class InspeccionNeumaticoResponse(InspeccionNeumaticoCreate):
    id: int
    cabecera_id: int
    
    # Derived / Calculated fields
    rtd_movi: Optional[float] = None
    idi: Optional[float] = None
    estado_rtd: Optional[str] = None
    estado_presion: Optional[str] = None
    desecho: bool
    
    # Projections
    tasa_desgaste_mm_por_1000km: Optional[float] = None
    vur_km: Optional[float] = None
    desecho_prematuro: bool
    creado_en: datetime

    class Config:
        from_attributes = True

class InspeccionCabeceraResponse(BaseModel):
    id: int
    numero_vehiculo: str
    fecha: datetime
    km_odometro: int
    inspector_id: int
    creado_en: datetime
    neumaticos: List[InspeccionNeumaticoResponse]

    class Config:
        from_attributes = True

class SyncRequest(BaseModel):
    inspecciones: List[InspeccionCabeceraCreate]

class SyncResponse(BaseModel):
    count: int
    status: str = "success"
