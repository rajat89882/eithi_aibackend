const express = require('express');
const bodyParser = require('body-parser');
const mysql = require('mysql');
const cors = require('cors'); // Import cors
const app = express();
const PORT = 3000;
var md5 = require('md5');


// MySQL Database Connection
const db = mysql.createPool({
    connectionLimit: 10000, // Limits the number of simultaneous connections
    host: "localhost",
    user: "root",
    password: "",
    database: "rdata",
    debug: false,
  });
  
  // Handle connection and errors
  db.getConnection((err, connection) => {
    if (err) {
      if (err.code === "PROTOCOL_CONNECTION_LOST") {
        console.error("Database connection was closed.");
      }
      if (err.code === "ER_CON_COUNT_ERROR") {
        console.error("Database has too many connections.");
      }
      if (err.code === "ECONNREFUSED") {
        console.error("Database connection was refused.");
      }
    }
  
    if (connection) connection.release(); // Release the connection back to the pool
  
    return;
  });
// Register Route
app.use(cors());

app.use(express.json()); // Parse JSON bodies

// Your route for registration
app.post('/register', (req, res) => {
    const { name, email, password } = req.body;
    console.log(req.body);

    // Check if all fields are provided
    if (!name || !email || !password) {
        return res.status(400).json({ error: 'All fields are required' });
    }

    // Hash the password using MD5
    var pass = md5(password);

    // Check if email already exists in the database
    const checkEmailQuery = 'SELECT * FROM signup WHERE email = ?';
    db.query(checkEmailQuery, [email], (err, result) => {
        if (err) {
            console.error('Error checking email:', err);
            return res.status(200).json({ error: 'Database error', status: '2' });
        }

        if (result.length > 0) {
            // Email already exists
            return res.status(200).json({ error: 'Email already exists', status: '2' });
        }

        // If email does not exist, insert the new user
        const insertQuery = 'INSERT INTO signup (name, email, password) VALUES (?, ?, ?)';
        db.query(insertQuery, [name, email, pass], (err, result) => {
            if (err) {
                console.error('Error inserting user:', err);
                return res.status(200).json({ error: 'Database error', status: '2' });
            }

            // After inserting, get the user details using the insertId
            const userId = result.insertId;
            const getUserDetailsQuery = 'SELECT * FROM signup WHERE id = ?';
            db.query(getUserDetailsQuery, [userId], (err, userResult) => {
                if (err) {
                    console.error('Error fetching user details:', err);
                    return res.status(200).json({ error: 'Database error', status: '2' });
                }

                // Send the user details in the response
                res.status(201).json({
                    message: 'User registered successfully',
                    userId: userResult[0].id,
                    name: userResult[0].name,
                    email: userResult[0].email,
                    status: '1',
                    result: userResult[0] // Include user details in the result
                });
            });
        });
    });
});

