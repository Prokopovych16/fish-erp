-- CreateIndex
CREATE INDEX "AuditLog_userId_createdAt_idx" ON "AuditLog"("userId", "createdAt");

-- CreateIndex
CREATE INDEX "AuditLog_action_createdAt_idx" ON "AuditLog"("action", "createdAt");

-- CreateIndex
CREATE INDEX "AuditLog_entityId_idx" ON "AuditLog"("entityId");

-- CreateIndex
CREATE INDEX "AuditLog_createdAt_idx" ON "AuditLog"("createdAt");

-- CreateIndex
CREATE INDEX "Client_isActive_idx" ON "Client"("isActive");

-- CreateIndex
CREATE INDEX "Client_name_idx" ON "Client"("name");

-- CreateIndex
CREATE INDEX "ClientPrice_clientId_form_idx" ON "ClientPrice"("clientId", "form");

-- CreateIndex
CREATE INDEX "Order_status_deletedAt_idx" ON "Order"("status", "deletedAt");

-- CreateIndex
CREATE INDEX "Order_form_deletedAt_idx" ON "Order"("form", "deletedAt");

-- CreateIndex
CREATE INDEX "Order_form_numberForm_idx" ON "Order"("form", "numberForm");

-- CreateIndex
CREATE INDEX "Order_clientId_idx" ON "Order"("clientId");

-- CreateIndex
CREATE INDEX "Order_createdAt_idx" ON "Order"("createdAt");

-- CreateIndex
CREATE INDEX "Order_completedAt_idx" ON "Order"("completedAt");

-- CreateIndex
CREATE INDEX "Order_status_completedAt_idx" ON "Order"("status", "completedAt");

-- CreateIndex
CREATE INDEX "Order_assignedToId_status_idx" ON "Order"("assignedToId", "status");

-- CreateIndex
CREATE INDEX "OrderDocument_orderId_idx" ON "OrderDocument"("orderId");

-- CreateIndex
CREATE INDEX "OrderItem_orderId_idx" ON "OrderItem"("orderId");

-- CreateIndex
CREATE INDEX "OrderItem_productId_idx" ON "OrderItem"("productId");

-- CreateIndex
CREATE INDEX "Product_isActive_idx" ON "Product"("isActive");

-- CreateIndex
CREATE INDEX "Product_name_idx" ON "Product"("name");

-- CreateIndex
CREATE INDEX "StockItem_warehouseId_productId_idx" ON "StockItem"("warehouseId", "productId");

-- CreateIndex
CREATE INDEX "StockItem_warehouseId_form_idx" ON "StockItem"("warehouseId", "form");

-- CreateIndex
CREATE INDEX "StockItem_productId_form_idx" ON "StockItem"("productId", "form");

-- CreateIndex
CREATE INDEX "StockItem_arrivedAt_idx" ON "StockItem"("arrivedAt");

-- CreateIndex
CREATE INDEX "StockMovement_warehouseId_createdAt_idx" ON "StockMovement"("warehouseId", "createdAt");

-- CreateIndex
CREATE INDEX "StockMovement_productId_createdAt_idx" ON "StockMovement"("productId", "createdAt");

-- CreateIndex
CREATE INDEX "StockMovement_type_createdAt_idx" ON "StockMovement"("type", "createdAt");

-- CreateIndex
CREATE INDEX "StockMovement_orderId_idx" ON "StockMovement"("orderId");

-- CreateIndex
CREATE INDEX "StockMovement_createdAt_idx" ON "StockMovement"("createdAt");

-- CreateIndex
CREATE INDEX "Supplier_isActive_idx" ON "Supplier"("isActive");

-- CreateIndex
CREATE INDEX "User_role_isActive_idx" ON "User"("role", "isActive");

-- CreateIndex
CREATE INDEX "User_email_idx" ON "User"("email");

-- CreateIndex
CREATE INDEX "Warehouse_type_isActive_idx" ON "Warehouse"("type", "isActive");
