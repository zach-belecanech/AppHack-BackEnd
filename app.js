const express = require('express');
const mysql = require('mysql');

const app = express();
app.use(express.json());

app.use((req, res, next) => {
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
    next();
});

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
    const { first_name, last_name, email, password } = req.body;
    const sql = 'INSERT INTO students (first_name, last_name, email, password) VALUES (?, ?, ?, ?)';
    connection.query(sql, [first_name, last_name, email, password], (err, result) => {
        if (err) throw err;
        res.send('Student created successfully');
    });
});

app.post('/addStudent', (req, res) => {
    const { first_name, last_name, email, password, availability, classes } = req.body;

    connection.beginTransaction(err => {
        if (err) {
            return res.status(500).send('Error starting transaction');
        }

        // Insert a new student into the students table
        const insertStudentQuery = 'INSERT INTO students (first_name, last_name, email, password) VALUES (?, ?, ?, ?)';
        connection.query(insertStudentQuery, [first_name, last_name, email, password], (err, result) => {
            if (err) {
                return connection.rollback(() => {
                    res.status(500).send('Error inserting student');
                });
            }

            const lastStudentId = result.insertId;

            // Insert availability times for the new student
            const insertAvailabilityQuery = 'INSERT INTO availability (student_id, available_from, available_until) VALUES ?';
            const availabilityValues = availability.map(avail => [lastStudentId, avail.availableFrom, avail.availableUntil]);
            connection.query(insertAvailabilityQuery, [availabilityValues], (err, result) => {
                if (err) {
                    return connection.rollback(() => {
                        res.status(500).send('Error inserting availability');
                    });
                }

                // Insert classes for the new student
                const insertClassesQuery = 'INSERT INTO student_classes (student_id, class_id) VALUES ?';
                const classValues = classes.map(classId => [lastStudentId, classId]);
                connection.query(insertClassesQuery, [classValues], (err, result) => {
                    if (err) {
                        return connection.rollback(() => {
                            res.status(500).send('Error inserting classes');
                        });
                    }

                    connection.commit(err => {
                        if (err) {
                            return connection.rollback(() => {
                                res.status(500).send('Error committing transaction');
                            });
                        }

                        res.status(200).send('Student added successfully');
                    });
                });
            });
        });
    });
});

app.post('/registerStudentClasses', (req, res) => {
    const { student_id, class_ids } = req.body; // Expecting class_ids to be an array of class IDs

    class_ids.forEach(class_id => {
        const sql = 'INSERT INTO student_classes (student_id, class_id) VALUES (?, ?)';
        connection.query(sql, [student_id, class_id], (err, result) => {
            if (err) {
                return res.status(500).send(err.message);
            }
        });
    });

    res.send('Student registered for classes successfully');
});


// Read
app.get('/getStudent/:email', (req, res) => {
    const sql = 'SELECT * FROM students WHERE email = ?';
    connection.query(sql, [req.params.email], (err, results) => {
        if (err) throw err;
        res.json(results);
    });
});

app.get('/getStudentClasses/:studentId', (req, res) => {
    const sql = `
      SELECT c.class_id, c.class_name 
      FROM classes c
      JOIN student_classes sc ON c.class_id = sc.class_id
      WHERE sc.student_id = ?`;

    connection.query(sql, [req.params.studentId], (err, results) => {
        if (err) {
            return res.status(500).send(err.message);
        }

        res.json(results);
    });
});

app.get('/getStudentDetails', (req, res) => {
    const sql = `
        SELECT
            s.student_id,
            s.first_name,
            s.last_name,
            GROUP_CONCAT(DISTINCT c.class_name SEPARATOR ', ') AS classes,
            GROUP_CONCAT(DISTINCT CONCAT('(', TIME_FORMAT(a.available_from, '%H:%i'), ', ', TIME_FORMAT(a.available_until, '%H:%i'), ')') SEPARATOR '; ') AS availability
        FROM
            students s
        LEFT JOIN
            student_classes sc ON s.student_id = sc.student_id
        LEFT JOIN
            classes c ON sc.class_id = c.class_id
        LEFT JOIN
            availability a ON s.student_id = a.student_id
        GROUP BY
            s.student_id;
    `;
 
    connection.query(sql, (err, results) => {
        if (err) {
            return res.status(500).send(err.message);
        }
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