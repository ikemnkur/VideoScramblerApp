require('dotenv').config();
const express = require('express');
const mysql = require('mysql2/promise');
const cors = require('cors');
const { v4: uuidv4 } = require('uuid');

const server = express();

// Database configuration
const dbConfig = {
  host: process.env.DB_HOST || 'localhost',
  user: process.env.DB_USER || 'root',
  password: process.env.DB_PASSWORD || '', // Update with your MySQL password
  database: process.env.DB_NAME || 'KeyChingDB',
  waitForConnections: true,
  connectionLimit: parseInt(process.env.DB_CONNECTION_LIMIT) || 10,
  queueLimit: 0
};

// Create connection pool
const pool = mysql.createPool(dbConfig);

// Middleware
server.use(cors());
server.use(express.json());
server.use(express.urlencoded({ extended: true }));

// Custom authentication route
server.post('/api/auth/login', async (req, res) => {
  try {
    const { username, password } = req.body;
    
    const [users] = await pool.execute(
      'SELECT * FROM userData WHERE username = ?', 
      [username]
    );
    
    const user = users[0];
    
    if (user && password === 'demo123') { // Simple demo password
      const userData = { ...user };
      delete userData.passwordHash; // Don't send password hash
      
      // Update last login
      await pool.execute(
        'UPDATE userData SET loginStatus = true, lastLogin = ? WHERE username = ?',
        [new Date(), username]
      );
      
      res.json({
        success: true,
        user: userData,
        token: `demo_token_${user.id}_${Date.now()}`
      });
    } else {
      res.status(401).json({ success: false, message: 'Invalid credentials' });
    }
  } catch (error) {
    console.error('Login error:', error);
    res.status(500).json({ success: false, message: 'Database error' });
  }
});

// Custom wallet balance route
server.get('/api/wallet/balance', async (req, res) => {
  try {
    const username = req.query.username || 'user_123'; // Default for demo
    
    const [wallets] = await pool.execute(
      'SELECT * FROM wallet WHERE username = ?',
      [username]
    );
    
    const [users] = await pool.execute(
      'SELECT credits FROM userData WHERE username = ?',
      [username]
    );
    
    const wallet = wallets[0];
    const user = users[0];
    
    if (wallet && user) {
      res.json({
        balance: wallet.balance,
        credits: user.credits,
        totalEarned: wallet.totalEarned,
        totalSpent: wallet.totalSpent,
        pendingCredits: wallet.pendingCredits
      });
    } else {
      res.json({ balance: 750, credits: 750 }); // Default demo values
    }
  } catch (error) {
    console.error('Wallet balance error:', error);
    res.status(500).json({ error: 'Database error' });
  }
});

// Custom unlock key route
server.post('/api/unlock/:keyId', async (req, res) => {
  try {
    const keyId = req.params.keyId;
    
    const [keys] = await pool.execute(
      'SELECT * FROM createdKeys WHERE id = ?',
      [parseInt(keyId)]
    );
    
    const key = keys[0];
    
    if (key && key.available > 0) {
      // Simulate random key from available pool
      const keyVariations = [
        `${key.keyValue}-${Math.random().toString(36).substring(2, 8).toUpperCase()}`,
        `${key.keyValue.replace('ABCD', Math.random().toString(36).substring(2, 6).toUpperCase())}`,
        key.keyValue
      ];
      
      const randomKey = keyVariations[Math.floor(Math.random() * keyVariations.length)];
      
      // Update availability
      await pool.execute(
        'UPDATE createdKeys SET available = available - 1, sold = sold + 1 WHERE id = ?',
        [parseInt(keyId)]
      );
      
      // Create unlock record
      const transactionId = Math.floor(Math.random() * 10000);
      
      await pool.execute(
        'INSERT INTO unlocks (transactionId, username, email, date, time, credits, keyId, keyTitle, keyValue, sellerUsername, sellerEmail, price, status) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)',
        [
          transactionId,
          'user_123', // Demo user
          'john.buyer@example.com',
          Date.now(),
          new Date().toLocaleTimeString(),
          750,
          key.keyId,
          key.keyTitle,
          randomKey,
          key.username,
          key.email,
          key.price,
          'Completed'
        ]
      );
      
      res.json({
        success: true,
        key: randomKey,
        transactionId: transactionId
      });
    } else {
      res.status(404).json({ success: false, message: 'Key not available or not found' });
    }
  } catch (error) {
    console.error('Unlock key error:', error);
    res.status(500).json({ success: false, message: 'Database error' });
  }
});

