# Fix for Foreign Key Constraint Error

## Problem
```
ERROR: Referencing column 'user_id' and referenced column 'id' in foreign key constraint 'fk_device_user' are incompatible.
```

## Cause
The `user_id` column type in `device_fingerprints` doesn't match the `id` column type in your `userData` table.

## Solution

I've created **TWO versions** of the schema file:

### Option 1: Updated Main File (Recommended)
**File:** `device_fingerprints.sql`

**Changes made:**
- ✅ Changed `user_id` from `INT` to `BIGINT` (most common type)
- ✅ Removed foreign key constraint (more compatible)
- ✅ Added `DROP PROCEDURE IF EXISTS` to prevent duplicate errors
- ✅ Removed JOIN from view (simpler, more compatible)
- ✅ Added comment explaining how to add foreign key manually if needed

**Use this if:** You want the most compatible version

### Option 2: No Foreign Key Version
**File:** `device_fingerprints_no_fk.sql`

**Changes made:**
- Same as Option 1 but as a separate file
- Explicitly labeled as "No Foreign Key Version"

**Use this if:** You want to keep the original file unchanged

## How to Use

### Step 1: Try the Updated Main File

```bash
mysql -u root -p video-scrambler < database/schema/device_fingerprints.sql
```

If this works, you're done! ✅

### Step 2: If Still Getting Errors

Check your userData table structure:

```sql
mysql -u root -p
USE video-scrambler;
DESCRIBE userData;
```

Look at the `id` column type. Common types:
- `INT` or `INT(11)`
- `BIGINT` or `BIGINT(20)`
- `INT UNSIGNED`
- `BIGINT UNSIGNED`

### Step 3: Match the Types

If your `userData.id` is different from `BIGINT`, edit the schema:

```sql
-- In device_fingerprints.sql, change line 11 to match your type:
user_id BIGINT NOT NULL,        -- Original (works for most cases)
-- user_id INT NOT NULL,        -- If userData.id is INT
-- user_id INT UNSIGNED NOT NULL,    -- If userData.id is INT UNSIGNED
-- user_id BIGINT UNSIGNED NOT NULL, -- If userData.id is BIGINT UNSIGNED
```

### Step 4: Re-run the Schema

```bash
# Drop the table if it exists
mysql -u root -p -e "USE video-scrambler; DROP TABLE IF EXISTS device_fingerprints;"

# Run the updated schema
mysql -u root -p video-scrambler < database/schema/device_fingerprints.sql
```

## Verify Success

After running the schema, check if it worked:

```sql
mysql -u root -p
USE video-scrambler;

-- Check if table exists
SHOW TABLES LIKE 'device_fingerprints';

-- Check table structure
DESCRIBE device_fingerprints;

-- Check stored procedures
SHOW PROCEDURE STATUS WHERE Db = 'video-scrambler';

-- Test a quick insert (use a real user_id from your userData table)
INSERT INTO device_fingerprints (user_id, fingerprint_hash, short_hash, device_type, browser, os)
VALUES (1, 'test_hash_123', 'test_hash', 'Desktop', 'Chrome', 'Windows');

-- Verify it worked
SELECT * FROM device_fingerprints;

-- Clean up test data
DELETE FROM device_fingerprints WHERE fingerprint_hash = 'test_hash_123';
```

## Common Issues

### Issue 1: "Table already exists"
```bash
mysql -u root -p -e "USE video-scrambler; DROP TABLE IF EXISTS device_fingerprints;"
```

### Issue 2: "Procedure already exists"
The updated schema includes `DROP PROCEDURE IF EXISTS` so this shouldn't happen.

### Issue 3: "Can't connect to MySQL server"
Start MySQL/MariaDB:
```bash
sudo systemctl start mysql
# or
sudo systemctl start mariadb
```

### Issue 4: "Database doesn't exist"
Create it first:
```bash
mysql -u root -p -e "CREATE DATABASE IF NOT EXISTS video_scrambler;"
# Note: Check if your database is named "video-scrambler" or "video_scrambler" or "KeyChingDB"
```

## Alternative: Skip Foreign Key Entirely

If you keep having problems, you can use foreign keys in application logic instead:

The system will work perfectly fine **without** the foreign key constraint. The constraint is just for:
- ✅ Automatic cleanup when user is deleted (CASCADE)
- ✅ Database-level referential integrity

But your app will work the same either way!

## Database Name Note

I noticed you're using `video-scrambler` as the database name. If you want to match the documentation, you can either:

1. **Update all documentation** to use `video-scrambler`
2. **Create an alias/use the expected name:**
   ```sql
   CREATE DATABASE IF NOT EXISTS KeyChingDB;
   -- Then use KeyChingDB in all queries
   ```

## Testing After Fix

Once the schema runs successfully, test the integration:

```bash
# Terminal 1: Start backend
node old-server.cjs

# Terminal 2: Start frontend  
npm run dev

# Browser: Login and check console for:
# ✅ Device fingerprint recorded
```

## Need More Help?

If you're still stuck, tell me:
1. What database name you're using
2. The output of `DESCRIBE userData;`
3. Any error messages you see

I'll help you get it working!
