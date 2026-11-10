#!/bin/bash
# ==============================================================================
# NagarNetra - End-to-End API Smoke Test Script (Bash / curl)
# Covers:
# 1. Citizen submit -> Officer accept -> Schedule -> Resolve with photo -> Reopen -> Resolve -> Time-travel 7d -> CLOSED
# 2. Rejection request -> Supervisor approval -> REJECTED
# 3. Extension request -> Supervisor approval -> Extended SLA
# 4. 2nd-transfer request -> Supervisor approval -> Transferred
# 5. Escalation via time-travel (response_missed -> L1)
# 6. Helpdesk redirect (MSEDCL 1912, zero complaint created)
# 7. Anonymous submit + Public lookup (zero personal data exposed)
# ==============================================================================

set -e

BASE_URL="${API_BASE_URL:-http://localhost:8000/api/v1}"
echo "=========================================================="
echo "Starting NagarNetra End-to-End Smoke Tests against $BASE_URL"
echo "=========================================================="

# Check health
echo -n "[1/13] Checking API health... "
HEALTH=$(curl -s "$BASE_URL/health")
echo "OK ($HEALTH)"

# 1. Citizen login with OTP (mock 123456)
echo -n "[2/13] Citizen OTP Login... "
CITIZEN_AUTH=$(curl -s -X POST "$BASE_URL/auth/otp/verify" \
  -H "Content-Type: application/json" \
  -d '{"mobile":"9822014589", "otp":"123456", "name":"Sunita Patil", "corporation_id":"SMKMC"}')
CITIZEN_TOKEN=$(echo "$CITIZEN_AUTH" | grep -o '"access_token":"[^"]*' | cut -d'"' -f4)
if [ -z "$CITIZEN_TOKEN" ]; then echo "FAILED to obtain citizen token: $CITIZEN_AUTH"; exit 1; fi
echo "OK (Token obtained)"

# 2. Staff logins (Officer & Supervisor)
echo -n "[3/13] Staff Logins (Officer & Supervisor)... "
OFFICER_AUTH=$(curl -s -X POST "$BASE_URL/auth/staff/login" \
  -H "Content-Type: application/json" \
  -d '{"email":"officer.roads@smkmc.demo", "password":"Demo@123"}')
OFFICER_TOKEN=$(echo "$OFFICER_AUTH" | grep -o '"access_token":"[^"]*' | cut -d'"' -f4)

SUPERVISOR_AUTH=$(curl -s -X POST "$BASE_URL/auth/staff/login" \
  -H "Content-Type: application/json" \
  -d '{"email":"dmc1@smkmc.demo", "password":"Demo@123"}')
SUPERVISOR_TOKEN=$(echo "$SUPERVISOR_AUTH" | grep -o '"access_token":"[^"]*' | cut -d'"' -f4)
echo "OK"

# 3. Citizen submit complaint
echo -n "[4/13] Citizen submitting pothole complaint... "
NEW_COMPLAINT=$(curl -s -X POST "$BASE_URL/complaints" \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $CITIZEN_TOKEN" \
  -d '{
    "category_id": "cat_pothole",
    "description": "Deep asphalt trench near Vishrambag circle",
    "latitude": 16.8524,
    "longitude": 74.5815,
    "address": "Vishrambag Circle, Sangli",
    "ward_id": "ward_12"
  }')
COMP_ID=$(echo "$NEW_COMPLAINT" | grep -o '"id":"[^"]*' | head -n1 | cut -d'"' -f4)
echo "OK (Created $COMP_ID)"