app.post('/login', async (req, res) => {
    const { email, password } = req.body;
    var pass = md5(password);
    console.log(req.body);
    const checkEmailQuery = 'SELECT * FROM signup WHERE email = ? And password =?';
    db.query(checkEmailQuery, [email,pass], (err, result) => {
        if (err) {
            console.error('Error checking email:', err);
            return res.status(200).json({ error: 'Database error',status:'2' });
        }
        console.log(result.length);
        if (result.length === 0) {
            // Email already exists
            return res.status(200).json({ message: 'Invalid detail',status:'2' });
        } else {
            res.status(201).json({ message: 'Login successfully', result: result,status:'1' });
        }

        // If email does not exist, insert the new user
        
    });
});
app.post('/admin/login', async (req, res) => {
    const { email, password } = req.body;
    var pass = md5(password);
    const checkEmailQuery = 'SELECT * FROM admin WHERE email = ? And password =?';
    db.query(checkEmailQuery, [email,pass], (err, result) => {
        if (err) {
            console.error('Error checking email:', err);
            return res.status(200).json({ error: 'Database error',status:'2' });
        }
        console.log(result);
        if (result.length === 0) {
            // Email already exists
            return res.status(200).json({ message: 'Invalid detail',status:'2' });
        } else {
            res.status(201).json({ message: 'Login successfully', result: result,status:'1' });
        }

        // If email does not exist, insert the new user
        
    });
});
app.post('/admin/quiz', (req, res) => {
    const { title, questions } = req.body;

    if (!title || !questions || !Array.isArray(questions)) {
        return res.status(400).json({ error: 'Invalid input data' });
    }

    db.getConnection((err, connection) => {
        if (err) {
            console.error('Error getting database connection:', err);
            return res.status(500).json({ error: 'Database connection error' });
        }

        connection.beginTransaction((err) => {
            if (err) {
                connection.release();
                console.error('Error starting transaction:', err);
                return res.status(500).json({ error: 'Transaction start error' });
            }

            // Insert into `quizzes`
            const quizQuery = 'INSERT INTO quizzes (title) VALUES (?)';
            connection.query(quizQuery, [title], (err, quizResult) => {
                if (err) {
                    return rollbackTransaction(connection, res, 'Error inserting quiz', err);
                }
                const quizId = quizResult.insertId;

                // Iterate through questions
                const insertQuestions = (index) => {
                    if (index >= questions.length) {
                        // All questions processed, commit transaction
                        return connection.commit((err) => {
                            if (err) {
                                return rollbackTransaction(connection, res, 'Error committing transaction', err);
                            }
                            connection.release();
                            return res.status(201).json({ message: 'Quiz created successfully', quizId });
                        });
                    }

                    const question = questions[index];
                    const questionQuery = `
                        INSERT INTO questions 
                        (quiz_id, text, compliance_requirement, risk_level, penalty, question_type) 
                        VALUES (?, ?, ?, ?, ?, ?)`;
                    connection.query(
                        questionQuery,
                        [
                            quizId,
                            question.text,
                            question.ComplianceRequirement || null,
                            question.RiskLevel || null,
                            question.Penalty || null,
                            question.QuestionType || null,
                        ],
                        (err, questionResult) => {
                            if (err) {
                                return rollbackTransaction(connection, res, 'Error inserting question', err);
                            }
                            const questionId = questionResult.insertId;

                            // Insert answers for the current question
                            const answers = question.answers || [];
                            const insertAnswers = (answerIndex) => {
                                if (answerIndex >= answers.length) {
                                    // All answers processed, move to the next question
                                    return insertQuestions(index + 1);
                                }

                                const answer = answers[answerIndex];
                                const answerQuery = `
                                    INSERT INTO answers 
                                    (question_id, text, risk_score, gaps, recommendation) 
                                    VALUES (?, ?, ?, ?, ?)`;
                                connection.query(
                                    answerQuery,
                                    [
                                        questionId,
                                        answer.text,
                                        answer.riskScore || 0,
                                        answer.gaps || null,
                                        answer.recommendation || null,
                                    ],
                                    (err) => {
                                        if (err) {
                                            return rollbackTransaction(connection, res, 'Error inserting answer', err);
                                        }
                                        insertAnswers(answerIndex + 1); // Process the next answer
                                    }
                                );
                            };

                            insertAnswers(0); // Start inserting answers
                        }
                    );
                };

                insertQuestions(0); // Start inserting questions
            });
        });
    });
});

