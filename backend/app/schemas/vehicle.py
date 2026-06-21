from pydantic import BaseModel
from datetime import datetime
from typing import Optional

class VehiculoCreate(BaseModel):
    numero: str
    tipo_vehiculo: str
    configuracion: str

class VehiculoResponse(BaseModel):
    numero: str
    tipo_vehiculo: str
    configuracion: str
    estado: str
    creado_por: Optional[int] = None
    validado_por_supervisor: bool
    creado_en: datetime

    class Config:
        from_attributes = True
