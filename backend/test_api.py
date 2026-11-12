"""
test_api.py - Script pengujian otomatis untuk Backend API Swift Studio.
Memastikan semua endpoint (kesehatan, daftar job, validasi upload, get status, transkrip, dsb)
bekerja dengan benar.
"""

import io
import sys
from fastapi.testclient import TestClient

from main import app
from jobs import init_db

def run_tests():
    print("=== Memulai Pengujian API Swift Studio ===")
    init_db()
    client = TestClient(app)

    # 1. Test Root
    res = client.get("/")
    assert res.status_code == 200, f"Root error: {res.text}"
    print("[PASS] GET / -> 200 OK:", res.json())

    # 2. Test Health Check
    res = client.get("/api/health")
    assert res.status_code == 200, f"Health check error: {res.text}"
    data = res.json()
    assert data["status"] == "healthy"
    print("[PASS] GET /api/health -> 200 OK:", data)

    # 3. Test Invalid File Extension
    dummy_txt = io.BytesIO(b"Hello text file")
    res = client.post(
        "/api/jobs",
        files={"file": ("test.txt", dummy_txt, "text/plain")},
        data={"num_clips": 6, "burn_captions": True, "language": "Indonesia"}
    )
    assert res.status_code == 400, f"Expected 400 for txt, got {res.status_code}"
    print("[PASS] POST /api/jobs (invalid ext) -> 400 Bad Request:", res.json()["detail"])

    # 4. Test Valid Video Upload & Job Creation
    # Video container dummy mp4 bytes
    dummy_mp4 = io.BytesIO(b"\x00\x00\x00\x20ftypisom\x00\x00\x02\x00isomiso2avc1mp41" + b"\x00" * 1024)
    res = client.post(
        "/api/jobs",
        files={"file": ("demo_sample.mp4", dummy_mp4, "video/mp4")},
        data={"num_clips": 5, "burn_captions": True, "language": "Indonesia"}
    )
    assert res.status_code == 201, f"Create job error: {res.text}"
    job_info = res.json()
    job_id = job_info["job_id"]
    assert job_info["status"] == "queued"
    print(f"[PASS] POST /api/jobs -> 201 Created (Job ID: {job_id})")

    # 5. Test Get Job Status
    res = client.get(f"/api/jobs/{job_id}")
    assert res.status_code == 200
    job_status = res.json()
    assert job_status["id"] == job_id
    assert job_status["filename"] == "demo_sample.mp4"
    print(f"[PASS] GET /api/jobs/{job_id} -> Status: {job_status['status']}, Progress: {job_status['progress']}%")

    # 6. Test List Jobs
    res = client.get("/api/jobs")
    assert res.status_code == 200
    jobs_list = res.json()
    assert any(j["id"] == job_id for j in jobs_list)
    print(f"[PASS] GET /api/jobs -> Berhasil memuat {len(jobs_list)} job")

    # 7. Test Transcript Endpoint
    res = client.get(f"/api/jobs/{job_id}/transcript")
    assert res.status_code == 200
    print(f"[PASS] GET /api/jobs/{job_id}/transcript -> 200 OK (List: {len(res.json())} item)")

    # 8. Test Delete Job
    res = client.delete(f"/api/jobs/{job_id}")
    assert res.status_code == 200
    assert res.json()["success"] is True
    print(f"[PASS] DELETE /api/jobs/{job_id} -> 200 OK")

    # Pastikan setelah dihapus menghasilkan 404
    res = client.get(f"/api/jobs/{job_id}")
    assert res.status_code == 404
    print(f"[PASS] GET /api/jobs/{job_id} (setelah dihapus) -> 404 Not Found")

    print("\n[SUKSES] Semua pengujian API backend Swift Studio berhasil 100%!")

if __name__ == "__main__":
    run_tests()
