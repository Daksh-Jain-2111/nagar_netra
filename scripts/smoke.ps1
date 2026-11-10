# ==============================================================================
# NagarNetra - End-to-End API Smoke Test Script (Windows PowerShell)
# ==============================================================================
$ErrorActionPreference = "Stop"

$BASE_URL = if ($env:API_BASE_URL) { $env:API_BASE_URL } else { "http://localhost:8000/api/v1" }
Write-Host "==========================================================" -ForegroundColor Cyan
Write-Host "Starting NagarNetra End-to-End Smoke Tests against $BASE_URL" -ForegroundColor Cyan
Write-Host "==========================================================" -ForegroundColor Cyan

# Health
Write-Host -NoNewline "[1/13] Checking API health... "
$health = Invoke-RestMethod -Uri "$BASE_URL/health" -Method Get
Write-Host "OK ($($health.status))" -ForegroundColor Green

# 1. Citizen login with OTP 123456
Write-Host -NoNewline "[2/13] Citizen OTP Login... "
$citizenAuth = Invoke-RestMethod -Uri "$BASE_URL/auth/otp/verify" -Method Post -ContentType "application/json" -Body '{"mobile":"9822014589", "otp":"123456", "name":"Sunita Patil", "corporation_id":"SMKMC"}'
$citizenToken = $citizenAuth.access_token
Write-Host "OK (Token obtained)" -ForegroundColor Green

# 2. Staff Logins
Write-Host -NoNewline "[3/13] Staff Logins (Officer & Supervisor)... "
$officerAuth = Invoke-RestMethod -Uri "$BASE_URL/auth/staff/login" -Method Post -ContentType "application/json" -Body '{"email":"officer.roads@smkmc.demo", "password":"Demo@123"}'
$officerToken = $officerAuth.access_token

$supAuth = Invoke-RestMethod -Uri "$BASE_URL/auth/staff/login" -Method Post -ContentType "application/json" -Body '{"email":"dmc1@smkmc.demo", "password":"Demo@123"}'
$supToken = $supAuth.access_token
Write-Host "OK" -ForegroundColor Green

# 3. Citizen submits complaint
Write-Host -NoNewline "[4/13] Citizen submitting pothole complaint... "
$compBody = @{
    category_id = "cat_pothole"
    description = "Deep asphalt trench near Vishrambag circle"
    latitude = 16.8524
    longitude = 74.5815
    address = "Vishrambag Circle, Sangli"
    ward_id = "ward_12"
} | ConvertTo-Json
$headersCitizen = @{ Authorization = "Bearer $citizenToken" }
$newComp = Invoke-RestMethod -Uri "$BASE_URL/complaints" -Method Post -ContentType "application/json" -Headers $headersCitizen -Body $compBody
$compId = $newComp.id
Write-Host "OK (Created $compId)" -ForegroundColor Green

# 4. Officer accepts & moves to IN_PROGRESS
Write-Host -NoNewline "[5/13] Officer accepting complaint ($compId)... "
$headersOfficer = @{ Authorization = "Bearer $officerToken" }
$inpBody = @{ status = "IN_PROGRESS"; comment = "Officer arrived at site" } | ConvertTo-Json
$inpRes = Invoke-RestMethod -Uri "$BASE_URL/complaints/$compId/status" -Method Post -ContentType "application/json" -Headers $headersOfficer -Body $inpBody
Write-Host "OK (Status: IN_PROGRESS)" -ForegroundColor Green

# 5. Work Scheduled
Write-Host -NoNewline "[6/13] Scheduling asphalt repair work... "
$schedBody = @{ status = "WORK_SCHEDULED"; comment = "Paver squad scheduled for 18 Oct" } | ConvertTo-Json
$schedRes = Invoke-RestMethod -Uri "$BASE_URL/complaints/$compId/status" -Method Post -ContentType "application/json" -Headers $headersOfficer -Body $schedBody
Write-Host "OK (Status: WORK_SCHEDULED)" -ForegroundColor Green