// Utility function to rollback transaction
function rollbackTransaction(connection, res, message, error) {
    connection.rollback(() => {
        connection.release();
        console.error(message, error);
        res.status(500).json({ error: 'Internal server error' });
    });
}
app.post('/admin/getallquiz', (req, res) => {
    
    // Check if email already exists in the database
    const checkEmailQuery = 'SELECT * FROM quizzes ORDER BY id desc';
    db.query(checkEmailQuery, (err, result) => {
        if (err) {
            console.error('Error checking email:', err);
            return res.status(200).json({ error: 'Database error', status: '2' });
        }
        return res.status(200).json({ result: result });
    });
});
app.post('/admin/getalluser', (req, res) => {
    
    // Check if email already exists in the database
    const checkEmailQuery = 'SELECT * FROM signup ORDER BY id desc';
    db.query(checkEmailQuery, (err, result) => {
        if (err) {
            console.error('Error checking email:', err);
            return res.status(200).json({ error: 'Database error', status: '2' });
        }
        return res.status(200).json({ result: result });
    });
});
app.post('/admin/deletequiz', (req, res) => {
    const { id } = req.body;

    if (!id) {
        return res.status(400).json({ error: "Quiz ID is required" });
    }

    db.getConnection((err, connection) => {
        if (err) {
            console.error("Database connection error:", err);
            return res.status(500).json({ error: "Database connection error" });
        }

        // Begin transaction
        connection.beginTransaction((transactionError) => {
            if (transactionError) {
                connection.release();
                return res.status(500).json({ error: "Failed to start transaction" });
            }

            // Delete answers related to the quiz
            connection.query(
                `DELETE a FROM answers a
                JOIN questions q ON a.question_id = q.id
                WHERE q.quiz_id = ?`,
                [id],
                (error) => {
                    if (error) {
                        return connection.rollback(() => {
                            connection.release();
                            res.status(500).json({ error: "Failed to delete answers" });
                        });
                    }

                    // Delete questions related to the quiz
                    connection.query(
                        `DELETE FROM questions WHERE quiz_id = ?`,
                        [id],
                        (error) => {
                            if (error) {
                                return connection.rollback(() => {
                                    connection.release();
                                    res.status(500).json({ error: "Failed to delete questions" });
                                });
                            }

                            // Delete the quiz itself
                            connection.query(
                                `DELETE FROM quizzes WHERE id = ?`,
                                [id],
                                (error) => {
                                    if (error) {
                                        return connection.rollback(() => {
                                            connection.release();
                                            res.status(500).json({ error: "Failed to delete quiz" });
                                        });
                                    }

                                    // Commit transaction
                                    connection.commit((commitError) => {
                                        connection.release();
                                        if (commitError) {
                                            return res.status(500).json({ error: "Failed to commit transaction" });
                                        }

                                        res.status(200).json({ message: "Quiz deleted successfully" });
                                    });
                                }
                            );
                        }
                    );
                }
            );
        });
    });
});
app.post('/admin/deleteuser', (req, res) => {
    const { id } = req.body;

    if (!id) {
        return res.status(400).json({ error: "User ID is required" });
    }

    db.getConnection((err, connection) => {
        if (err) {
            console.error("Database connection error:", err);
            return res.status(500).json({ error: "Database connection error" });
        }

        // Begin transaction
        connection.beginTransaction((transactionError) => {
            if (transactionError) {
                connection.release();
                return res.status(500).json({ error: "Failed to start transaction" });
            }

            // Delete the user
            connection.query(
                `DELETE FROM signup WHERE id = ?`,
                [id],
                (error) => {
                    if (error) {
                        return connection.rollback(() => {
                            connection.release();
                            res.status(500).json({ error: "Failed to delete user" });
                        });
                    }

                    // Commit transaction
                    connection.commit((commitError) => {
                        connection.release();
                        if (commitError) {
                            return res.status(500).json({ error: "Failed to commit transaction" });
                        }

                        res.status(200).json({ message: "User deleted successfully" });
                    });
                }
            );
        });
    });
});

app.post('/admin/getquiz', (req, res) => {
    const quizId = req.body.id;

    db.getConnection((err, connection) => {
        if (err) {
            console.error('Error getting database connection:', err);
            return res.status(500).json({ error: 'Database connection error' });
        }

        const quizQuery = `
            SELECT q.id, q.title, qu.id AS questionId, qu.text AS questionText, 
                   qu.compliance_requirement, qu.risk_level, qu.penalty, qu.question_type, 
                   a.id AS answerId, a.text AS answerText, a.risk_score, a.gaps, a.recommendation
            FROM quizzes q
            LEFT JOIN questions qu ON q.id = qu.quiz_id
            LEFT JOIN answers a ON qu.id = a.question_id
            WHERE q.id = ?
        `;

        connection.query(quizQuery, [quizId], (err, results) => {
            connection.release();
            if (err) {
                console.error('Error fetching quiz data:', err);
                return res.status(500).json({ error: 'Error fetching quiz data' });
            }

            // Structure the response
            const quiz = { id: quizId, title: '', questions: [] };
            const questionMap = {};

            results.forEach((row) => {
                if (!quiz.title) quiz.title = row.title;

                if (!questionMap[row.questionId]) {
                    questionMap[row.questionId] = {
                        id: row.questionId,
                        text: row.questionText,
                        complianceRequirement: row.compliance_requirement,
                        riskLevel: row.risk_level,
                        penalty: row.penalty,
                        questionType: row.question_type,
                        answers: [],
                    };
                    quiz.questions.push(questionMap[row.questionId]);
                }

                if (row.answerId) {
                    questionMap[row.questionId].answers.push({
                        id: row.answerId,
                        text: row.answerText,
                        riskScore: row.risk_score,
                        gaps: row.gaps,
                        recommendation: row.recommendation,
                    });
                }
            });

            res.json(quiz);
        });
    });
});

