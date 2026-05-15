# Postman API Testing Kit (Backend)

## Files
- `postman_collection.json`
- `postman_environment.json`

## Import in Postman
1. Open Postman -> Import.
2. Import both files above from this folder.
3. Select environment `RESQAI Local`.

## Run backend
```bash
cd backend
npm run dev
```
Default base URL used: `http://localhost:5000/api/v1`

## Suggested test order
1. `Health -> Health Check`
2. `Auth -> Register` (or `Auth -> Login`)
3. `Auth -> Get Me` (confirms token)
4. `Disasters -> Create Disaster` (copy returned `_id` into env var `disasterId`)
5. `SOS -> Submit SOS` (copy `_id` to `sosId`)
6. `Shelters -> Create Shelter` (copy `_id` to `shelterId`)
7. `Resources -> Create Resource` (copy `_id` to `resourceId`)
8. `Social -> Ingest Post` (copy `_id` to `postId`)
9. `Alerts -> Send Alert` (copy `_id` to `alertId`)
10. `Rescue Routes -> Calculate Route` (copy `_id` to `routeId`)

## Important notes
- Protected APIs require `Authorization: Bearer {{token}}`.
- `Register` and `Login` requests auto-save `token` + `userId` in environment.
- Admin-only APIs:
  - `DELETE /disasters/:id`
  - `POST /alerts/send`
  - `POST /alerts/broadcast`
  - `POST /alerts/evacuate`
  - `PATCH /alerts/:id/cancel`
  - `DELETE /routes/:id`
- If you register/login with non-admin role, admin endpoints should return `403`.

## Optional negative tests
- Remove token and call protected routes -> expect `401`.
- Send invalid IDs to `/:id` routes -> expect `404`.
- Omit required fields in create routes -> expect `400`.

