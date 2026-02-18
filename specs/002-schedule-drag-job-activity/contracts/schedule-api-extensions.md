# Schedule API Extensions (002)

Existing schedule API is extended to support **Activity** assignments and **time range** (startTime/endTime) from drag-to-select.

**Base path**: `/api/schedule`  
**Auth**: All endpoints require authenticated user.

---

## Request/response shape changes

### Schedule entry (GET responses, POST/PATCH responses)

- **jobId**: optional (null when entry is an activity assignment)
- **activityId**: optional (null when entry is a job assignment)
- Exactly one of `jobId` or `activityId` is set per entry.
- **startTime** / **endTime**: already present; used for drag-selected range (e.g. "09:00", "12:00").

---

## POST /api/schedule

**Request body** (extended):
- `jobId` (string, optional): Required if activityId not set
- `activityId` (string, optional): Required if jobId not set
- `staffId` (string, required)
- `scheduledDate` (string, required, date)
- `startTime` (string, optional): e.g. "09:00"
- `endTime` (string, optional): e.g. "12:00"
- `durationHours` (string, optional)
- `status` (string, optional)
- `notes` (string, optional)

**Validation**: Exactly one of `jobId` or `activityId` must be provided.  
**Response**: `201 Created` — Schedule entry (with job or activity).  
**Response**: `400` — Validation error (e.g. both jobId and activityId, or neither).

---

## PATCH /api/schedule/:id

**Request body**: Partial; may include `activityId`, `jobId`, `startTime`, `endTime`, etc.  
**Validation**: After patch, entry must still have exactly one of jobId or activityId.  
**Response**: `200 OK` — Updated entry.  
**Response**: `404` — Not found.

---

## GET /api/schedule

**Query params**: Unchanged (`startDate`, `endDate`, `jobId`, `staffId`).  
**Response**: Array of schedule entries; each has either `jobId` or `activityId` set. Client can distinguish job vs activity slots for display (e.g. different style/label).
