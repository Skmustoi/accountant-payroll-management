CREATE TABLE IF NOT EXISTS users (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  username TEXT NOT NULL UNIQUE,
  password_hash TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE TABLE IF NOT EXISTS employees (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  employee_code TEXT NOT NULL UNIQUE,
  name TEXT NOT NULL,
  phone TEXT DEFAULT '',
  designation TEXT DEFAULT '',
  joining_date TEXT DEFAULT '',
  basic_salary REAL NOT NULL DEFAULT 0,
  housing_allowance REAL NOT NULL DEFAULT 0,
  other_allowance REAL NOT NULL DEFAULT 0,
  overtime_mode TEXT NOT NULL DEFAULT 'manual',
  overtime_rate REAL NOT NULL DEFAULT 0,
  active INTEGER NOT NULL DEFAULT 1,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE TABLE IF NOT EXISTS attendance (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  employee_id INTEGER NOT NULL,
  work_date TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'present',
  overtime_hours REAL NOT NULL DEFAULT 0,
  notes TEXT DEFAULT '',
  FOREIGN KEY(employee_id) REFERENCES employees(id),
  UNIQUE(employee_id, work_date)
);
CREATE TABLE IF NOT EXISTS advances (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  employee_id INTEGER NOT NULL,
  advance_date TEXT NOT NULL,
  amount REAL NOT NULL,
  description TEXT DEFAULT '',
  remaining REAL NOT NULL,
  FOREIGN KEY(employee_id) REFERENCES employees(id)
);
CREATE TABLE IF NOT EXISTS expenses (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  expense_date TEXT NOT NULL,
  category TEXT NOT NULL,
  description TEXT DEFAULT '',
  amount REAL NOT NULL,
  status TEXT NOT NULL DEFAULT 'paid',
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE TABLE IF NOT EXISTS payroll (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  employee_id INTEGER NOT NULL,
  pay_month TEXT NOT NULL,
  basic_salary REAL NOT NULL,
  overtime_hours REAL NOT NULL DEFAULT 0,
  overtime_amount REAL NOT NULL DEFAULT 0,
  allowances REAL NOT NULL DEFAULT 0,
  advance_deduction REAL NOT NULL DEFAULT 0,
  other_deductions REAL NOT NULL DEFAULT 0,
  net_salary REAL NOT NULL,
  status TEXT NOT NULL DEFAULT 'unpaid',
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY(employee_id) REFERENCES employees(id),
  UNIQUE(employee_id, pay_month)
);
