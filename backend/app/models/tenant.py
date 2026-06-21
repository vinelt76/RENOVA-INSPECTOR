from sqlalchemy import Column, Integer, String, Boolean, Float, ForeignKey, DateTime
from sqlalchemy.orm import relationship
from datetime import datetime
from backend.app.db.session import Base

class Vehiculo(Base):
    __tablename__ = "vehiculo"

    numero = Column(String, primary_key=True, index=True)
    tipo_vehiculo = Column(String, nullable=False)        # 'BUS', 'TRACTO', 'FURGON', etc.
    configuracion = Column(String, nullable=False)        # '2-4-2', '2-2-2', etc.
    estado = Column(String, default="activo")             # 'activo', 'pendiente', 'inactivo'
    creado_por = Column(Integer, ForeignKey("public.usuario.id"), nullable=True)
    validado_por_supervisor = Column(Boolean, default=False)
    creado_en = Column(DateTime, default=datetime.utcnow)

    # Relationships
    inspecciones = relationship("InspeccionCabecera", back_populates="vehiculo")

class InspeccionCabecera(Base):
    __tablename__ = "inspeccion_cabecera"

    id = Column(Integer, primary_key=True, index=True)  # CONTA INSPECCIÓN
    numero_vehiculo = Column(String, ForeignKey("vehiculo.numero"), nullable=False)
    fecha = Column(DateTime, nullable=False, default=datetime.utcnow)
    km_odometro = Column(Integer, nullable=False)
    inspector_id = Column(Integer, ForeignKey("public.usuario.id"), nullable=False)
    creado_en = Column(DateTime, default=datetime.utcnow)

    # Relationships
    vehiculo = relationship("Vehiculo", back_populates="inspecciones")
    neumaticos = relationship("InspeccionNeumatico", back_populates="cabecera", cascade="all, delete-orphan")

class InspeccionNeumatico(Base):
    __tablename__ = "inspeccion_neumatico"

    id = Column(Integer, primary_key=True, index=True)
    cabecera_id = Column(Integer, ForeignKey("inspeccion_cabecera.id"), nullable=False)
    posicion = Column(Integer, nullable=False)            # Position (1..N)
    
    # Tire specs
    codigo = Column(String, nullable=False)               # Serial number
    medida = Column(String, nullable=False)
    marca = Column(String, nullable=False)
    diseno_original = Column(String, nullable=True)
    diseno_actual = Column(String, nullable=True)
    condicion = Column(String, nullable=False)            # 'N', 'R1', 'R2'
    
    # Measurements
    rtd_a = Column(Float, nullable=True)
    rtd_b = Column(Float, nullable=True)
    rtd_c = Column(Float, nullable=True)
    rtd_d = Column(Float, nullable=True)
    presion = Column(Float, nullable=True)
    temperatura = Column(String, default="FRÍO")          # 'FRÍO', 'CALIENTE'
    tapa_valvula_id = Column(Integer, ForeignKey("public.tapa_valvula.id"), nullable=True)
    sin_medir = Column(Boolean, default=False)
    
    # Anomalies
    anomalia_aro_id = Column(Integer, ForeignKey("public.anomalia_aro.id"), nullable=True)
    anomalia_neumatico_id = Column(Integer, ForeignKey("public.anomalia_neumatico.id"), nullable=True)
    
    # Derived / Calculated fields
    rtd_movi = Column(Float, nullable=True)
    idi = Column(Float, nullable=True)
    estado_rtd = Column(String, nullable=True)            # 'Normal', 'Próximo a Reencauche', 'Para Reencauche'
    estado_presion = Column(String, nullable=True)        # 'Normal', 'Alta Presión', 'Baja Presión', 'Sin Medir'
    desecho = Column(Boolean, default=False)
    
    # Wear & projection fields (Sprint 5)
    tasa_desgaste_mm_por_1000km = Column(Float, nullable=True)
    vur_km = Column(Float, nullable=True)
    desecho_prematuro = Column(Boolean, default=False)
    
    # Photos (Sprint 2)
    foto_url = Column(String, nullable=True)
    creado_en = Column(DateTime, default=datetime.utcnow)

    # Relationships
    cabecera = relationship("InspeccionCabecera", back_populates="neumaticos")