// Custom route for seller listings
server.get('/api/seller/listings/:id', async (req, res) => {
  try {
    const id = req.params.id;
    
    const [keys] = await pool.execute(
      'SELECT * FROM createdKeys WHERE id = ?',
      [parseInt(id)]
    );
    
    const key = keys[0];
    
    if (key) {
      res.json(key);
    } else {
      res.status(404).json({ error: 'Listing not found' });
    }
  } catch (error) {
    console.error('Seller listing error:', error);
    res.status(500).json({ error: 'Database error' });
  }
});

// Custom route for all listings
server.get('/api/listings', async (req, res) => {
  try {
    const [listings] = await pool.execute(
      'SELECT * FROM createdKeys WHERE isActive = true'
    );
    res.json(listings);
  } catch (error) {
    console.error('Listings error:', error);
    res.status(500).json({ error: 'Database error' });
  }
});

// Custom route for user-specific listings
server.get('/api/listings/:username', async (req, res) => {
  try {
    const username = req.params.username;
    const [listings] = await pool.execute(
      'SELECT * FROM createdKeys WHERE username = ? ORDER BY creationDate DESC',
      [username]
    );
    res.json(listings);
  } catch (error) {
    console.error('User listings error:', error);
    res.status(500).json({ error: 'Database error' });
  }
});

// Custom route for editing a key listing
server.put('/api/listings/:id', async (req, res) => {
  try {
    const listingId = req.params.id;
    const { 
      keyTitle, 
      description, 
      price, 
      tags, 
      expirationDate,
      isActive 
    } = req.body;

    // First, verify the listing exists and get current data
    const [currentListing] = await pool.execute(
      'SELECT * FROM createdKeys WHERE id = ?',
      [listingId]
    );

    if (currentListing.length === 0) {
      return res.status(404).json({ 
        success: false, 
        message: 'Listing not found' 
      });
    }

    const listing = currentListing[0];

    // Prepare update data (only update provided fields)
    const updateData = {};
    const updateFields = [];
    const updateValues = [];

    if (keyTitle !== undefined) {
      updateData.keyTitle = keyTitle;
      updateFields.push('keyTitle = ?');
      updateValues.push(keyTitle);
    }

    if (description !== undefined) {
      updateData.description = description;
      updateFields.push('description = ?');
      updateValues.push(description);
    }

    if (price !== undefined) {
      updateData.price = parseInt(price);
      updateFields.push('price = ?');
      updateValues.push(parseInt(price));
    }

    if (tags !== undefined) {
      const processedTags = Array.isArray(tags) ? tags : 
        (typeof tags === 'string' ? tags.split(',').map(tag => tag.trim()).filter(tag => tag) : []);
      updateData.tags = JSON.stringify(processedTags);
      updateFields.push('tags = ?');
      updateValues.push(JSON.stringify(processedTags));
    }

    if (expirationDate !== undefined) {
      updateData.expirationDate = expirationDate;
      updateFields.push('expirationDate = ?');
      updateValues.push(expirationDate);
    }

    if (isActive !== undefined) {
      updateData.isActive = isActive;
      updateFields.push('isActive = ?');
      updateValues.push(isActive);
    }

    if (updateFields.length === 0) {
      return res.status(400).json({ 
        success: false, 
        message: 'No valid fields provided for update' 
      });
    }

    // Add updatedAt timestamp
    updateFields.push('updatedAt = ?');
    updateValues.push(Date.now());

    // Build and execute update query
    const updateQuery = `UPDATE createdKeys SET ${updateFields.join(', ')} WHERE id = ?`;
    updateValues.push(listingId);

    await pool.execute(updateQuery, updateValues);

    // Get updated listing
    const [updatedListing] = await pool.execute(
      'SELECT * FROM createdKeys WHERE id = ?',
      [listingId]
    );

    res.json({
      success: true,
      listing: updatedListing[0],
      message: 'Listing updated successfully'
    });

  } catch (error) {
    console.error('Update listing error:', error);
    res.status(500).json({ 
      success: false, 
      message: 'Database error occurred while updating listing' 
    });
  }
});

// Custom route for deleting a key listing
server.delete('/api/listings/:id', async (req, res) => {
  try {
    const listingId = req.params.id;
    const { username } = req.body; // For security, verify ownership

    // First, verify the listing exists and check ownership
    const [listing] = await pool.execute(
      'SELECT * FROM createdKeys WHERE id = ?',
      [listingId]
    );

    if (listing.length === 0) {
      return res.status(404).json({ 
        success: false, 
        message: 'Listing not found' 
      });
    }

    // Verify ownership (optional security check)
    if (username && listing[0].username !== username) {
      return res.status(403).json({ 
        success: false, 
        message: 'You can only delete your own listings' 
      });
    }

    // Check if any keys have been sold
    if (listing[0].sold > 0) {
      // If keys have been sold, just deactivate instead of deleting
      await pool.execute(
        'UPDATE createdKeys SET isActive = false WHERE id = ?',
        [listingId]
      );

      res.json({
        success: true,
        message: 'Listing deactivated successfully (some keys were already sold)'
      });
    } else {
      // If no keys sold, completely delete the listing
      await pool.execute(
        'DELETE FROM createdKeys WHERE id = ?',
        [listingId]
      );

      res.json({
        success: true,
        message: 'Listing deleted successfully'
      });
    }

  } catch (error) {
    console.error('Delete listing error:', error);
    res.status(500).json({ 
      success: false, 
      message: 'Database error occurred while deleting listing' 
    });
  }
});

