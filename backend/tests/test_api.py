import pytest
from fastapi.testclient import TestClient
from sqlalchemy import select
from datetime import datetime, timezone

from backend.app.main import app
from backend.app.core.config import settings

client = TestClient(app)

def test_root_endpoint():
    response = client.get("/")
    assert response.status_code == 200
    assert response.json()["message"] == "Welcome to RENOVA INSPECTOR API"

def test_login_and_me():
    # Test invalid login
    response = client.post(
        f"{settings.API_V1_STR}/auth/login",
        data={"username": "wrong@user.com", "password": "wrongpassword"}
    )
    assert response.status_code == 400
    
    # Test valid login for Palomino Inspector
    response = client.post(
        f"{settings.API_V1_STR}/auth/login",
        data={"username": "inspector@palomino.com", "password": "palomino123"}
    )
    assert response.status_code == 200
    token_data = response.json()
    assert "access_token" in token_data
    assert token_data["token_type"] == "bearer"
    
    token = token_data["access_token"]
    headers = {"Authorization": f"Bearer {token}"}
    
    # Test /me endpoint
    response = client.get(f"{settings.API_V1_STR}/auth/me", headers=headers)
    assert response.status_code == 200
    user_data = response.json()
    assert user_data["email"] == "inspector@palomino.com"
    assert user_data["rol"] == "inspector"
    assert user_data["empresa_id"] is not None

def test_catalog_endpoints():
    response = client.post(
        f"{settings.API_V1_STR}/auth/login",
        data={"username": "inspector@palomino.com", "password": "palomino123"}
    )
    token = response.json()["access_token"]
    headers = {"Authorization": f"Bearer {token}"}
    
    # Test companies list (public, no auth)
    response = client.get(f"{settings.API_V1_STR}/catalog/empresas")
    assert response.status_code == 200
    assert len(response.json()) >= 2
    
    # Test anomalies (auth required)
    response = client.get(f"{settings.API_V1_STR}/catalog/anomalias-neumatico", headers=headers)
    assert response.status_code == 200
    assert len(response.json()) > 0
    
    # Test config
    response = client.get(f"{settings.API_V1_STR}/catalog/configuraciones-vehiculo", headers=headers)
    assert response.status_code == 200
    assert len(response.json()) > 0

def test_vehicle_crud_and_inspections():
    # Login
    response = client.post(
        f"{settings.API_V1_STR}/auth/login",
        data={"username": "inspector@palomino.com", "password": "palomino123"}
    )
    token = response.json()["access_token"]
    headers = {"Authorization": f"Bearer {token}"}
    
    vehicle_number = "V-TEST-API-99"
    
    # Clean up vehicle if already exists by checking or listing
    # Create vehicle
    response = client.post(
        f"{settings.API_V1_STR}/vehicles",
        json={
            "numero": vehicle_number,
            "tipo_vehiculo": "TRACTO",
            "configuracion": "2-2-2"
        },
        headers=headers
    )
    # 201 Created or 400 if already exists from previous runs
    assert response.status_code in [201, 200, 400]
    
    # List vehicles with fuzzy search
    response = client.get(f"{settings.API_V1_STR}/vehicles?query=TEST-API", headers=headers)
    assert response.status_code == 200
    results = response.json()
    assert any(v["numero"] == vehicle_number for v in results)
    
    # Get vehicle details
    response = client.get(f"{settings.API_V1_STR}/vehicles/{vehicle_number}", headers=headers)
    assert response.status_code == 200
    assert response.json()["numero"] == vehicle_number
    
    # Create single inspection
    # Let's inspect 1 tire at position 1 (Direccional, which has default or seeded thresholds)
    # The default/seeded values from Excel for measure '295/80R22.5' or similar:
    # Let's use measure '295/80R22.5', tire serial 'COD-999'
    inspection_payload = {
        "numero_vehiculo": vehicle_number,
        "fecha": datetime.now(timezone.utc).isoformat(),
        "km_odometro": 150000,
        "neumaticos": [
            {
                "posicion": 1,
                "codigo": "COD-TIRE-99",
                "medida": "295/80R22.5",
                "marca": "Bridgestone",
                "diseno_original": "M729",
                "diseno_actual": "M729",
                "condicion": "N",
                "rtd_a": 9.0,
                "rtd_b": 8.0,
                "rtd_c": 9.0,
                "rtd_d": None,
                "presion": 110.0,
                "temperatura": "FRÍO",
                "tapa_valvula_id": 1,
                "sin_medir": False,
                "anomalia_aro_id": None,
                "anomalia_neumatico_id": None
            }
        ]
    }
    
    response = client.post(f"{settings.API_V1_STR}/inspections", json=inspection_payload, headers=headers)
    assert response.status_code == 201
    insp_res = response.json()
    assert insp_res["numero_vehiculo"] == vehicle_number
    assert len(insp_res["neumaticos"]) == 1
    
    # Verify calculations in response
    tire = insp_res["neumaticos"][0]
    assert tire["rtd_movi"] == 8.0  # min of 9.0, 8.0, 9.0
    assert tire["idi"] == 1.0       # max(9.0) - min(8.0)
    assert tire["estado_rtd"] == "Normal"  # 8.0 > 7.0 (proximo threshold)
    assert tire["estado_presion"] == "Normal"
    assert tire["desecho"] is False

def test_bulk_sync_inspections():
    # Login
    response = client.post(
        f"{settings.API_V1_STR}/auth/login",
        data={"username": "inspector@palomino.com", "password": "palomino123"}
    )
    token = response.json()["access_token"]
    headers = {"Authorization": f"Bearer {token}"}
    
    vehicle_number = "V-TEST-SYNC-88"
    
    # Create vehicle first
    client.post(
        f"{settings.API_V1_STR}/vehicles",
        json={"numero": vehicle_number, "tipo_vehiculo": "BUS", "configuracion": "2-4-2"},
        headers=headers
    )
    
    # Sync request payload
    sync_payload = {
        "inspecciones": [
            {
                "numero_vehiculo": vehicle_number,
                "fecha": "2026-06-19T10:00:00Z",
                "km_odometro": 230000,
                "neumaticos": [
                    {
                        "posicion": 1,
                        "codigo": "TIRE-S1",
                        "medida": "295/80R22.5",
                        "marca": "Goodyear",
                        "condicion": "R1",
                        "rtd_a": 3.0,
                        "rtd_b": 3.0,
                        "rtd_c": 4.0,
                        "presion": 80.0,
                        "temperatura": "FRÍO"
                    }
                ]
            }
        ]
    }
    
    response = client.post(f"{settings.API_V1_STR}/inspections/sync", json=sync_payload, headers=headers)
    assert response.status_code == 200
    assert response.json()["count"] == 1
    assert response.json()["status"] == "success"
    
    # Retrieve inspections list and check calculations
    response = client.get(f"{settings.API_V1_STR}/inspections", headers=headers)
    assert response.status_code == 200
    insps = response.json()
    
    # Find the synced inspection
    synced_insp = next((i for i in insps if i["numero_vehiculo"] == vehicle_number and i["km_odometro"] == 230000), None)
    assert synced_insp is not None
    assert len(synced_insp["neumaticos"]) == 1
    
    tire = synced_insp["neumaticos"][0]
    assert tire["rtd_movi"] == 3.0
    assert tire["estado_rtd"] == "Para Reencauche"  # 3.0 <= 4.0 (cambio threshold)
    assert tire["estado_presion"] == "Baja Presión" # 80 PSI < 110 * 0.90 (99 PSI)
