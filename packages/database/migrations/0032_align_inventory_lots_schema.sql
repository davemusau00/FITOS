-- Align the original lot table with the persisted repository contract.
ALTER TABLE inventory_lots
  ADD COLUMN IF NOT EXISTS purchase_order_id uuid REFERENCES purchase_orders(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS quantity_received numeric(12,3),
  ADD COLUMN IF NOT EXISTS unit_cost_minor integer DEFAULT 0,
  ADD COLUMN IF NOT EXISTS notes text,
  ADD COLUMN IF NOT EXISTS created_at timestamptz NOT NULL DEFAULT now();
UPDATE inventory_lots SET quantity_received = quantity_on_hand WHERE quantity_received IS NULL;
ALTER TABLE inventory_lots ALTER COLUMN quantity_received SET NOT NULL;