// Custom route for user notifications
server.get('/api/notifications/:username', async (req, res) => {
  try {
    const username = req.params.username;
    
    const [notifications] = await pool.execute(
      'SELECT * FROM notifications WHERE username = ? ORDER BY createdAt DESC',
      [username]
    );
    
    res.json(notifications);
  } catch (error) {
    console.error('Notifications error:', error);
    res.status(500).json({ error: 'Database error' });
  }
});

// Custom route for create key
server.post('/api/create-key', async (req, res) => {
  try {
    const { 
      title, 
      price_credits, 
      email, 
      username, 
      file, 
      description, 
      tags, 
      encryptionKey,
      keys_available,
      expiration_days
    } = req.body;

    console.log('Creating key with data:', { 
      title, 
      price_credits, 
      email, 
      username, 
      file, 
      description, 
      tags, 
      encryptionKey,
      keys_available,
      expiration_days
    });

    // Validate required fields
    if (!title || !price_credits || !file) {
      return res.status(400).json({ 
        success: false, 
        message: 'Title, price, and keys are required' 
      });
    }

    // Process the keys from file content
    const keysArray = file.split('\n')
      .map(key => key.trim())
      .filter(key => key.length > 0);

    if (keysArray.length === 0) {
      return res.status(400).json({ 
        success: false, 
        message: 'No valid keys found in the provided content' 
      });
    }

    const quantity = keys_available || keysArray.length;
    
    // Calculate expiration date if provided
    let expirationDate = null;
    if (expiration_days && expiration_days > 0) {
      const expDate = new Date();
      expDate.setDate(expDate.getDate() + expiration_days);
      expirationDate = expDate.toISOString().slice(0, 19).replace('T', ' ');
    }

    // Simulate file processing with a short delay
    setTimeout(async () => {
      try {
        const keyId = `key_${Date.now()}`;
        // Generate a unique id for the primary key (VARCHAR(10))
        const id = Math.random().toString(36).substring(2, 12).toUpperCase();

        // Process tags
        let processedTags = [];
        if (Array.isArray(tags)) {
          processedTags = tags;
        } else if (typeof tags === 'string') {
          processedTags = tags.split(',').map(tag => tag.trim()).filter(tag => tag);
        }
        processedTags.push('uploaded'); // Add default tag

        await pool.execute(
          'INSERT INTO createdKeys (id, keyId, username, email, keyTitle, keyValue, description, price, quantity, sold, available, creationDate, expirationDate, isActive, isReported, reportCount, encryptionKey, tags) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)',
          [
            id,
            keyId,
            username || 'demo_seller',
            email || 'seller@example.com',
            title || 'New Key Listing',
            JSON.stringify(keysArray), // Store all keys as JSON array
            description || 'No description provided.',
            parseInt(price_credits) || 100,
            quantity,
            0,
            quantity,
            Date.now(),
            expirationDate,
            true,
            false,
            0,
            encryptionKey || `enc_key_${Date.now()}`,
            JSON.stringify(processedTags)
          ]
        );

        res.json({
          success: true,
          uploadId: keyId,
          keysProcessed: keysArray.length,
          message: `Successfully uploaded ${keysArray.length} keys`
        });
      } catch (error) {
        console.error('Create key database error:', error);
        res.status(500).json({ 
          success: false, 
          message: 'Database error occurred while creating listing' 
        });
      }
    }, 1000);
  } catch (error) {
    console.error('Create key outer error:', error);
    res.status(500).json({ 
      success: false, 
      message: 'Server error occurred while processing request' 
    });
  }
});

// Custom route for user unlocks
server.get('/api/unlocks/:username', async (req, res) => {
  try {
    const username = req.params.username;
    
    const [unlocks] = await pool.execute(
      'SELECT * FROM unlocks WHERE username = ? ORDER BY date DESC',
      [username]
    );
    
    res.json(unlocks);
  } catch (error) {
    console.error('Unlocks error:', error);
    res.status(500).json({ error: 'Database error' });
  }
});

// Custom route for user purchases
server.get('/api/purchases/:username', async (req, res) => {
  try {
    const username = req.params.username;
    
    const [purchases] = await pool.execute(
      'SELECT * FROM buyCredits WHERE username = ? ORDER BY date DESC',
      [username]
    );
    
    res.json(purchases);
  } catch (error) {
    console.error('Purchases error:', error);
    res.status(500).json({ error: 'Database error' });
  }
});

