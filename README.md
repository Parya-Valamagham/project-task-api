# Project & Task Management API

یک RESTful API برای مدیریت پروژه‌ها، اعضای پروژه و وظایف (Tasks) با استفاده از NestJS، PostgreSQL و TypeORM.

## قابلیت‌ها

- ثبت‌نام و ورود کاربران
- احراز هویت با JWT Access Token و Refresh Token
- چرخش Refresh Token (Token Rotation)
- خروج از حساب و ابطال توکن‌ها
- تغییر رمز عبور
- مدیریت کاربران و نقش‌ها
- مدیریت پروژه‌ها
- افزودن و حذف اعضای پروژه
- ایجاد و مدیریت وظایف
- تخصیص وظایف به اعضای پروژه
- مدیریت وضعیت وظایف
- کنترل دسترسی مبتنی بر نقش (RBAC)
- اعتبارسنجی ورودی‌ها با DTO
- رمزنگاری رمز عبور با bcrypt
- محدودیت تعداد درخواست‌های ورود (Rate Limiting)

## تکنولوژی‌ها

- Node.js
- NestJS
- TypeScript
- PostgreSQL
- TypeORM
- JWT
- bcrypt
- Jest
- Postman

## نقش‌های کاربری

| نقش | دسترسی |
|---|---|
| Admin | مدیریت کاربران، پروژه‌ها و وظایف |
| Manager | مدیریت پروژه‌های متعلق به خود و وظایف آن‌ها |
| Member | مشاهده پروژه‌های عضویت‌شده و تغییر وضعیت وظایف تخصیص‌یافته به خود |

## پیش‌نیازها

- Node.js
- npm
- PostgreSQL

## نصب و راه‌اندازی

ابتدا پروژه را دریافت کنید:

```bash
git clone <REPOSITORY_URL>
cd project-task-api
```

وابستگی‌ها را نصب کنید:

```bash
npm install
```

فایل `.env.example` را به `.env` کپی کرده و مقادیر موردنیاز را تنظیم کنید.

## متغیرهای محیطی

```env
DB_HOST=localhost
DB_PORT=5432
DB_USERNAME=postgres
DB_PASSWORD=your_database_password
DB_DATABASE=project_task_db

JWT_ACCESS_SECRET=your_access_secret
JWT_REFRESH_SECRET=your_refresh_secret

JWT_ACCESS_EXPIRES_IN=15m
JWT_REFRESH_EXPIRES_IN=7d

ADMIN_EMAIL=admin@example.com
ADMIN_PASSWORD=your_admin_password
ADMIN_FULL_NAME=System Admin
```

**نکته امنیتی:** فایل `.env` نباید در Git Commit شود. برای تنظیم محیط از `.env.example` استفاده کنید.

## ایجاد اولین مدیر سیستم

برای ایجاد اولین حساب Admin از Seed استفاده می‌شود و نیازی به ثبت‌نام عمومی مدیر نیست.

پس از تنظیم متغیرهای `ADMIN_EMAIL`، `ADMIN_PASSWORD` و `ADMIN_FULL_NAME` در فایل `.env`، دستور زیر را اجرا کنید:

```bash
npm run seed:admin
```

## اجرای پروژه

حالت توسعه:

```bash
npm run start:dev
```

ساخت نسخه نهایی:

```bash
npm run build
```

اجرای نسخه Build شده:

```bash
npm run start:prod
```

## API Endpoints

تمام درخواست‌ها از طریق مسیر پایه زیر ارسال می‌شوند:

```text
http://localhost:3000
```

### Authentication

| Method | Endpoint | Description |
|---|---|---|
| POST | `/auth/register` | ثبت‌نام |
| POST | `/auth/login` | ورود |
| POST | `/auth/refresh` | دریافت Access Token جدید |
| POST | `/auth/logout` | خروج و ابطال Refresh Token |
| GET | `/auth/me` | دریافت اطلاعات کاربر فعلی |
| PUT | `/auth/me/password` | تغییر رمز عبور |

### Users

| Method | Endpoint | Description |
|---|---|---|
| POST | `/users` | ایجاد کاربر توسط Admin |
| GET | `/users` | دریافت فهرست کاربران |
| GET | `/users/:id` | دریافت اطلاعات کاربر |
| PATCH | `/users/:id/role` | تغییر نقش کاربر |
| PATCH | `/users/:id/status` | تغییر وضعیت فعال بودن |
| PATCH | `/users/:id` | ویرایش اطلاعات کاربر |
| DELETE | `/users/:id` | حذف کاربر |

### Projects

| Method | Endpoint | Description |
|---|---|---|
| POST | `/projects` | ایجاد پروژه |
| GET | `/projects` | دریافت فهرست پروژه‌ها |
| GET | `/projects/:id` | دریافت جزئیات پروژه |
| PATCH | `/projects/:id` | ویرایش پروژه |
| DELETE | `/projects/:id` | حذف پروژه |
| POST | `/projects/:id/members` | افزودن عضو به پروژه |
| DELETE | `/projects/:id/members/:userId` | حذف عضو از پروژه |

### Tasks

| Method | Endpoint