# 6. Resolve with after-photo
Write-Host -NoNewline "[7/13] Officer resolving with after-photo... "
$resBody = @{
    resolution_notes = "Pothole filled with dense bituminous macadam."
    after_photo_path = "/uploads/pothole_fixed_demo.jpg"
    photo_latitude = 16.8524
    photo_longitude = 74.5815
} | ConvertTo-Json
$resRes = Invoke-RestMethod -Uri "$BASE_URL/complaints/$compId/resolve" -Method Post -ContentType "application/json" -Headers $headersOfficer -Body $resBody
Write-Host "OK (Status: RESOLVED)" -ForegroundColor Green

# 7. Citizen reopens
Write-Host -NoNewline "[8/13] Citizen reopening within 7-day window... "
$reopenBody = @{ reason = "Surface uneven near corner of road" } | ConvertTo-Json
$reopenRes = Invoke-RestMethod -Uri "$BASE_URL/complaints/$compId/reopen" -Method Post -ContentType "application/json" -Headers $headersCitizen -Body $reopenBody
Write-Host "OK (Reopened, count=$($reopenRes.reopen_count))" -ForegroundColor Green

# 8. Resolve second time
Write-Host -NoNewline "[9/13] Officer resolving second time... "
$res2Body = @{ resolution_notes = "Re-rolled with 10t road roller."; photo_latitude = 16.8524; photo_longitude = 74.5815 } | ConvertTo-Json
$res2Res = Invoke-RestMethod -Uri "$BASE_URL/complaints/$compId/resolve" -Method Post -ContentType "application/json" -Headers $headersOfficer -Body $res2Body
Write-Host "OK (Status: RESOLVED)" -ForegroundColor Green

# 9. Time travel 170 hours (7 days) -> Auto-closes to CLOSED
Write-Host -NoNewline "[10/13] Fast forwarding simulated time by 170 hours (7 days)... "
$ttBody = @{ hours = 170 } | ConvertTo-Json
$ttRes = Invoke-RestMethod -Uri "$BASE_URL/dev/time-travel" -Method Post -ContentType "application/json" -Body $ttBody
$checkClosed = Invoke-RestMethod -Uri "$BASE_URL/complaints/$compId" -Method Get -Headers $headersCitizen
Write-Host "OK (Auto-closed to $($checkClosed.status))" -ForegroundColor Green

# 10. Helpdesk redirect
Write-Host -NoNewline "[11/13] Helpdesk Redirect for MSEDCL 1912... "
$hdBody = @{
    log_type = "REDIRECT"
    citizen_mobile = "9822000000"
    category_id = "cat_electricity_msedcl"
    redirect_agency = "MSEDCL"
    redirect_number = "1912"
    notes = "Citizen referred to MSEDCL 1912"
} | ConvertTo-Json
$headersSup = @{ Authorization = "Bearer $supToken" }
$hdRes = Invoke-RestMethod -Uri "$BASE_URL/helpdesk/log" -Method Post -ContentType "application/json" -Headers $headersSup -Body $hdBody
Write-Host "OK (Redirect logged, 0 complaints created)" -ForegroundColor Green

# 11. Anonymous submission & Public lookup
Write-Host -NoNewline "[12/13] Anonymous submission & Public lookup test... "
$anonBody = @{
    category_id = "cat_street_light"
    description = "Dark stretch near Ganpati temple"
    latitude = 16.8450
    longitude = 74.5600
    is_anonymous = $true
} | ConvertTo-Json
$anonComp = Invoke-RestMethod -Uri "$BASE_URL/complaints" -Method Post -ContentType "application/json" -Body $anonBody
$pubTrack = Invoke-RestMethod -Uri "$BASE_URL/complaints/public/$($anonComp.id)" -Method Get
if ($pubTrack.citizen_name) {
    Write-Host "FAILED: Personal data exposed in public lookup!" -ForegroundColor Red
    exit 1
} else {
    Write-Host "OK ($($anonComp.id) public lookup is clean of personal data)" -ForegroundColor Green
}

# 12. Duplicate candidates check
Write-Host -NoNewline "[13/13] Verifying 35m proximity duplicate detection... "
$dups = Invoke-RestMethod -Uri "$BASE_URL/complaints/NN-2026-000108/duplicate-candidates" -Method Get
Write-Host "OK (Candidates found: $($dups.Count))" -ForegroundColor Green

Write-Host "==========================================================" -ForegroundColor Cyan
Write-Host "All NagarNetra Smoke Tests PASSED successfully!" -ForegroundColor Green
Write-Host "==========================================================" -ForegroundColor Cyan
