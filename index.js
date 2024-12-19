const express = require('express');
const bodyParser = require('body-parser');
const mysql = require('mysql');
const cors = require('cors'); // Import cors
const app = express();
const PORT = 3000;
var md5 = require('md5');


// MySQL Database Connection
// const db = mysql.createPool({
//     host: "bjv7zymcg5dqzoirzmkl-mysql.services.clever-cloud.com",
//     user: "uf1qiobjetr5bitq",
//     password: "hnOQYB2Wjk7UAUP3DGRT",
//     database: "bjv7zymcg5dqzoirzmkl",
//     debug: false,
//     connectionLimit: 100,
//   });
  
const db = mysql.createPool({
    host: "223.237.54.143",
    user: "twrvvgmy_ethiai_db_user",
    password: "ethiai_db_user@2026",
    database: "twrvvgmy_ethiai_db",
    debug: false,
    connectionLimit: 10,
  });

// Handle connection and errors
db.getConnection((err, connection) => {
    if (err) {
        // Handle specific error codes
        switch (err.code) {
            case "PROTOCOL_CONNECTION_LOST":
                console.error("Database connection was closed.");
                break;
            case "ER_CON_COUNT_ERROR":
                console.error("Database has too many connections.");
                break;
            case "ECONNREFUSED":
                console.error("Database connection was refused.");
                break;
            default:
                console.error("Database connection error:", err.message);
                break;
        }
        return; // Exit if there is an error
    }

    if (connection) {
        console.log("Database is connected successfully.");
        connection.release(); // Release the connection back to the pool
    }
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
    db.query(checkEmailQuery, [email, pass], (err, result) => {
        if (err) {
            console.error('Error checking email:', err);
            return res.status(200).json({ error: 'Database error', status: '2' });
        }
        console.log(result.length);
        if (result.length === 0) {
            // Email already exists
            return res.status(200).json({ message: 'Invalid detail', status: '2' });
        } else {
            res.status(201).json({ message: 'Login successfully', result: result, status: '1' });
        }

        // If email does not exist, insert the new user

    });
});
app.post('/admin/login', async (req, res) => {
    const { email, password } = req.body;
    var pass = md5(password);
    const checkEmailQuery = 'SELECT * FROM admin WHERE email = ? And password =?';
    db.query(checkEmailQuery, [email, pass], (err, result) => {
        if (err) {
            console.error('Error checking email:', err);
            return res.status(200).json({ error: 'Database error', status: '2' });
        }
        console.log(result);
        if (result.length === 0) {
            // Email already exists
            return res.status(200).json({ message: 'Invalid detail', status: '2' });
        } else {
            res.status(201).json({ message: 'Login successfully', result: result, status: '1' });
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
app.post('/admin/getallquizusers', (req, res) => {

    // Check if email already exists in the database
    const userId = req.body.userId; // Get user_id from query parameters
    console.log(userId);
    const checkUserAttemptQuery = `
        SELECT qa.user_id, qa.quiz_id, q.id AS quiz_id, q.* 
        FROM quiz_attempts qa
        JOIN quizzes q ON qa.quiz_id = q.id
        WHERE qa.user_id = ?
        GROUP BY qa.quiz_id
        ORDER BY qa.id DESC
    `;

    db.query(checkUserAttemptQuery, [userId], (err, result) => {
        if (err) {
            console.error('Error fetching user quiz attempts:', err);
            return res.status(500).json({ error: 'Database error', status: '2' });
        }

        return res.status(200).json({ result: result });
    });

});
app.post('/admin/getallquizuser', (req, res) => {
    const { user_id } = req.body;

    // Validate input
    if (!user_id) {
        return res.status(400).json({ error: 'User ID is required', status: '1' });
    }

    // Query to fetch quizzes for a specific user
    const fetchQuizUsersQuery = `
        SELECT 
            q.id AS quiz_id, 
            q.title AS quiz_title, 
             q.id, 
            qa.user_id, 
            u.name AS user_name, 
            u.email AS user_email, 
            COUNT(qa.id) AS attempts_count
        FROM 
            quizzes q
        LEFT JOIN 
            quiz_attempts qa ON q.id = qa.quiz_id
        LEFT JOIN 
            signup u ON qa.user_id = u.id
        WHERE 
            qa.user_id = ?
        GROUP BY 
            q.id, qa.user_id
        ORDER BY 
            q.id DESC
    `;

    db.query(fetchQuizUsersQuery, [user_id], (err, result) => {
        if (err) {
            console.error('Error fetching quiz users:', err);
            return res.status(500).json({ error: 'Database error', status: '2' });
        }

        if (result.length === 0) {
            return res.status(200).json({ message: 'No quizzes found for the given user', status: '0' });
        }

        return res.status(200).json({ result });
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

            // Delete quiz_attempts related to the quiz
            connection.query(
                `DELETE qa FROM quiz_attempts qa
                 JOIN questions q ON qa.question_id = q.id
                 WHERE q.quiz_id = ?`,
                [id],
                (error) => {
                    if (error) {
                        return connection.rollback(() => {
                            console.error("Failed to delete quiz_attempts:", error);
                            connection.release();
                            res.status(500).json({ error: "Failed to delete quiz attempts" });
                        });
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
                                    console.error("Failed to delete answers:", error);
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
                                            console.error("Failed to delete questions:", error);
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
                                                    console.error("Failed to delete quiz:", error);
                                                    connection.release();
                                                    res.status(500).json({ error: "Failed to delete quiz" });
                                                });
                                            }

                                            // Commit transaction
                                            connection.commit((commitError) => {
                                                connection.release();
                                                if (commitError) {
                                                    console.error("Failed to commit transaction:", commitError);
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

            // Step 1: Delete related records in child tables
            connection.query(
                `DELETE FROM quiz_attempts WHERE user_id = ?`, // Example child table
                [id],
                (error) => {
                    if (error) {
                        return connection.rollback(() => {
                            console.error("Failed to delete quiz_attempts:", error);
                            connection.release();
                            res.status(500).json({ error: "Failed to delete related quiz attempts" });
                        });
                    }

                    // Step 2: Delete user from signup table
                    connection.query(
                        `DELETE FROM signup WHERE id = ?`,
                        [id],
                        (error) => {
                            if (error) {
                                return connection.rollback(() => {
                                    console.error("Failed to delete user:", error);
                                    connection.release();
                                    res.status(500).json({ error: "Failed to delete user" });
                                });
                            }

                            // Commit transaction
                            connection.commit((commitError) => {
                                connection.release();
                                if (commitError) {
                                    console.error("Transaction commit failed:", commitError);
                                    return res.status(500).json({ error: "Failed to commit transaction" });
                                }

                                res.status(200).json({ message: "User deleted successfully" });
                            });
                        }
                    );
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
        return res.status(200).json({ error: 'Invalid request data' });
    }

    // Process each answer and check if it exists
    const queries = answers.map(({ questionId, answerIds }) => {
        const answerIdsString = Array.isArray(answerIds) ? answerIds.join(',') : answerIds; // For Checkboxes

        return new Promise((resolve, reject) => {
            // First, check if an attempt already exists for this user, quiz, and question
            db.query(
                'SELECT id FROM quiz_attempts WHERE user_id = ? AND quiz_id = ? AND question_id = ?',
                [userId, quizId, questionId],
                (err, results) => {
                    if (err) return reject(err);

                    if (results.length > 0) {
                        // Record exists, update it
                        const attemptId = results[0].id;
                        db.query(
                            'UPDATE quiz_attempts SET answer_ids = ? WHERE id = ?',
                            [answerIdsString, attemptId],
                            (updateErr, updateResult) => {
                                if (updateErr) return reject(updateErr);
                                resolve(updateResult);
                            }
                        );
                    } else {
                        // Record does not exist, insert it
                        db.query(
                            'INSERT INTO quiz_attempts (user_id, quiz_id, question_id, answer_ids) VALUES (?, ?, ?, ?)',
                            [userId, quizId, questionId, answerIdsString],
                            (insertErr, insertResult) => {
                                if (insertErr) return reject(insertErr);
                                resolve(insertResult);
                            }
                        );
                    }
                }
            );
        });
    });

    // Execute all queries
    Promise.all(queries)
        .then(() => res.status(200).json({ message: 'Quiz submitted successfully' }))
        .catch((err) => {
            console.error('Error saving quiz attempt:', err);
            res.status(200).json({ error: 'Failed to save quiz attempt' });
        });
});

app.post('/getQuizResults', async (req, res) => {
    const { userId, quizId } = req.body;

    // Validate request data
    if (!userId || !quizId) {
        return res.status(400).json({ error: 'Invalid request data' });
    }

    try {
        // Query the database
        db.query(
            `SELECT q.title, qa.question_id, qa.answer_ids, qq.text 
             FROM quiz_attempts qa
             JOIN quizzes q ON qa.quiz_id = q.id 
             JOIN questions qq ON qa.question_id = qq.id 
             WHERE qa.user_id = ? AND qa.quiz_id = ?`,
            [userId, quizId], // Pass parameters here
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

                try {
                    // Calculate the score
                    const scoreData = await calculateScore(results);

                    // Map totalScore to each attempt
                    const attemptsWithScore = results.map((attempt, index) => ({
                        ...attempt,
                        totalScore: scoreData.totalScores[index] || 0, // Safeguard for undefined scores
                    }));

                    res.status(200).json({
                        message: 'Quiz results retrieved successfully',
                        quizTitle,
                        score: scoreData,
                        attempts: attemptsWithScore,
                    });
                } catch (err) {
                    console.error('Error calculating score:', err);
                    res.status(500).json({ error: 'Failed to calculate score' });
                }
            }
        );
    } catch (error) {
        console.error('Unexpected error:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});


app.post('/getQuiztotal', async (req, res) => {
    const { id } = req.body;

    const selectQuery = "SELECT q.id AS quiz_id, q.title AS quiz_title, COALESCE(SUM(a.risk_score), 0) AS total_risk_score FROM quizzes q LEFT JOIN questions ques ON q.id = ques.quiz_id LEFT JOIN answers a ON ques.id = a.question_id GROUP BY q.id, q.title HAVING quiz_id= ? ORDER BY q.id ASC";

    db.query(selectQuery, [id], function (error, result) {
        if (error) {
            return console.log('error in total Api');
        }
        return res.status(200).json({status:1, data:result[0].total_risk_score})

    });
});

// Function to calculate the score based on the user's answers and correct answers from the database
const calculateScore = async (attempts) => {
    let totalScore = 0; // Total risk score from user's selected answers
    let correctAttempts = 0; // Count of attempts with non-zero risk score
    let totalScores = []; // Array to store total score for each attempt

    // Fetch the sum of all possible risk scores for the quiz questions
    const questionIds = attempts.map(attempt => attempt.question_id);
    const outOfScore = await getSumOfAllRiskScores(questionIds);

    // Iterate through each attempt (each question answered by the user)
    for (const attempt of attempts) {
        const { question_id, answer_ids } = attempt;

        // Ensure answer_ids is an array (split by commas in case of multiple answers)
        const answerIdsArray = answer_ids ? answer_ids.split(',').map(id => id.trim()) : [];

        // Check if the user's answers are correct (compare with correct answers in the database)
        const { isCorrect, riskScore } = await isAnswerCorrect(question_id, answerIdsArray);

        if (isCorrect) {
            correctAttempts++;
        }

        // Add the risk score for the current attempt
        totalScore += riskScore;

        // Store the score for the individual attempt
        totalScores.push(riskScore);
    }

    // Calculate percentage score based on correct attempts
    //const percentageScore = (correctAttempts / attempts.length) * 100;
    const percentageScore = ((totalScore / outOfScore) * 100).toFixed(2);

    console.log(outOfScore);
    return {
        totalScore,        // Total risk score from the user's answers
        percentageScore,   // Percentage of questions answered correctly
        correctAttempts,   // Number of questions with non-zero risk score
        totalScores,       // Array of total scores for each attempt
        outOfScore,        // Total of all possible risk scores
    };
};



// Helper function to fetch the maximum possible risk score for a question
const getSumOfAllRiskScores = (questionIds) => {
    console.log('jj');
    console.log(questionIds);
    return new Promise((resolve, reject) => {
        db.query(
            `SELECT SUM(risk_score) AS totalRiskScore 
             FROM answers 
             WHERE question_id IN (?)`,
            [questionIds],
            (err, results) => {
                if (err) {
                    return reject(err);
                }

                // Return the total sum of all risk scores
                const totalRiskScore = results[0]?.totalRiskScore || 0;
                resolve(totalRiskScore);
            }
        );
    });
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

                // Calculate the total risk score based on selected answers
                const totalRiskScore = results.reduce((sum, answer) => sum + answer.risk_score, 0);

                // Determine if the answer is correct (total risk score > 0)
                const isCorrect = totalRiskScore > 0;

                resolve({
                    isCorrect,
                    riskScore: totalRiskScore, // Return total risk score for this attempt
                });
            }
        );
    });
};




// Start Server
app.listen(PORT, () => {
    console.log(`Server is running on http://localhost:${PORT}`);
});

