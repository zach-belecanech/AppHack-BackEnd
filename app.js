const express = require('express');
const mysql = require('mysql');

const app = express();
app.use(express.json());

const connection = mysql.createConnection({
  host: 'apphack-db2.chacgwyoq34h.us-east-1.rds.amazonaws.com',
  user: 'admin',
  password: 'AppalHack6969',
  database: 'apphack'
});

connection.connect((err) => {
  if (err) throw err;
  console.log('Connected to MySQL database');
});

// Create
app.post('/users', (req, res) => {
    const { name, age } = req.body;
    const sql = 'INSERT INTO students (name, age) VALUES (?, ?)';
    connection.query(sql, [name, age], (err, result) => {
        if (err) throw err;
        res.send('User created successfully');
    });
});

// Read
app.get('/users', (req, res) => {
    const sql = 'SELECT * FROM users';
    connection.query(sql, (err, results) => {
        if (err) throw err;
        res.json(results);
    });
});

// Update
app.put('/users/:id', (req, res) => {
    const { name, age } = req.body;
    const { id } = req.params;
    const sql = 'UPDATE users SET name = ?, age = ? WHERE id = ?';
    connection.query(sql, [name, age, id], (err, result) => {
        if (err) throw err;
        res.send('User updated successfully');
    });
});

// Delete
app.delete('/users/:id', (req, res) => {
    const { id } = req.params;
    const sql = 'DELETE FROM users WHERE id = ?';
    connection.query(sql, [id], (err, result) => {
        if (err) throw err;
        res.send('User deleted successfully');
    });
});
  

const PORT = 3000;
app.listen(PORT, () => {
  console.log(`Server is running on port ${PORT}`);
});
