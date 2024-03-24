const express = require('express');
const mysql = require('mysql');
const axios = require('axios');
const app = express();
app.use(express.json());

app.use((req, res, next) => {
    res.setHeader('Referrer-Policy', 'no-referrer-when-downgrade');
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
  if (err) throw err
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

app.get('/getStudentInfo/:student_id', (req, res) => {
    const { student_id } = req.params;

    // Validate that student_id is an integer
    if (!Number.isInteger(parseInt(student_id))) {
        return res.status(400).send('Invalid student ID');
    }

    // Query to get the student's personal information
    const studentInfoQuery = 'SELECT first_name, last_name, email FROM students WHERE student_id = ?';
    
    // Query to get the student's classes
    const studentClassesQuery = `
        SELECT c.class_name 
        FROM student_classes sc
        JOIN classes c ON sc.class_id = c.class_id
        WHERE sc.student_id = ?
    `;

    // Query to get the student's availability
    const studentAvailabilityQuery = 'SELECT available_from, available_until FROM availability WHERE student_id = ?';

    // Execute the queries in parallel
    Promise.all([
        new Promise((resolve, reject) => {
            connection.query(studentInfoQuery, [student_id], (err, result) => {
                if (err) reject(err);
                else resolve(result[0]);
            });
        }),
        new Promise((resolve, reject) => {
            connection.query(studentClassesQuery, [student_id], (err, result) => {
                if (err) reject(err);
                else resolve(result.map(row => row.class_name));
            });
        }),
        new Promise((resolve, reject) => {
            connection.query(studentAvailabilityQuery, [student_id], (err, result) => {
                if (err) reject(err);
                else resolve(result);
            });
        })
    ]).then(([personalInfo, classes, availability]) => {
        if (!personalInfo) {
            return res.status(404).send('Student not found');
        }

        // Combine the results and send the response
        res.status(200).json({
            ...personalInfo,
            classes,
            availability
        });
    }).catch(err => {
        console.error(err);
        res.status(500).send('Error retrieving student information');
    });
});

// Update student's personal information
app.put('/updateStudent/personal/:student_id', (req, res) => {
    const { first_name, last_name, email } = req.body;
    const student_id = req.params.student_id;
    const updateStudentQuery = 'UPDATE students SET first_name = ?, last_name = ?, email = ? WHERE student_id = ?';

    connection.query(updateStudentQuery, [first_name, last_name, email, student_id], (err, result) => {
        if (err) {
            res.status(500).send('Error updating student personal information');
        } else {
            res.status(200).send('Student personal information updated successfully');
        }
    });
});

// Update student's availability
app.put('/updateStudent/availability/:student_id', (req, res) => {
    const { availability } = req.body;
    const student_id = req.params.student_id;
    const deleteAvailabilityQuery = 'DELETE FROM availability WHERE student_id = ?';
    const insertAvailabilityQuery = 'INSERT INTO availability (student_id, available_from, available_until) VALUES ?';
    const availabilityValues = availability.map(avail => [student_id, avail.available_from, avail.available_until]);

    connection.beginTransaction(err => {
        if (err) {
            return res.status(500).send('Error starting transaction for availability update');
        }

        connection.query(deleteAvailabilityQuery, [student_id], (err, result) => {
            if (err) {
                return connection.rollback(() => {
                    res.status(500).send('Error deleting existing availability');
                });
            }

            connection.query(insertAvailabilityQuery, [availabilityValues], (err, result) => {
                if (err) {
                    return connection.rollback(() => {
                        res.status(500).send('Error inserting new availability');
                    });
                }

                connection.commit(err => {
                    if (err) {
                        return connection.rollback(() => {
                            res.status(500).send('Error committing transaction for availability update');
                        });
                    }

                    res.status(200).send('Student availability updated successfully');
                });
            });
        });
    });
});

// Update student's classes
app.put('/updateStudent/classes/:student_id', (req, res) => {
    const { classes } = req.body;
    const student_id = req.params.student_id;
    const deleteClassesQuery = 'DELETE FROM student_classes WHERE student_id = ?';
    const getClassIdsQuery = 'SELECT class_id FROM classes WHERE class_name IN (?)';

    connection.beginTransaction(err => {
        if (err) {
            return res.status(500).send('Error starting transaction for classes update');
        }

        connection.query(deleteClassesQuery, [student_id], (err, result) => {
            if (err) {
                return connection.rollback(() => {
                    res.status(500).send('Error deleting existing classes');
                });
            }

            connection.query(getClassIdsQuery, [classes], (err, classIdsResult) => {
                if (err) {
                    return connection.rollback(() => {
                        res.status(500).send('Error fetching class IDs');
                    });
                }

                const classIds = classIdsResult.map(row => row.class_id);
                const insertClassesQuery = 'INSERT INTO student_classes (student_id, class_id) VALUES ?';
                const classValues = classIds.map(classId => [student_id, classId]);

                connection.query(insertClassesQuery, [classValues], (err, result) => {
                    if (err) {
                        return connection.rollback(() => {
                            res.status(500).send('Error inserting new classes');
                        });
                    }

                    connection.commit(err => {
                        if (err) {
                            return connection.rollback(() => {
                                res.status(500).send('Error committing transaction for classes update');
                            });
                        }

                        res.status(200).send('Student classes updated successfully');
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



app.get('/getClasses', (req, res) => {
    const sql = 'SELECT * FROM classes';
    connection.query(sql, [req.params.email], (err, results) => {
        if (err) throw err;
        res.json(results);
    });
});

app.get('/getMLData', (req, res) => {
    axios.post('http://34.227.51.137/cluster_students')
        .then(response => {
            res.json(response.data);
        })
        .catch(error => {
            console.error('Error fetching ML data:', error);
            res.status(500).json({ error: 'Failed to fetch ML data' });
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
