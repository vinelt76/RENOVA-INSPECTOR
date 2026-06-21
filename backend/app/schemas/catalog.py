from pydantic import BaseModel
from typing import Optional

class EmpresaSchema(BaseModel):
    id: int
    nombre: str
    ruc: Optional[str] = None

    class Config:
        from_attributes = True

class AnomaliaNeumaticoSchema(BaseModel):
    id: int
    nombre: str
    posible_causa: Optional[str] = None
    desecho: bool

    class Config:
        from_attributes = True

class AnomaliaAroSchema(BaseModel):
    id: int
    nombre: str
    posible_causa: Optional[str] = None

    class Config:
        from_attributes = True

class TapaValvulaSchema(BaseModel):
    id: int
    nombre: str

    class Config:
        from_attributes = True

class DisenoReencaucheSchema(BaseModel):
    id: int
    marca: str
    nombre: str

    class Config:
        from_attributes = True

class ConfiguracionVehiculoSchema(BaseModel):
    id: int
    tipo_vehiculo: str
    configuracion: str
    posicion: int
    tipo_eje: str
    piso: bool

    class Config:
        from_attributes = True

class UmbralRtdSchema(BaseModel):
    id: int
    medida: str
    empresa_id: Optional[int] = None
    rtd_cambio: float
    rtd_proximo: float
    rtd_normal: float

    class Config:
        from_attributes = True

class UmbralPresionSchema(BaseModel):
    id: int
    medida: str
    tipo_eje: str
    empresa_id: Optional[int] = None
    presion_frio: float
    delta_alto_pct: float
    delta_bajo_pct: float

    class Config:
        from_attributes = True
