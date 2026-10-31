# Accountant & Payroll Management (Cloudflare)

A starter web app for one company, Arabic/English interface, SAR, employees, attendance, advances, expenses, payroll and JSON backup.

## Deploy

1. Install Node.js (LTS) and run `npm install -g wrangler`.
2. Sign in: `wrangler login`.
3. Create the database: `wrangler d1 create accountant-payroll-db`.
4. Copy the `database_id` from the command output into `wrangler.toml`, replacing `REPLACE_WITH_YOUR_D1_DATABASE_ID`.
5. Apply the schema: `wrangler d1 migrations apply accountant-payroll-db --remote`.
6. Set a long random session secret: `wrangler secret put SESSION_SECRET`.
7. Deploy: `wrangler deploy`.
8. Open the deployed URL. The first visit asks you to create the administrator account. Use a strong password of at least 10 characters.

## Local development

`wrangler d1 migrations apply accountant-payroll-db --local`
`wrangler dev`

## Important notes

- This is a functional starter/MVP, not a certified accounting or Saudi payroll compliance product.
- Automatic overtime currently uses an estimate based on a 240-hour monthly divisor and the basic hourly wage plus 50% of basic hourly wage. Confirm the correct calculation, wage components, working-hours basis and applicable rules with your Saudi payroll adviser before paying employees.
- Database backups can be downloaded from Reports as JSON. Store backups securely.
- Bill photo uploads, PDF file generation, role permissions, audit log, automated off-site backups and advanced accounting ledgers are not included in this first ZIP. Salary slips can be printed using the browser print dialog.
- Protect your Cloudflare account and D1 database. Do not share your administrator password or session secret.
