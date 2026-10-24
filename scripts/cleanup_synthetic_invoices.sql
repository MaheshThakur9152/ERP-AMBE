-- Cleanup 50 synthetic test invoices from benchmark GATE-09
BEGIN;

DELETE FROM public.invoices 
WHERE id IN ('5c971583-d205-47b5-ab57-e032feb45213', '6094471d-40d9-405a-9e53-9aef519ff79b', '7bb7f7e9-1724-433e-bd1d-f28bf120b858', '00b942f0-5b49-4ff4-8273-506b58e95d16', 'ac6c0cbb-b953-4ce6-a075-af5b7d4d9313', '51ac679a-2745-4bcd-9a92-5f72d1309237', 'fcd5e701-5f24-4e2c-808a-e896efd58bb2', 'b19dd665-3193-4b68-8063-55fb916401d0', '9beb64ac-70e4-4c73-bf73-135af5fee507', '0ca2d64e-abe5-4fc7-b306-529c79b2704b', '650b1004-076e-4082-9682-b9741a1177c6', 'a7891f9c-7abb-4228-84f3-824eea619fc7', '8a6c694d-9447-4ef4-ad18-936f9ff4735d', 'f0ddbe4b-73b5-4352-b33e-17664c41c8da', '7c06f507-5210-4e74-ab3c-059b13eb4b75', '99c9f372-6c09-42df-975d-31f449014f6f', '994bebf0-98ba-4b64-b84b-3d856ad5459c', 'abec5b8a-5b49-4a8e-b237-7d91b9409ceb', 'ce081da2-b14e-4142-9df4-7282fd73b4da', '750899f6-8281-40e9-9e45-153ed49c3a86', 'af5ca29f-d2a1-453d-b00d-3e1ae46c4017', '106e0092-1c6c-4bbc-b209-bea6907bc4cc', '9abb4411-005c-4698-82a5-cbf340ad89ea', '00c3d602-17bc-4c1a-8f90-f0ea46fabf27', '18d35460-954a-4fbf-a829-e1ec369a8362', '5d6239b0-7e46-40f2-8fe3-181d99a82551', '6b957106-9c9e-4ab1-92f8-3d461329186a', 'f6b654e3-b056-43f7-883d-5c4f225656cf', '566a8bd1-d9b3-437c-a5a0-1bbf98a0ff38', '9ef7c809-69d6-43d3-8417-9cdd38e64013', '046770de-d1e5-4417-922d-404963157b07', '9fe0bcb8-8601-4ffb-82e7-a0e8ce69b610', 'a7ad93cd-1df0-42d9-9c9d-3f40590a40d4', 'd06b8697-f8e1-4a5d-81ba-5ace5e34706f', '58aef6d0-9dbd-47ca-a447-378c073b3c0f', '5ec18976-39b4-41fe-9bdc-028118b0baa2', '69e9f934-d579-446c-9aba-31b1e29a1b1d', 'ff4765fd-d673-4722-a70c-01917cfbc43a', '35a63a71-3f92-46cb-9400-9ad4a3e2cf1c', 'db241dee-9432-4b7e-b707-a2874a3a08d6', '79ccb558-7fca-4a40-a120-24c81b1181da', '060cc6ea-c078-483e-ba6e-e8fbd8db229a', '0bebbec2-d429-4a24-8b50-e4645fab4c91', 'e78b0def-b893-4294-8fc9-3bf81a5ee0a1', '1e2f3895-19c0-4841-89f7-5d40e5759a16', 'd72855b3-74fb-4255-8ce2-e93e49acc83c', '86a2180f-1678-45b4-9f6b-99b1f8161d93', '20339da2-3af0-46d0-a8af-f4155cc836b0', '6565a8b3-ed20-4ff9-824b-934fd72a4811', 'c160ad31-711d-4c90-a785-433cf3e229a7');

-- Resynchronize company invoice counters to actual genuine invoices
WITH max_tax AS (
  SELECT 
    company_id,
    MAX(SUBSTRING(invoice_no FROM '([0-9]+)$')::integer) AS max_num
  FROM public.invoices
  WHERE type = 'Tax Invoice'
    AND invoice_no ~ '([0-9]+)$'
  GROUP BY company_id
)
UPDATE public.companies c
SET tax_sequence = COALESCE(m.max_num, 0)
FROM max_tax m
WHERE c.id = m.company_id;

WITH max_proforma AS (
  SELECT 
    company_id,
    MAX(SUBSTRING(invoice_no FROM '([0-9]+)$')::integer) AS max_num
  FROM public.invoices
  WHERE type = 'Proforma Invoice'
    AND invoice_no ~ '([0-9]+)$'
  GROUP BY company_id
)
UPDATE public.companies c
SET proforma_sequence = COALESCE(m.max_num, 0)
FROM max_proforma m
WHERE c.id = m.company_id;

COMMIT;