// Custom route for user redemptions
server.get('/api/redemptions/:username', async (req, res) => {
  try {
    const username = req.params.username;
    
    const [redemptions] = await pool.execute(
      'SELECT * FROM redeemCredits WHERE username = ? ORDER BY date DESC',
      [username]
    );
    
    res.json(redemptions);
  } catch (error) {
    console.error('Redemptions error:', error);
    res.status(500).json({ error: 'Database error' });
  }
});



// Basic RESTful routes for all tables
server.get('/api/:table', async (req, res) => {
  try {
    const table = req.params.table;
    const allowedTables = ['userData', 'buyCredits', 'redeemCredits', 'earnings', 'unlocks', 'createdKeys', 'notifications', 'wallet', 'reports', 'supportTickets'];
    
    if (!allowedTables.includes(table)) {
      return res.status(400).json({ error: 'Invalid table name' });
    }
    
    const [rows] = await pool.execute(`SELECT * FROM ${table}`);
    res.json(rows);
  } catch (error) {
    console.error(`Get ${req.params.table} error:`, error);
    res.status(500).json({ error: 'Database error' });
  }
});

server.get('/api/:table/:id', async (req, res) => {
  try {
    const { table, id } = req.params;
    const allowedTables = ['userData', 'buyCredits', 'redeemCredits', 'earnings', 'unlocks', 'createdKeys', 'notifications', 'wallet', 'reports', 'supportTickets'];
    
    if (!allowedTables.includes(table)) {
      return res.status(400).json({ error: 'Invalid table name' });
    }
    
    const [rows] = await pool.execute(`SELECT * FROM ${table} WHERE id = ?`, [id]);
    
    if (rows.length === 0) {
      return res.status(404).json({ error: 'Record not found' });
    }
    
    res.json(rows[0]);
  } catch (error) {
    console.error(`Get ${req.params.table} by ID error:`, error);
    res.status(500).json({ error: 'Database error' });
  }
});

server.patch('/api/:table/:id', async (req, res) => {
  try {
    const { table, id } = req.params;
    const allowedTables = ['userData', 'buyCredits', 'redeemCredits', 'earnings', 'unlocks', 'createdKeys', 'notifications', 'wallet', 'reports', 'supportTickets'];
    
    if (!allowedTables.includes(table)) {
      return res.status(400).json({ error: 'Invalid table name' });
    }
    
    const updateData = req.body;
    const columns = Object.keys(updateData);
    const values = Object.values(updateData);
    
    if (columns.length === 0) {
      return res.status(400).json({ error: 'No data to update' });
    }
    
    const setClause = columns.map(col => `${col} = ?`).join(', ');
    const query = `UPDATE ${table} SET ${setClause} WHERE id = ?`;
    
    const [result] = await pool.execute(query, [...values, id]);
    
    if (result.affectedRows === 0) {
      return res.status(404).json({ error: 'Record not found' });
    }
    
    // Get updated record
    const [updated] = await pool.execute(`SELECT * FROM ${table} WHERE id = ?`, [id]);
    res.json(updated[0]);
  } catch (error) {
    console.error(`Update ${req.params.table} error:`, error);
    res.status(500).json({ error: 'Database error' });
  }
});



// Use default router for all other routes
server.use('/api', router);

const PORT = process.env.PORT || 3001;
server.listen(PORT, async () => {
  try {
    // Test database connection
    await pool.execute('SELECT 1');
    console.log('🚀 Express Server with MySQL is running on port', PORT);
    console.log('�️  Database: KeyChingDB (MySQL)');
    console.log('🌐 API Base URL: http://localhost:' + PORT + '/api');
    console.log('📋 Available endpoints:');
    console.log('   - GET /api/userData');
    console.log('   - GET /api/createdKeys');
    console.log('   - GET /api/unlocks/:username');
    console.log('   - GET /api/purchases/:username');
    console.log('   - GET /api/redemptions/:username');
    console.log('   - GET /api/notifications/:username');
    console.log('   - POST /api/auth/login');
    console.log('   - GET /api/wallet/balance');
    console.log('   - POST /api/unlock/:keyId');
    console.log('   - GET /api/listings');
    console.log('   - POST /api/create-key');
    console.log('   - GET /api/:table');
    console.log('   - GET /api/:table/:id');
    console.log('   - PATCH /api/:table/:id');
  } catch (error) {
    console.error('❌ Failed to connect to MySQL database:', error.message);
    console.log('📝 Please ensure:');
    console.log('   1. MySQL server is running');
    console.log('   2. KeyChingDB database exists');
    console.log('   3. Database credentials are correct in server.cjs');
    process.exit(1);
  }
});