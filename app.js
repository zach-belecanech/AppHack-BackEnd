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
app.post('/newStudent', (req, res) => {
    const { first_name, last_name, email } = req.body;
    const sql = 'INSERT INTO students (first_name, last_name, email) VALUES (?, ?, ?)';
    connection.query(sql, [first_name, last_name, email], (err, result) => {
        if (err) throw err;
        res.send('Student created successfully');
    });
});

// Read
app.get('/getStudent/:email', (req, res) => {
    const sql = 'SELECT * FROM students WHERE email = ?';
    connection.query(sql, [req.params.email], (err, results) => {
        if (err) throw err;
        res.json(results);
    });
});


app.put('/updateStudentPersonalInfo', (req, res) => {
    const { first_name, last_name, email } = req.body;
    const sql = 'UPDATE students SET first_name = ?, last_name = ? WHERE email = ?';
    connection.query(sql, [first_name, last_name, email], (err, result) => {
        if (err) throw err;
        res.send('Student created successfully');
    });
});

app.put('/updateStudentEmail', (req, res) => {
    const { first_name, last_name, email } = req.body;
    const sql = 'UPDATE students SET email = ? WHERE first_name = ? AND last_name = ?';
    connection.query(sql, [email, first_name, last_name], (err, result) => {
        if (err) throw err;
        res.send('Student created successfully');
    });
});

// Update
app.put('/updateStudent/:email/:attr/:value', (req, res) => {
    const { email ,attr, value } = req.params;
    const sql = 'UPDATE students SET ? = ? WHERE email = ?';
    connection.query(sql, [attr, value, email], (err, result) => {
        if (err) throw err;
        res.send('Student updated successfully');
    });
});

// Delete
app.delete('/deleteStudent/:email', (req, res) => {
    const { email } = req.params;
    const sql = 'DELETE FROM students WHERE email = ?';
    connection.query(sql, [email], (err, result) => {
        if (err) throw err;
        res.send('User deleted successfully');
    });
});
  

const PORT = 3000;
app.listen(PORT, () => {
  console.log(`Server is running on port ${PORT}`);
});
