# API Configuration and Request Management

**Project:** Football Score Prediction Automation V1
**Provider:** API-Football (v3.football.api-sports.io)
**Plan:** Free Tier (100 requests/day)
**Timezone:** Africa/Lagos

---

## 1. Credentials Configuration

API-Football authentication requires a single custom HTTP header:
- **Header Name:** `x-apisports-key`
- **Header Value:** `<your-api-sports-key>`

### Setting Up the Credential in n8n
To ensure security, credentials must **never** be hardcoded in workflows, JavaScript code, `.env`, or committed to Git.

1. Open `http://localhost:5678` in your browser.
2. Click **Credentials** in the left sidebar.
3. Click **Add Credential** in the top right.
4. Search for and select **Header Auth**.
5. Fill in the fields:
   - **Credential Name:** `API-Football Header Auth`
   - **Name:** `x-apisports-key`
   - **Value:** Paste your actual API-Football API key.
6. Click **Save**.

The workflow nodes reference this credential by name (`API-Football Header Auth`).

---

## 2. API Endpoints Used

### Workflow A: Completed Historical Fixtures
- **Method:** `GET`
- **URL:** `https://v3.football.api-sports.io/fixtures`
- **Query Parameters:**
  - `league=39` (English Premier League)
  - `season=2025` (Historical Training Season)
  - `status=FT` (Full-Time regulation matches only)
  - `timezone=Africa/Lagos`

### Workflow B: Upcoming Fixtures
- **Method:** `GET`
- **URL:** `https://v3.football.api-sports.io/fixtures`
- **Query Parameters:**
  - `league=39` (English Premier League)
  - `season=2026` (Upcoming Prediction Season)
  - `status=NS` (Not Started)
  - `from=YYYY-MM-DD` (Window start date)
  - `to=YYYY-MM-DD` (Window end date)
  - `timezone=Africa/Lagos`

### Diagnostics Workflow: Verify API Access & Quota
- **Method:** `GET`
- **URL:** `https://v3.football.api-sports.io/status`
- **Purpose:** Checks account status, subscription plan, and daily request usage **without counting against your daily quota allowance**.

---

## 3. Daily Request Budget

On the Free tier (100 requests/day):
- **Workflow A (Build Team Strengths):**
  - Executed manually once per training cycle.
  - Consumes **1 request** to fetch the full 2025/2026 completed fixture set.
- **Workflow B (Predict Upcoming Matches):**
  - Executed manually per matchday window (e.g. upcoming weekend).
  - Consumes **1 request** to fetch all unstarted matches in the date window.
- **Diagnostics Workflow:**
  - Consumes **0 requests** (the `/status` endpoint is free and unmetered).
- **Total Routine Consumption:** 2 requests per operational cycle.
- **Safety Margin:** 98 requests remaining per day.

---

## 4. Response Validation and Error Handling Rules

The workflows implement strict validation guards before processing API responses:
1. **Object Validation:** Response body must be an object and not an array or string.
2. **Error Array Inspection:** `errors` must be empty (empty array or empty object). If the API returns `{ "errors": { "token": "..." } }`, the workflow halts immediately and routes to the failure path.
3. **Array Structure:** `response` must be a valid JavaScript Array.
4. **Pagination Check:** `paging.current` must equal or exceed `paging.total`. If partial pages are indicated, the workflow fails closed to avoid computing strengths or predictions on incomplete data.
5. **Score Verification:** In Workflow A, `score.fulltime.home/away` must match `goals.home/away`. Matches with `AET`, `PEN`, `PST` (postponed), or `CANC` (cancelled) statuses are strictly rejected.
