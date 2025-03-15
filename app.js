require('dotenv').config();
const express = require('express');
const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');
const bodyParser = require('body-parser');
const session = require('express-session');
const jwt = require('jsonwebtoken');
const User = require('./models/userModel'); // Corrected path
const Todo = require('./models/todoModel'); // Corrected path
const app = express();

app.use(bodyParser.urlencoded({ extended: true }));
app.use(express.static('public'));
app.set('view engine', 'ejs');

// MongoDB connection with better error handling and timeout settings
mongoose.connect(process.env.MONGODB_URI, {
  useNewUrlParser: true,
  useUnifiedTopology: true,
  serverSelectionTimeoutMS: 5000, // Timeout after 5s instead of 30s
  socketTimeoutMS: 45000, // Close sockets after 45s of inactivity
})
.then(() => console.log("Connected to MongoDB"))
.catch((err) => {
  console.error("MongoDB connection error:", err);
  process.exit(1);  // Exit if cannot connect to database
});

// Handle MongoDB connection errors after initial connection
mongoose.connection.on('error', err => {
  console.error('MongoDB connection error:', err);
});

mongoose.connection.on('disconnected', () => {
  console.log('MongoDB disconnected. Attempting to reconnect...');
});

mongoose.connection.on('reconnected', () => {
  console.log('MongoDB reconnected');
});

// Session configuration using environment variables
app.use(session({
  secret: process.env.SESSION_SECRET || process.env.JWT_SECRET,  // Fallback to JWT_SECRET if SESSION_SECRET not set
  resave: false,
  saveUninitialized: false,  // Changed to false for better security
  cookie: {
    secure: process.env.NODE_ENV === 'production',  // Use secure cookies in production
    httpOnly: true,  // Protect against XSS
    maxAge: 24 * 60 * 60 * 1000 // 24 hours
  }
}));

app.get('/', (req, res) => {
  res.render('login');
});

app.get('/register', (req, res) => {
  res.render('register');
});

app.post('/register', async (req, res) => {
  const { username, password } = req.body;

  try {
    const existingUser = await User.findOne({ username });
    if (existingUser) {
      return res.status(400).send('Username already exists');
    }

    const hashedPassword = await bcrypt.hash(password, 10);

    const newUser = new User({
      username,
      password: hashedPassword
    });

    await newUser.save();
    res.send('Registration successful! You can now <a href="/">login</a>');
  } catch (error) {
    console.error('Error during registration:', error);
    res.status(500).send('Server error');
  }
});

app.post('/login', async (req, res) => {
  const { username, password } = req.body;

  try {
    const user = await User.findOne({ username });
    if (!user) {
      return res.status(400).send("User not found");
    }

    const isMatch = await bcrypt.compare(password, user.password);
    if (!isMatch) {
      return res.status(400).send("Invalid password");
    }

    const token = jwt.sign({ userId: user._id }, process.env.JWT_SECRET, { expiresIn: '1h' });
    req.session.userId = user._id;
    res.redirect('/todos'); // Redirect to /todos after successful login
  } catch (error) {
    console.error("Error during login:", error);
    res.status(500).send('Server error');
  }
});

app.get('/todos', async (req, res) => {
  if (!req.session.userId) {
    return res.status(401).send('Unauthorized');
  }

  try {
    const todos = await Todo.find({ userId: req.session.userId });
    res.render('todo', { todos });
  } catch (error) {
    console.error('Error fetching todos:', error);
    res.status(500).send('Server error');
  }
});

app.post('/todos', async (req, res) => {
  if (!req.session.userId) {
    return res.status(401).send('Unauthorized');
  }

  const { text } = req.body;

  try {
    const newTodo = new Todo({
      userId: req.session.userId,
      text
    });

    await newTodo.save();
    res.redirect('/todos');
  } catch (error) {
    console.error('Error adding todo:', error);
    res.status(500).send('Server error');
  }
});

app.post('/todos/:id/delete', async (req, res) => {
  if (!req.session.userId) {
    return res.status(401).send('Unauthorized');
  }

  try {
    await Todo.deleteOne({ _id: req.params.id, userId: req.session.userId });
    res.redirect('/todos');
  } catch (error) {
    console.error('Error deleting todo:', error);
    res.status(500).send('Server error');
  }
});

app.post('/todos/:id/edit', async (req, res) => {
  if (!req.session.userId) {
    return res.status(401).send('Unauthorized');
  }

  const { text } = req.body;

  try {
    const todo = await Todo.findOne({ _id: req.params.id, userId: req.session.userId });
    if (!todo) {
      return res.status(404).send('Todo not found');
    }

    todo.text = text;
    await todo.save();
    res.redirect('/todos');
  } catch (error) {
    console.error('Error editing todo:', error);
    res.status(500).send('Server error');
  }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Server is running  http://localhost:${PORT}`);
});

module.exports = app;