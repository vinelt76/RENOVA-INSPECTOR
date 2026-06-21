from sqlalchemy import Column, Integer, String, Boolean, Float, ForeignKey, DateTime, UniqueConstraint
from sqlalchemy.orm import relationship
from datetime import datetime
from backend.app.db.session import Base

class Empresa(Base):
    __tablename__ = "empresa"
    __table_args__ = {"schema": "public"}

    id = Column(Integer, primary_key=True, index=True)
    nombre = Column(String, unique=True, nullable=False)
    ruc = Column(String, nullable=True)
    activo = Column(Boolean, default=True)
    creado_en = Column(DateTime, default=datetime.utcnow)

    # Relationships
    usuarios = relationship("Usuario", back_populates="empresa")

class Usuario(Base):
    __tablename__ = "usuario"
    __table_args__ = {"schema": "public"}

    id = Column(Integer, primary_key=True, index=True)
    empresa_id = Column(Integer, ForeignKey("public.empresa.id"), nullable=True)  # Null if system-wide admin
    nombre = Column(String, nullable=False)
    email = Column(String, unique=True, index=True, nullable=False)
    password_hash = Column(String, nullable=False)
    rol = Column(String, default="inspector")  # 'inspector', 'supervisor', 'admin'
    activo = Column(Boolean, default=True)
    creado_en = Column(DateTime, default=datetime.utcnow)

    # Relationships
    empresa = relationship("Empresa", back_populates="usuarios")

class AnomaliaNeumatico(Base):
    __tablename__ = "anomalia_neumatico"
    __table_args__ = {"schema": "public"}

    id = Column(Integer, primary_key=True, index=True)
    nombre = Column(String, unique=True, nullable=False)
    posible_causa = Column(String, nullable=True)
    desecho = Column(Boolean, default=False)

class AnomaliaAro(Base):
    __tablename__ = "anomalia_aro"
    __table_args__ = {"schema": "public"}

    id = Column(Integer, primary_key=True, index=True)
    nombre = Column(String, unique=True, nullable=False)
    posible_causa = Column(String, nullable=True)

class TapaValvula(Base):
    __tablename__ = "tapa_valvula"
    __table_args__ = {"schema": "public"}

    id = Column(Integer, primary_key=True, index=True)
    nombre = Column(String, unique=True, nullable=False)

class DisenoReencauche(Base):
    __tablename__ = "diseno_reencauche"
    __table_args__ = {"schema": "public"}

    id = Column(Integer, primary_key=True, index=True)
    marca = Column(String, nullable=False)
    nombre = Column(String, nullable=False)
    __table_args__ = (
        UniqueConstraint("marca", "nombre", name="uq_diseno_marca_nombre"),
        {"schema": "public"}
    )

class ConfiguracionVehiculo(Base):
    __tablename__ = "configuracion_vehiculo"
    __table_args__ = (
        UniqueConstraint("tipo_vehiculo", "configuracion", "posicion", name="uq_configuracion_posicion"),
        {"schema": "public"}
    )

    id = Column(Integer, primary_key=True, index=True)
    tipo_vehiculo = Column(String, nullable=False)  # 'BUS', 'TRACTO', 'FURGON', etc.
    configuracion = Column(String, nullable=False)  # '2-4-2', '2-2-2', etc.
    posicion = Column(Integer, nullable=False)      # Position number (1..N)
    tipo_eje = Column(String, nullable=False)        # 'Direccional', 'Tracción', 'Libre', etc.
    piso = Column(Boolean, default=True)            # True = ground, False = spare/repuesto

class UmbralRtd(Base):
    __tablename__ = "umbral_rtd"
    __table_args__ = (
        UniqueConstraint("medida", "empresa_id", name="uq_umbral_rtd_medida_empresa"),
        {"schema": "public"}
    )

    id = Column(Integer, primary_key=True, index=True)
    medida = Column(String, nullable=False)
    empresa_id = Column(Integer, ForeignKey("public.empresa.id"), nullable=True)  # Null means default umbral
    rtd_cambio = Column(Float, default=4.0)
    rtd_proximo = Column(Float, default=7.0)
    rtd_normal = Column(Float, default=12.0)

class UmbralPresion(Base):
    __tablename__ = "umbral_presion"
    __table_args__ = (
        UniqueConstraint("medida", "tipo_eje", "empresa_id", name="uq_umbral_presion_medida_eje_empresa"),
        {"schema": "public"}
    )

    id = Column(Integer, primary_key=True, index=True)
    medida = Column(String, nullable=False)
    tipo_eje = Column(String, nullable=False)
    empresa_id = Column(Integer, ForeignKey("public.empresa.id"), nullable=True)  # Null means default umbral
    presion_frio = Column(Float, nullable=False)
    delta_alto_pct = Column(Float, default=0.05)
    delta_bajo_pct = Column(Float, default=0.10)
