# 🧱 Brick Manufacturing ERP Backend - Complete API Documentation

**Version:** 1.0.0  
**Environment:** Node.js + Express + MongoDB  
**API Base URL:** `http://localhost:5000/api/v1`  
**Documentation URL:** `http://localhost:5000/api-docs`  
**ReDoc Documentation:** `http://localhost:5000/api-docs-html`

---

## 📋 Table of Contents

1. [Quick Start](#quick-start)
2. [Authentication](#authentication)
3. [API Modules](#api-modules)
4. [Common Patterns](#common-patterns)
5. [Error Handling](#error-handling)
6. [Complete Endpoint Reference](#complete-endpoint-reference)

---

## 🚀 Quick Start

### Installation

```bash
cd backendnew
npm install
```

### Start Development Server

```bash
npm run dev
```

The server will start on `http://localhost:5000` with MongoDB connected.

### Environment Variables

Create `.env` file:

```
NODE_ENV=development
PORT=5000
MONGODB_URI=mongodb://localhost:27017/brick-erp
JWT_SECRET=your-secret-key
JWT_EXPIRE=7d
```

---

## 🔐 Authentication

### Login to Get Token

**Endpoint:** `POST /api/v1/auth/login`

**Headers:**
```
Content-Type: application/json
```

**Request Body:**
```json
{
  "email": "admin@brickerp.com",
  "password": "Admin@123456"
}
```

**Response (200 OK):**
```json
{
  "success": true,
  "message": "Login successful",
  "data": {
    "user": {
      "_id": "507f1f77bcf86cd799439011",
      "name": "Admin User",
      "email": "admin@brickerp.com",
      "role": "admin"
    },
    "token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
    "refreshToken": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
  }
}
```

### Using Token in Requests

All protected endpoints require this header:

```
Authorization: Bearer YOUR_JWT_TOKEN_HERE
```

### Test Users

| Email | Password | Role |
|-------|----------|------|
| admin@brickerp.com | Admin@123456 | admin |
| procurement@brick-erp.com | Proc@123 | procurement_officer |
| warehouse@brick-erp.com | Ware@123 | warehouse_manager |
| production@brick-erp.com | Prod@123 | production_officer |
| logistics@brick-erp.com | Log@123 | logistics_manager |

---

## 📚 API Modules

The backend has **10 main modules** with **74+ endpoints**:

| Module | Endpoints | Description |
|--------|-----------|-------------|
| **Authentication (IAM)** | 7 | User login, registration, token management |
| **Catalog** | 14 | Categories, items, tags management |
| **Procurement** | 13 | Vendors, estimates, purchase orders |
| **Inventory** | 15 | Warehouses, stock, goods receipts |
| **Manufacturing** | 15 | Kilns, batches, labour, production |
| **Logistics** | 10 | Trips, dispatch, delivery, transport |
| **Payments** | 9 | Purchase order payment management |
| **Reports** | 9 | Dashboards, analytics, summaries |
| **Excel** | 10 | Import/export operations |
| **Calculations** | 8 | Cost & time calculations |

---

## 🔄 Common Patterns

### Pagination

Most list endpoints support pagination:

```bash
GET /api/v1/catalog/items?page=1&limit=20
```

**Query Parameters:**
- `page` - Page number (default: 1)
- `limit` - Records per page (default: 20)
- `search` - Search/filter keyword
- `sort` - Sort field (optional)

**Response includes:**
```json
{
  "success": true,
  "data": [...items],
  "pagination": {
    "currentPage": 1,
    "pageSize": 20,
    "totalCount": 150,
    "totalPages": 8,
    "hasNextPage": true,
    "hasPrevPage": false
  }
}
```

### Error Response

All error responses follow this format:

```json
{
  "success": false,
  "message": "Error description",
  "errors": ["Field-specific errors if any"]
}
```

**HTTP Status Codes:**
- `200` - Success
- `201` - Created
- `204` - No Content
- `400` - Bad Request / Validation Error
- `401` - Unauthorized
- `403` - Forbidden
- `404` - Not Found
- `500` - Server Error

---

## 📝 Complete Endpoint Reference

---

# 1️⃣ AUTHENTICATION MODULE (7 Endpoints)

## User Registration

**Endpoint:** `POST /api/v1/auth/register`  
**Access:** Public (No token required)

**Headers:**
```
Content-Type: application/json
```

**Request Body:**
```json
{
  "name": "New User",
  "email": "newuser@brick-erp.com",
  "password": "SecurePass@123",
  "role": "warehouse_manager"
}
```

**Response (201 Created):**
```json
{
  "success": true,
  "message": "Registration successful",
  "data": {
    "user": {
      "_id": "507f1f77bcf86cd799439012",
      "name": "New User",
      "email": "newuser@brick-erp.com",
      "role": "warehouse_manager",
      "active": true
    },
    "token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
  }
}
```

---

## User Login

**Endpoint:** `POST /api/v1/auth/login`  
**Access:** Public

**Request Body:**
```json
{
  "email": "admin@brickerp.com",
  "password": "Admin@123456"
}
```

**Response (200 OK):**
```json
{
  "success": true,
  "message": "Login successful",
  "data": {
    "user": {
      "_id": "507f1f77bcf86cd799439011",
      "name": "Admin User",
      "email": "admin@brickerp.com",
      "role": "admin"
    },
    "token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
  }
}
```

---

## Refresh Token

**Endpoint:** `POST /api/v1/auth/refresh`

**Request Body:**
```json
{
  "refreshToken": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
}
```

**Response (200 OK):**
```json
{
  "success": true,
  "token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
}
```

---

## Get Current User Profile

**Endpoint:** `GET /api/v1/auth/me`  
**Access:** Authenticated (All roles)

**Headers:**
```
Authorization: Bearer YOUR_TOKEN
```

**Response (200 OK):**
```json
{
  "success": true,
  "data": {
    "_id": "507f1f77bcf86cd799439011",
    "name": "Admin User",
    "email": "admin@brickerp.com",
    "role": "admin",
    "active": true
  }
}
```

---

## Update User Profile

**Endpoint:** `PUT /api/v1/auth/me`  
**Access:** Authenticated (All roles)

**Request Body:**
```json
{
  "name": "Updated Name",
  "email": "newemail@brick-erp.com"
}
```

**Response (200 OK):**
```json
{
  "success": true,
  "message": "Profile updated successfully",
  "data": {
    "_id": "507f1f77bcf86cd799439011",
    "name": "Updated Name",
    "email": "newemail@brick-erp.com"
  }
}
```

---

## Change Password

**Endpoint:** `PUT /api/v1/auth/change-password`  
**Access:** Authenticated (All roles)

**Request Body:**
```json
{
  "oldPassword": "Admin@123456",
  "newPassword": "NewPassword@123"
}
```

**Response (200 OK):**
```json
{
  "success": true,
  "message": "Password changed successfully"
}
```

---

## User Logout

**Endpoint:** `POST /api/v1/auth/logout`  
**Access:** Authenticated (All roles)

**Response (200 OK):**
```json
{
  "success": true,
  "message": "Logged out successfully"
}
```

---

# 2️⃣ CATALOG MODULE (14 Endpoints)

## Get All Categories (Paginated)

**Endpoint:** `GET /api/v1/catalog/categories`  
**Access:** Public

**Query Parameters:**
```
?page=1&limit=20&search=brick&parentId=507f1f77bcf86cd799439013
```

**Response (200 OK):**
```json
{
  "success": true,
  "data": [
    {
      "_id": "507f1f77bcf86cd799439013",
      "name": "Bricks",
      "description": "All types of bricks",
      "sortOrder": 1,
      "active": true
    }
  ],
  "pagination": {
    "currentPage": 1,
    "pageSize": 20,
    "totalCount": 150,
    "totalPages": 8,
    "hasNextPage": true
  }
}
```

---

## Get Category Tree

**Endpoint:** `GET /api/v1/catalog/categories/tree`  
**Access:** Public

**Response (200 OK):**
```json
{
  "success": true,
  "data": [
    {
      "_id": "507f1f77bcf86cd799439013",
      "name": "Bricks",
      "children": [
        {
          "_id": "507f1f77bcf86cd799439014",
          "name": "Red Bricks",
          "children": []
        }
      ]
    }
  ]
}
```

---

## Get Single Category

**Endpoint:** `GET /api/v1/catalog/categories/:id`  
**Access:** Public

---

## Create Category

**Endpoint:** `POST /api/v1/catalog/categories`  
**Access:** Authenticated (Management role)

**Request Body:**
```json
{
  "name": "Hollow Bricks",
  "description": "Hollow/lightweight bricks",
  "parentId": "507f1f77bcf86cd799439013",
  "sortOrder": 3,
  "active": true
}
```

---

## Update Category

**Endpoint:** `PUT /api/v1/catalog/categories/:id`  
**Access:** Authenticated (Management role)

---

## Delete Category

**Endpoint:** `DELETE /api/v1/catalog/categories/:id`  
**Access:** Authenticated (Management role)

---

## Get All Tags

**Endpoint:** `GET /api/v1/catalog/tags`  
**Access:** Public

**Query Parameters:**
```
?page=1&limit=20&search=premium&popular=true
```

---

## Create Tag

**Endpoint:** `POST /api/v1/catalog/tags`  
**Access:** Authenticated (Management role)

**Request Body:**
```json
{
  "name": "Durable",
  "color": "#3357FF"
}
```

---

## Update Tag

**Endpoint:** `PUT /api/v1/catalog/tags/:id`  
**Access:** Authenticated (Management role)

---

## Delete Tag

**Endpoint:** `DELETE /api/v1/catalog/tags/:id`  
**Access:** Authenticated (Management role)

---

## Get All Items

**Endpoint:** `GET /api/v1/catalog/items`  
**Access:** Public

**Query Parameters:**
```
?page=1&limit=20&search=red&categoryId=507f1f77bcf86cd799439013&costType=fixed
```

**Response (200 OK):**
```json
{
  "success": true,
  "data": [
    {
      "_id": "507f1f77bcf86cd79943901a",
      "name": "Red Brick (9x4.5x3)",
      "sku": "RB-001",
      "categoryId": "507f1f77bcf86cd799439013",
      "costType": "fixed",
      "costValue": 450,
      "unit": "pieces"
    }
  ]
}
```

---

## Create Item

**Endpoint:** `POST /api/v1/catalog/items`  
**Access:** Authenticated (Procurement Team)

**Request Body:**
```json
{
  "name": "White Brick (9x4.5x3)",
  "sku": "WB-001",
  "categoryId": "507f1f77bcf86cd799439013",
  "costType": "fixed",
  "costValue": 550,
  "unit": "pieces"
}
```

---

## Update Item

**Endpoint:** `PUT /api/v1/catalog/items/:id`  
**Access:** Authenticated (Procurement Team)

---

## Delete Item

**Endpoint:** `DELETE /api/v1/catalog/items/:id`  
**Access:** Authenticated (Management role)

---

# 3️⃣ PROCUREMENT MODULE (13 Endpoints)

## Get All Vendors

**Endpoint:** `GET /api/v1/procurement/vendors`  
**Access:** Authenticated

**Response (200 OK):**
```json
{
  "success": true,
  "data": [
    {
      "_id": "507f1f77bcf86cd79943901d",
      "name": "ABC Brick Company",
      "contactPerson": "John Smith",
      "email": "contact@abc-bricks.com",
      "phone": "+1-234-567-8900",
      "city": "City",
      "active": true
    }
  ]
}
```

---

## Get Single Vendor

**Endpoint:** `GET /api/v1/procurement/vendors/:id`  
**Access:** Authenticated

---

## Create Vendor

**Endpoint:** `POST /api/v1/procurement/vendors`  
**Access:** Authenticated (Procurement Team)

**Request Body:**
```json
{
  "name": "XYZ Brick Suppliers",
  "contactPerson": "Jane Doe",
  "email": "jane@xyz-bricks.com",
  "phone": "+1-987-654-3210",
  "address": "456 Trade Lane",
  "city": "City",
  "state": "State",
  "pinCode": "54321"
}
```

---

## Update Vendor

**Endpoint:** `PUT /api/v1/procurement/vendors/:id`  
**Access:** Authenticated (Procurement Team)

---

## Delete Vendor

**Endpoint:** `DELETE /api/v1/procurement/vendors/:id`  
**Access:** Authenticated (Management)

---

## Get All Estimates

**Endpoint:** `GET /api/v1/procurement/estimates`  
**Access:** Authenticated

**Query Parameters:**
```
?page=1&limit=20&status=approved
```

**Response (200 OK):**
```json
{
  "success": true,
  "data": [
    {
      "_id": "507f1f77bcf86cd79943901f",
      "estimateNumber": "EST-2026-001",
      "vendorId": "507f1f77bcf86cd79943901d",
      "totalAmount": 4500000,
      "status": "approved"
    }
  ]
}
```

---

## Create Estimate

**Endpoint:** `POST /api/v1/procurement/estimates`  
**Access:** Authenticated (Procurement Team)

**Request Body:**
```json
{
  "vendorId": "507f1f77bcf86cd79943901d",
  "items": [
    {
      "itemId": "507f1f77bcf86cd79943901a",
      "quantity": 10000,
      "unitPrice": 450
    }
  ],
  "tax": 405000,
  "notes": "Quote for Q1 2026"
}
```

---

## Approve Estimate

**Endpoint:** `POST /api/v1/procurement/estimates/:id/approve`  
**Access:** Authenticated (Management)

---

## Convert Estimate to PO

**Endpoint:** `POST /api/v1/procurement/estimates/:id/convert-to-po`  
**Access:** Authenticated (Procurement Team)

**Response (201 Created):**
```json
{
  "success": true,
  "message": "Purchase order created successfully",
  "data": {
    "_id": "507f1f77bcf86cd799439021",
    "poNumber": "PO-2026-001"
  }
}
```

---

## Get All Purchase Orders

**Endpoint:** `GET /api/v1/procurement/purchase-orders`  
**Access:** Authenticated

**Query Parameters:**
```
?page=1&limit=20&status=confirmed
```

---

## Create Purchase Order

**Endpoint:** `POST /api/v1/procurement/purchase-orders`  
**Access:** Authenticated (Procurement Team)

**Request Body:**
```json
{
  "vendorId": "507f1f77bcf86cd79943901e",
  "items": [
    {
      "itemId": "507f1f77bcf86cd79943901b",
      "quantity": 5000,
      "unitPrice": 575
    }
  ],
  "tax": 200500
}
```

---

## Approve Purchase Order

**Endpoint:** `POST /api/v1/procurement/purchase-orders/:id/approve`  
**Access:** Authenticated (Management)

---

## Cancel Purchase Order

**Endpoint:** `POST /api/v1/procurement/purchase-orders/:id/cancel`  
**Access:** Authenticated (Management)

---

# 4️⃣ INVENTORY MODULE (15 Endpoints)

## Get All Warehouses

**Endpoint:** `GET /api/v1/inventory/warehouses`  
**Access:** Authenticated

**Response (200 OK):**
```json
{
  "success": true,
  "data": [
    {
      "_id": "507f1f77bcf86cd799439023",
      "name": "Main Warehouse",
      "location": "Central City",
      "capacity": 100000,
      "type": "main",
      "manager": "warehouse@brick-erp.com"
    }
  ]
}
```

---

## Get Single Warehouse

**Endpoint:** `GET /api/v1/inventory/warehouses/:id`  
**Access:** Authenticated

---

## Create Warehouse

**Endpoint:** `POST /api/v1/inventory/warehouses`  
**Access:** Authenticated (Warehouse Team)

**Request Body:**
```json
{
  "name": "Secondary Warehouse",
  "location": "North City",
  "capacity": 50000,
  "type": "secondary",
  "address": "456 Storage Street",
  "manager": "warehouse2@brick-erp.com"
}
```

---

## Update Warehouse

**Endpoint:** `PUT /api/v1/inventory/warehouses/:id`  
**Access:** Authenticated (Warehouse Team)

---

## Delete Warehouse

**Endpoint:** `DELETE /api/v1/inventory/warehouses/:id`  
**Access:** Authenticated (Management)

---

## Get All Stock Levels

**Endpoint:** `GET /api/v1/inventory/stock`  
**Access:** Authenticated

**Query Parameters:**
```
?page=1&limit=20&lowStock=true
```
(To filter only items flagged as low stock.)

---

## Get Stock by Item

**Endpoint:** `GET /api/v1/inventory/stock/item/:itemId`  
**Access:** Authenticated

---


## Get Low Stock Alerts

**Endpoint:** `GET /api/v1/inventory/stock/low-stock`  
**Access:** Authenticated

**Response (200 OK):**
```json
{
  "success": true,
  "data": [
    {
      "itemId": "507f1f77bcf86cd79943901b",
      "itemName": "White Brick",
      "currentQuantity": 6000,
      "reorderLevel": 5000,
      "status": "LOW"
    }
  ]
}
```

---

## Adjust Stock

**Endpoint:** `POST /api/v1/inventory/stock/adjust`  
**Access:** Authenticated (Warehouse Team)

**Request Body:**
```json
{
  "itemId": "507f1f77bcf86cd79943901a",
  "adjustmentQty": -5000,
  "reason": "Damage during handling"
}
```

---

## Get All Goods Receipts

**Endpoint:** `GET /api/v1/inventory/goods-receipts`  
**Access:** Authenticated

**Query Parameters:**
```
?page=1&limit=20&status=accepted
```

---

## Create Goods Receipt

**Endpoint:** `POST /api/v1/inventory/goods-receipts`  
**Access:** Authenticated (Warehouse Team)

**Request Body:**
```json
{
  "poId": "507f1f77bcf86cd799439021",
  "warehouseId": "507f1f77bcf86cd799439023",
  "items": [
    {
      "itemId": "507f1f77bcf86cd79943901a",
      "receivedQuantity": 10000,
      "damageQuantity": 0
    }
  ],
  "notes": "All items received in good condition"
}
```

---

## Accept Goods Receipt

**Endpoint:** `POST /api/v1/inventory/goods-receipts/:id/accept`  
**Access:** Authenticated (Warehouse Team)

**Response (200 OK):**
```json
{
  "success": true,
  "message": "Goods receipt accepted successfully",
  "data": {
    "status": "accepted",
    "message": "Stock has been added to warehouse"
  }
}
```

---

## Get All Work Completions

**Endpoint:** `GET /api/v1/inventory/work-completions`  
**Access:** Authenticated

---

## Create Work Completion

**Endpoint:** `POST /api/v1/inventory/work-completions`  
**Access:** Authenticated (Production Team)

**Request Body:**
```json
{
  "batchId": "507f1f77bcf86cd79943902a",
  "quantity": 50000,
  "notes": "Batch production completed"
}
```

---

## Approve Work Completion

**Endpoint:** `POST /api/v1/inventory/work-completions/:id/approve`  
**Access:** Authenticated (Management)

---

# 5️⃣ MANUFACTURING MODULE (15 Endpoints)

## Get All Kilns

**Endpoint:** `GET /api/v1/manufacturing/kilns`  
**Access:** Authenticated

**Response (200 OK):**
```json
{
  "success": true,
  "data": [
    {
      "_id": "507f1f77bcf86cd79943902b",
      "name": "Kiln-01",
      "type": "Bull's Trench",
      "capacity": 100000,
      "currentLoad": 0,
      "status": "idle",
      "efficiency": 85.5
    }
  ]
}
```

---

## Get Available Kilns

**Endpoint:** `GET /api/v1/manufacturing/kilns/available`  
**Access:** Authenticated

**Response (200 OK):**
```json
{
  "success": true,
  "data": [
    {
      "_id": "507f1f77bcf86cd79943902b",
      "name": "Kiln-01",
      "availableCapacity": 100000,
      "type": "Bull's Trench"
    }
  ]
}
```

---

## Get Single Kiln

**Endpoint:** `GET /api/v1/manufacturing/kilns/:id`  
**Access:** Authenticated

---

## Create Kiln

**Endpoint:** `POST /api/v1/manufacturing/kilns`  
**Access:** Authenticated (Production Team)

**Request Body:**
```json
{
  "name": "Kiln-02",
  "type": "Bull's Trench",
  "capacity": 80000,
  "location": "Production Area-02",
  "fuelType": "coal",
  "efficiency": 80.0
}
```

---

## Update Kiln

**Endpoint:** `PUT /api/v1/manufacturing/kilns/:id`  
**Access:** Authenticated (Production Team)

---

## Get All Batches

**Endpoint:** `GET /api/v1/manufacturing/batches`  
**Access:** Authenticated

**Query Parameters:**
```
?page=1&limit=20&status=kiln
```

**Status Values:** draft, production, kiln, completed, archived

---

## Get Active Batches

**Endpoint:** `GET /api/v1/manufacturing/batches/active`  
**Access:** Authenticated

**Response (200 OK):**
```json
{
  "success": true,
  "data": [
    {
      "_id": "507f1f77bcf86cd79943902a",
      "batchNumber": "BATCH-2026-001",
      "quantity": 50000,
      "status": "kiln",
      "progress": 65
    }
  ]
}
```

---

## Get Single Batch

**Endpoint:** `GET /api/v1/manufacturing/batches/:id`  
**Access:** Authenticated

---

## Create Batch

**Endpoint:** `POST /api/v1/manufacturing/batches`  
**Access:** Authenticated (Production Team)

**Request Body:**
```json
{
  "quantity": 50000,
  "brickType": "Red Brick (9x4.5x3)",
  "notes": "First batch of Q1"
}
```

---

## Start Batch Production

**Endpoint:** `POST /api/v1/manufacturing/batches/:id/start`  
**Access:** Authenticated (Production Team)

---

## Move Batch to Kiln

**Endpoint:** `POST /api/v1/manufacturing/batches/:id/move-to-kiln`  
**Access:** Authenticated (Production Team)

**Request Body:**
```json
{
  "kilnId": "507f1f77bcf86cd79943902b"
}
```

---

## Complete Batch

**Endpoint:** `POST /api/v1/manufacturing/batches/:id/complete`  
**Access:** Authenticated (Production Team)

---

## Add Labour Entry

**Endpoint:** `POST /api/v1/manufacturing/batches/:id/labour`  
**Access:** Authenticated (Production Team)

**Request Body:**
```json
{
  "workers": 10,
  "days": 14,
  "rate": 40000
}
```

---

## Add Raw Material Entry

**Endpoint:** `POST /api/v1/manufacturing/batches/:id/raw-materials`  
**Access:** Authenticated (Production Team)

**Request Body:**
```json
{
  "materialId": "507f1f77bcf86cd79943901a",
  "quantity": 50000,
  "cost": 22500000
}
```

---

# 6️⃣ LOGISTICS MODULE (10 Endpoints)

## Get All Trips

**Endpoint:** `GET /api/v1/logistics/trips`  
**Access:** Authenticated

**Query Parameters:**
```
?page=1&limit=20&status=delivered
```

**Status Values:** draft, scheduled, dispatched, delivered, completed, cancelled

**Response (200 OK):**
```json
{
  "success": true,
  "data": [
    {
      "_id": "507f1f77bcf86cd79943902d",
      "tripNumber": "TRIP-2026-001",
      "destination": "Customer City",
      "distanceKm": 150,
      "status": "delivered",
      "bricks": 50000
    }
  ]
}
```

---

## Get Today's Trips

**Endpoint:** `GET /api/v1/logistics/trips/today`  
**Access:** Authenticated

**Response (200 OK):**
```json
{
  "success": true,
  "data": [
    {
      "_id": "507f1f77bcf86cd79943902d",
      "tripNumber": "TRIP-2026-001",
      "destination": "Customer City",
      "status": "dispatched",
      "vehicleNumber": "ABC-1234",
      "driverName": "John Driver"
    }
  ]
}
```

---

## Get Trip Statistics

**Endpoint:** `GET /api/v1/logistics/trips/stats`  
**Access:** Authenticated (Management)

**Query Parameters:**
```
?period=daily
```

**Response (200 OK):**
```json
{
  "success": true,
  "data": {
    "totalTrips": 5,
    "completedTrips": 4,
    "totalBricksMoved": 250000,
    "totalDistance": 750,
    "onTimeDelivery": "80%"
  }
}
```

---

## Get Single Trip

**Endpoint:** `GET /api/v1/logistics/trips/:id`  
**Access:** Authenticated

---

## Create Trip

**Endpoint:** `POST /api/v1/logistics/trips`  
**Access:** Authenticated (Logistics Manager)

**Request Body:**
```json
{
  "destination": "New Customer City",
  "destinationAddress": "456 New Road",
  "distanceKm": 200,
  "bricks": 60000,
  "vehicleNumber": "XYZ-5678",
  "driverName": "Jane Driver",
  "transportCost": 20000
}
```

---

## Dispatch Trip

**Endpoint:** `POST /api/v1/logistics/trips/:id/dispatch`  
**Access:** Authenticated (Logistics Manager)

**Response (200 OK):**
```json
{
  "success": true,
  "message": "Trip dispatched successfully",
  "data": {
    "status": "dispatched",
    "dispatchDate": "2026-02-03T13:20:00Z"
  }
}
```

---

## Mark Trip Delivered

**Endpoint:** `POST /api/v1/logistics/trips/:id/deliver`  
**Access:** Authenticated (Logistics Manager, Driver)

**Request Body (Optional):**
```json
{
  "deliveryNotes": "Successfully delivered to customer",
  "receivedBy": "Customer Name"
}
```

---

## Complete Trip

**Endpoint:** `POST /api/v1/logistics/trips/:id/complete`  
**Access:** Authenticated (Logistics Manager)

---

# 7️⃣ PAYMENT MODULE (9 Endpoints)

## 7.1 Get All Payments

**Endpoint:** `GET /api/v1/payments`  
**Access:** Authenticated (Accountant, Procurement Manager, Management)

**Query Parameters:**
- `page` - Page number (default: 1)
- `limit` - Items per page (default: 10)
- `search` - Search by payment number, PO number, transaction ID
- `paymentStatus` - Filter by status (PENDING, PROCESSING, COMPLETED, FAILED, CANCELLED, REFUNDED)
- `paymentMethod` - Filter by method (CASH, CHEQUE, NEFT, RTGS, UPI, etc.)
- `vendorId` - Filter by vendor
- `purchaseOrderId` - Filter by purchase order
- `fromDate` - Start date (YYYY-MM-DD)
- `toDate` - End date (YYYY-MM-DD)

**Headers:**
```
Authorization: Bearer YOUR_JWT_TOKEN
```

**Response (200 OK):**
```json
{
  "success": true,
  "data": {
    "docs": [
      {
        "_id": "65abc123def456789",
        "paymentNumber": "PAY-2024-000001",
        "poNumber": "PO-2024-000123",
        "purchaseOrderId": {
          "_id": "65abc123def456780",
          "poNumber": "PO-2024-000123",
          "netAmount": 50000000,
          "status": "APPROVED"
        },
        "vendorId": {
          "_id": "65abc123def456781",
          "name": "ABC Suppliers",
          "code": "VEN-001"
        },
        "paymentDate": "2024-02-04T10:00:00.000Z",
        "paymentMethod": "NEFT",
        "paymentStatus": "COMPLETED",
        "amount": 25000000,
        "amountInRupees": 250000,
        "currency": "INR",
        "transactionId": "TXN123456789",
        "referenceNumber": "REF-2024-001",
        "bankName": "HDFC Bank",
        "remarks": "50% advance payment",
        "processedBy": {
          "_id": "65abc123def456782",
          "firstName": "John",
          "lastName": "Doe"
        },
        "approvedBy": {
          "_id": "65abc123def456783",
          "firstName": "Admin",
          "lastName": "User"
        },
        "approvedAt": "2024-02-04T11:00:00.000Z",
        "createdAt": "2024-02-04T10:00:00.000Z",
        "updatedAt": "2024-02-04T11:00:00.000Z"
      }
    ],
    "totalDocs": 1,
    "limit": 10,
    "page": 1,
    "totalPages": 1,
    "hasNextPage": false,
    "hasPrevPage": false
  }
}
```

---

## 7.2 Get Single Payment

**Endpoint:** `GET /api/v1/payments/:id`  
**Access:** Authenticated (Accountant, Procurement Manager, Management)

**Headers:**
```
Authorization: Bearer YOUR_JWT_TOKEN
```

**Response (200 OK):**
```json
{
  "success": true,
  "data": {
    "_id": "65abc123def456789",
    "paymentNumber": "PAY-2024-000001",
    "purchaseOrderId": {
      "_id": "65abc123def456780",
      "poNumber": "PO-2024-000123",
      "netAmount": 50000000,
      "items": []
    },
    "vendorId": {
      "_id": "65abc123def456781",
      "name": "ABC Suppliers",
      "contact": {
        "contactPerson": "Mr. Sharma",
        "phone": "+91-9876543210"
      }
    },
    "paymentDate": "2024-02-04T10:00:00.000Z",
    "paymentMethod": "NEFT",
    "paymentStatus": "COMPLETED",
    "amount": 25000000,
    "transactionId": "TXN123456789",
    "referenceNumber": "REF-2024-001",
    "bankName": "HDFC Bank",
    "attachments": [
      {
        "name": "payment-receipt.pdf",
        "url": "https://storage.example.com/receipts/receipt-001.pdf",
        "type": "application/pdf"
      }
    ],
    "remarks": "50% advance payment"
  }
}
```

---

## 7.3 Create Payment

**Endpoint:** `POST /api/v1/payments`  
**Access:** Authenticated (Accountant, Management)

**Headers:**
```
Content-Type: application/json
Authorization: Bearer YOUR_JWT_TOKEN
```

**Request Body:**
```json
{
  "purchaseOrderId": "65abc123def456780",
  "paymentDate": "2024-02-04T10:00:00.000Z",
  "paymentMethod": "NEFT",
  "amount": 250000,
  "transactionId": "TXN123456789",
  "referenceNumber": "REF-2024-001",
  "bankName": "HDFC Bank",
  "remarks": "50% advance payment",
  "attachments": [
    {
      "name": "payment-receipt.pdf",
      "url": "https://storage.example.com/receipts/receipt-001.pdf",
      "type": "application/pdf"
    }
  ]
}
```

**Payment Methods:**
- `CASH` - Cash payment
- `CHEQUE` - Cheque payment
- `NEFT` - National Electronic Funds Transfer
- `RTGS` - Real Time Gross Settlement
- `UPI` - Unified Payments Interface
- `IMPS` - Immediate Payment Service
- `BANK_TRANSFER` - Direct bank transfer
- `CREDIT_CARD` - Credit card
- `DEBIT_CARD` - Debit card
- `OTHER` - Other payment methods

**Response (201 Created):**
```json
{
  "success": true,
  "message": "Payment created successfully",
  "data": {
    "_id": "65abc123def456789",
    "paymentNumber": "PAY-2024-000001",
    "poNumber": "PO-2024-000123",
    "purchaseOrderId": "65abc123def456780",
    "vendorId": "65abc123def456781",
    "paymentDate": "2024-02-04T10:00:00.000Z",
    "paymentMethod": "NEFT",
    "paymentStatus": "PENDING",
    "amount": 25000000,
    "amountInRupees": 250000,
    "transactionId": "TXN123456789",
    "referenceNumber": "REF-2024-001",
    "bankName": "HDFC Bank",
    "remarks": "50% advance payment"
  }
}
```

**Validation Rules:**
- Purchase order must exist and be approved
- Amount cannot exceed remaining PO balance
- Payment method is required
- Amount must be greater than 0

---

## 7.4 Update Payment

**Endpoint:** `PATCH /api/v1/payments/:id`  
**Access:** Authenticated (Accountant, Management)

**Headers:**
```
Content-Type: application/json
Authorization: Bearer YOUR_JWT_TOKEN
```

**Request Body (partial update):**
```json
{
  "paymentMethod": "RTGS",
  "transactionId": "TXN987654321",
  "remarks": "Updated payment details"
}
```

**Response (200 OK):**
```json
{
  "success": true,
  "message": "Payment updated successfully",
  "data": {
    // Updated payment object
  }
}
```

**Note:** Cannot modify amount of completed payments.

---

## 7.5 Update Payment Status

**Endpoint:** `PATCH /api/v1/payments/:id/status`  
**Access:** Authenticated (Accountant, Management)

**Headers:**
```
Content-Type: application/json
Authorization: Bearer YOUR_JWT_TOKEN
```

**Request Body:**
```json
{
  "paymentStatus": "COMPLETED",
  "remarks": "Payment verified and approved"
}
```

**Payment Statuses:**
- `PENDING` - Payment initiated but not processed
- `PROCESSING` - Payment in progress
- `COMPLETED` - Payment successfully completed
- `FAILED` - Payment failed
- `CANCELLED` - Payment cancelled
- `REFUNDED` - Payment refunded

**Response (200 OK):**
```json
{
  "success": true,
  "message": "Payment status updated",
  "data": {
    "_id": "65abc123def456789",
    "paymentNumber": "PAY-2024-000001",
    "paymentStatus": "COMPLETED",
    "approvedBy": "65abc123def456783",
    "approvedAt": "2024-02-04T11:00:00.000Z"
  }
}
```

---

## 7.6 Delete Payment

**Endpoint:** `DELETE /api/v1/payments/:id`  
**Access:** Authenticated (Accountant, Management)

**Headers:**
```
Authorization: Bearer YOUR_JWT_TOKEN
```

**Response (200 OK):**
```json
{
  "success": true,
  "message": "Payment deleted successfully"
}
```

**Note:** Cannot delete completed payments. Cancel them first.

---

## 7.7 Get Payments by Purchase Order

**Endpoint:** `GET /api/v1/payments/purchase-order/:poId`  
**Access:** Authenticated (Accountant, Procurement Manager, Management)

**Headers:**
```
Authorization: Bearer YOUR_JWT_TOKEN
```

**Response (200 OK):**
```json
{
  "success": true,
  "data": {
    "poAmount": 50000000,
    "totalPaid": 25000000,
    "totalPending": 10000000,
    "totalFailed": 0,
    "remainingAmount": 25000000,
    "payments": [
      {
        "_id": "65abc123def456789",
        "paymentNumber": "PAY-2024-000001",
        "paymentDate": "2024-02-04T10:00:00.000Z",
        "paymentMethod": "NEFT",
        "paymentStatus": "COMPLETED",
        "amount": 25000000,
        "amountInRupees": 250000
      }
    ]
  }
}
```

---

## 7.8 Get Payments by Vendor

**Endpoint:** `GET /api/v1/payments/vendor/:vendorId`  
**Access:** Authenticated (Accountant, Management)

**Headers:**
```
Authorization: Bearer YOUR_JWT_TOKEN
```

**Response (200 OK):**
```json
{
  "success": true,
  "data": {
    "vendor": {
      "id": "65abc123def456781",
      "name": "ABC Suppliers",
      "code": "VEN-001"
    },
    "payments": [
      {
        "_id": "65abc123def456789",
        "paymentNumber": "PAY-2024-000001",
        "purchaseOrderId": {
          "poNumber": "PO-2024-000123",
          "netAmount": 50000000
        },
        "paymentDate": "2024-02-04T10:00:00.000Z",
        "amount": 25000000
      }
    ]
  }
}
```

---

## 7.9 Get Payment Statistics

**Endpoint:** `GET /api/v1/payments/stats`  
**Access:** Authenticated (Accountant, Management)

**Headers:**
```
Authorization: Bearer YOUR_JWT_TOKEN
```

**Response (200 OK):**
```json
{
  "success": true,
  "data": {
    "byStatus": [
      {
        "_id": "COMPLETED",
        "count": 15,
        "totalAmount": 500000000
      },
      {
        "_id": "PENDING",
        "count": 5,
        "totalAmount": 100000000
      }
    ],
    "byMethod": [
      {
        "_id": "NEFT",
        "count": 10,
        "totalAmount": 300000000
      },
      {
        "_id": "RTGS",
        "count": 5,
        "totalAmount": 200000000
      }
    ]
  }
}
```

---

# 8️⃣ REPORTS MODULE (9 Endpoints)

## Dashboard Overview

**Endpoint:** `GET /api/v1/reports/dashboard`  
**Access:** Authenticated

**Response:** Summary of key metrics

---

## Stock Levels Report

**Endpoint:** `GET /api/v1/reports/stock/levels`  
**Access:** Authenticated

---

## Stock Movement Report

**Endpoint:** `GET /api/v1/reports/stock/movement`  
**Access:** Authenticated

---

## Open Purchase Orders

**Endpoint:** `GET /api/v1/reports/purchase-orders/open`  
**Access:** Authenticated

---

## Production Summary

**Endpoint:** `GET /api/v1/reports/production/summary`  
**Access:** Authenticated

---

## Kiln Utilization

**Endpoint:** `GET /api/v1/reports/kiln/utilization`  
**Access:** Authenticated

---

## Vendor Performance

**Endpoint:** `GET /api/v1/reports/vendor/performance`  
**Access:** Authenticated

---

## Transport Analytics

**Endpoint:** `GET /api/v1/reports/transport/analytics`  
**Access:** Authenticated

---

## Financial Summary

**Endpoint:** `GET /api/v1/reports/financial/summary`  
**Access:** Authenticated

---

# 8️⃣ EXCEL MODULE (10 Endpoints)

## Get Import Templates

**Endpoint:** `GET /api/v1/excel/templates`  
**Access:** Authenticated

---

## Get Item Template

**Endpoint:** `GET /api/v1/excel/templates/items`  
**Access:** Authenticated

---

## Get Vendor Template

**Endpoint:** `GET /api/v1/excel/templates/vendors`  
**Access:** Authenticated

---

## Import Items

**Endpoint:** `POST /api/v1/excel/import/items`  
**Access:** Authenticated (Procurement Team)

**Request:** Form data with Excel file

---

## Import Vendors

**Endpoint:** `POST /api/v1/excel/import/vendors`  
**Access:** Authenticated (Procurement Team)

---

## Export Items

**Endpoint:** `GET /api/v1/excel/export/items`  
**Access:** Authenticated

**Response:** Excel file download

---

## Export Stock

**Endpoint:** `GET /api/v1/excel/export/stock`  
**Access:** Authenticated

---

## Export Vendors

**Endpoint:** `GET /api/v1/excel/export/vendors`  
**Access:** Authenticated

---

## Export Categories

**Endpoint:** `GET /api/v1/excel/export/categories`  
**Access:** Authenticated

---

## Export Purchase Orders

**Endpoint:** `GET /api/v1/excel/export/purchase-orders`  
**Access:** Authenticated

---

# 9️⃣ CALCULATIONS MODULE (8 Endpoints)

## Calculate Labour Cost

**Endpoint:** `POST /api/v1/calc/labour`  
**Access:** Authenticated

**Request Body:**
```json
{
  "workers": 10,
  "days": 21,
  "rate": 40000
}
```

**Response:**
```json
{
  "success": true,
  "data": {
    "workers": 10,
    "days": 21,
    "ratePerDay": 40000,
    "totalWorkerDays": 210,
    "totalCost": 8400000
  }
}
```

---

## Calculate Brick Labour Cost

**Endpoint:** `POST /api/v1/calc/brick-labour`  
**Access:** Authenticated

**Request Body:**
```json
{
  "quantity": 1000,
  "ratePerThousand": 550
}
```

---

## Calculate Transport Cost

**Endpoint:** `POST /api/v1/calc/transport`  
**Access:** Authenticated

**Request Body:**
```json
{
  "distanceKm": 150
}
```

**Response:**
```json
{
  "success": true,
  "data": {
    "distanceKm": 150,
    "costPerKm": 100,
    "totalCost": 15000
  }
}
```

---

## Calculate Kiln Time

**Endpoint:** `POST /api/v1/calc/kiln-time`  
**Access:** Authenticated

**Request Body:**
```json
{
  "kilnType": "Bull's Trench",
  "quantity": 50000
}
```

---

## Calculate Cement Cost

**Endpoint:** `POST /api/v1/calc/cement`  
**Access:** Authenticated

**Request Body:**
```json
{
  "bags": 10,
  "ratePerBag": 350
}
```

---

## Calculate Sand Cost

**Endpoint:** `POST /api/v1/calc/sand`  
**Access:** Authenticated

**Request Body:**
```json
{
  "cft": 100,
  "ratePerCFT": 55
}
```

---

## Calculate Gypsum Cost

**Endpoint:** `POST /api/v1/calc/gypsum`  
**Access:** Authenticated

**Request Body:**
```json
{
  "bags": 10,
  "ratePerBag": 420
}
```

---

## Calculate Full Estimate

**Endpoint:** `POST /api/v1/calc/estimate`  
**Access:** Authenticated

**Request Body:**
```json
{
  "labourDays": 21,
  "workers": 10,
  "cementBags": 10,
  "sandCFT": 100,
  "gypsumBags": 10,
  "brickQuantity": 1000,
  "transportDistance": 150
}
```

---

---

# ✅ Error Handling

**Error Response Structure:**
```json
{
  "success": false,
  "message": "Error message",
  "errors": ["Field error 1", "Field error 2"]
}
```

**Common Status Codes:**

| Code | Meaning |
|------|---------|
| 200 | Success |
| 201 | Created |
| 400 | Bad Request / Validation Error |
| 401 | Unauthorized |
| 403 | Forbidden |
| 404 | Not Found |
| 500 | Server Error |

---

# 📞 API Documentation URLs

- **Swagger UI:** http://localhost:5000/api-docs
- **ReDoc:** http://localhost:5000/api-docs-html
- **OpenAPI JSON:** http://localhost:5000/api-docs.json

---

**Last Updated:** February 3, 2026  
**Status:** ✅ Fully Operational