app.post('/submitQuiz', (req, res) => {
    const { userId, quizId, answers } = req.body;

    if (!userId || !quizId || !answers || !Array.isArray(answers)) {
        return res.status(400).json({ error: 'Invalid request data' });
    }

    // Insert each answer into the database
    const queries = answers.map(({ questionId, answerIds }) => {
        const answerIdsString = Array.isArray(answerIds) ? answerIds.join(',') : answerIds; // For Checkboxes
        return new Promise((resolve, reject) => {
            db.query(
                'INSERT INTO quiz_attempts (user_id, quiz_id, question_id, answer_ids) VALUES (?, ?, ?, ?)',
                [userId, quizId, questionId, answerIdsString],
                (err, result) => {
                    if (err) return reject(err);
                    resolve(result);
                }
            );
        });
    });

    // Execute all queries
    Promise.all(queries)
        .then(() => res.status(200).json({ message: 'Quiz submitted successfully' }))
        .catch((err) => {
            console.error('Error saving quiz attempt:', err);
            res.status(500).json({ error: 'Failed to save quiz attempt' });
        });
});
app.post('/getQuizResults', async (req, res) => {
    const { userId, quizId } = req.body;

    if (!userId || !quizId) {
        return res.status(400).json({ error: 'Invalid request data' });
    }

    // Query the database to fetch the quiz title and user's answers for this quiz attempt
    db.query(
        `SELECT q.title, qa.question_id, qa.answer_ids,qq.text 
         FROM quiz_attempts qa
         JOIN quizzes q ON qa.quiz_id = q.id 
         JOIN questions qq ON qa.question_id = qq.id 
         WHERE qa.user_id = ? AND qa.quiz_id = ?`,
        [userId, quizId],
        async (err, results) => {
            if (err) {
                console.error('Error fetching quiz results:', err);
                return res.status(500).json({ error: 'Failed to fetch quiz results' });
            }

            if (results.length === 0) {
                return res.status(404).json({ error: 'No attempts found for this quiz' });
            }

            // Extract quiz title
            const quizTitle = results[0].title;

            // Calculate the score based on the user's answers
            try {
                const scoreData = await calculateScore(results); // Calculate score based on answers
                // Add the totalScore to each attempt
                const attemptsWithScore = results.map((attempt, index) => {
                    return {
                        ...attempt,  // Spread the existing data
                        totalScore: scoreData.totalScores[index], // Add totalScore for each attempt
                    };
                });

                res.status(200).json({
                    message: 'Quiz results retrieved successfully',
                    quizTitle: quizTitle,  // Add the quiz title to the response
                    score: scoreData,
                    attempts: attemptsWithScore,  // Include attempts with individual totalScore
                });
            } catch (err) {
                console.error('Error calculating score:', err);
                res.status(500).json({ error: 'Failed to calculate score' });
            }
        }
    );
});

// Function to calculate the score based on the user's answers and correct answers from the database
const calculateScore = async (attempts) => {
    let totalScore = 0;
    let correctAnswers = 0;
    let totalScores = []; // Array to store total score for each attempt
    
    // Iterate through each attempt (each question answered by the user)
    for (const attempt of attempts) {
        const { question_id, answer_ids } = attempt;
        
        // Ensure answer_ids is an array (split by commas in case of multiple answers)
        const answerIdsArray = answer_ids ? answer_ids.split(',').map(id => id.trim()) : [];
        
        // Check if the user's answers are correct (compare with correct answers in the database)
        const { isCorrect, riskScore } = await isAnswerCorrect(question_id, answerIdsArray);

        if (isCorrect) {
            correctAnswers++;
        }

        // Add the risk score for the current attempt
        totalScore += riskScore;

        // Store the score for the individual attempt
        totalScores.push(riskScore);
    }

    // Optionally return score as a percentage if you want to give a percentage score
    const percentageScore = (correctAnswers / attempts.length) * 100;

    return {
        totalScore,
        percentageScore,
        correctAnswers,
        totalScores, // Array of total scores for each attempt
    };
};

// Function to check if the user's answers are correct (dynamic version)
const isAnswerCorrect = (question_id, answer_ids) => {
    // Fetch correct answers and their risk scores dynamically from the database
    return new Promise((resolve, reject) => {
        db.query(
            `SELECT id, risk_score FROM answers WHERE question_id = ? AND id IN (?)`,
            [question_id, answer_ids],
            (err, results) => {
                if (err) {
                    return reject(err);
                }

                // Check if the user's answer matches the correct answer(s)
                const correctAnswers = results.map(result => result.id); // List of correct answer IDs
                const correctRiskScores = results.map(result => result.risk_score); // Risk scores of correct answers

                // Determine if the user's selected answers match the correct answers (by sorting)
                const isCorrect = JSON.stringify(answer_ids.sort()) === JSON.stringify(correctAnswers.sort());
                
                // Calculate the total risk score based on correct answers
                const totalRiskScore = correctRiskScores.reduce((sum, score) => sum + score, 0);

                resolve({
                    isCorrect,
                    riskScore: totalRiskScore
                });
            }
        );
    });
};




// Start Server
app.listen(PORT, () => {
    console.log(`Server is running on http://localhost:${PORT}`);
});

