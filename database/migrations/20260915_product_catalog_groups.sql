USE petshop_db;

ALTER TABLE products
    ADD COLUMN product_group ENUM('Food', 'Shampoo', 'Other') NOT NULL DEFAULT 'Other' AFTER category;

UPDATE products
SET product_group = CASE
    WHEN product_name LIKE '%Shampoo%' THEN 'Shampoo'
    WHEN category LIKE '%Food%' THEN 'Food'
    ELSE 'Other'
END;