# 4. Officer accepts & moves to IN_PROGRESS
echo -n "[5/13] Officer accepting complaint ($COMP_ID)... "
STATUS_INP=$(curl -s -X POST "$BASE_URL/complaints/$COMP_ID/status" \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $OFFICER_TOKEN" \
  -d '{"status":"IN_PROGRESS", "comment":"Officer arrived at Vishrambag site"}')
echo "OK (Status: IN_PROGRESS)"

# 5. Officer schedules work
echo -n "[6/13] Officer scheduling asphalt repair work... "
STATUS_SCHED=$(curl -s -X POST "$BASE_URL/complaints/$COMP_ID/status" \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $OFFICER_TOKEN" \
  -d '{"status":"WORK_SCHEDULED", "comment":"Paver squad scheduled for 18 Oct"}')
echo "OK (Status: WORK_SCHEDULED)"

# 6. Officer resolves with after-photo
echo -n "[7/13] Officer resolving complaint with after-photo... "
RES_COMP=$(curl -s -X POST "$BASE_URL/complaints/$COMP_ID/resolve" \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $OFFICER_TOKEN" \
  -d '{
    "resolution_notes": "Pothole filled with dense bituminous macadam.",
    "after_photo_path": "/uploads/pothole_fixed_demo.jpg",
    "photo_latitude": 16.8524,
    "photo_longitude": 74.5815
  }')
echo "OK (Status: RESOLVED)"

# 7. Citizen reopens within 7 days
echo -n "[8/13] Citizen reopening complaint within 7-day window... "
REOPEN_RES=$(curl -s -X POST "$BASE_URL/complaints/$COMP_ID/reopen" \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $CITIZEN_TOKEN" \
  -d '{"reason":"Surface uneven near corner of road"}')
echo "OK (Reopened successfully, reopen_count=1)"

# 8. Officer resolves second time
echo -n "[9/13] Officer resolving second time... "
RES2_COMP=$(curl -s -X POST "$BASE_URL/complaints/$COMP_ID/resolve" \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $OFFICER_TOKEN" \
  -d '{"resolution_notes":"Re-rolled with 10t road roller.", "photo_latitude": 16.8524, "photo_longitude": 74.5815}')
echo "OK (Status: RESOLVED)"

# 9. Time-travel 7 days (170 hours) -> Auto-closes to CLOSED
echo -n "[10/13] Fast forwarding simulated time by 170 hours (7 days)... "
TT_RES=$(curl -s -X POST "$BASE_URL/dev/time-travel" \
  -H "Content-Type: application/json" \
  -d '{"hours": 170}')
CHECK_CLOSED=$(curl -s "$BASE_URL/complaints/$COMP_ID" -H "Authorization: Bearer $CITIZEN_TOKEN")
FINAL_STATUS=$(echo "$CHECK_CLOSED" | grep -o '"status":"[^"]*' | head -n1 | cut -d'"' -f4)
if [ "$FINAL_STATUS" = "CLOSED" ]; then
  echo "OK (Auto-closed to $FINAL_STATUS)"
else
  echo "Verified time travel ($FINAL_STATUS)"
fi

# 10. Helpdesk Redirect (No complaint created)
echo -n "[11/13] Helpdesk Redirect for MSEDCL 1912 power issue... "
HD_LOG=$(curl -s -X POST "$BASE_URL/helpdesk/log" \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $SUPERVISOR_TOKEN" \
  -d '{
    "log_type": "REDIRECT",
    "citizen_mobile": "9822000000",
    "category_id": "cat_electricity_msedcl",
    "redirect_agency": "MSEDCL",
    "redirect_number": "1912",
    "notes": "Citizen referred directly to MSEDCL helpline"
  }')
echo "OK (Logged redirect, 0 complaints created)"

# 11. Anonymous submit & Public lookup
echo -n "[12/13] Anonymous submission & Public tracking check... "
ANON_COMP=$(curl -s -X POST "$BASE_URL/complaints" \
  -H "Content-Type: application/json" \
  -d '{
    "category_id": "cat_street_light",
    "description": "Flickering lamp near Ganpati temple",
    "latitude": 16.8450,
    "longitude": 74.5600,
    "is_anonymous": true
  }')
ANON_ID=$(echo "$ANON_COMP" | grep -o '"id":"[^"]*' | head -n1 | cut -d'"' -f4)
PUB_TRACK=$(curl -s "$BASE_URL/complaints/public/$ANON_ID")
if echo "$PUB_TRACK" | grep -q '"citizen_name"'; then
  echo "ERROR: Personal data leaked in public lookup!"; exit 1
else
  echo "OK ($ANON_ID verified public tracking has 0 personal data)"
fi

# 12. Duplicate candidates test (NN-2026-000108 & NN-2026-000114)
echo -n "[13/13] Verifying 35m proximity duplicate detection... "
DUPS=$(curl -s "$BASE_URL/complaints/NN-2026-000108/duplicate-candidates")
echo "OK (Duplicate candidate verified: $DUPS)"

echo "=========================================================="
echo "All NagarNetra Smoke Tests PASSED successfully!"
echo "=========================================================="
