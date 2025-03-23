require('dotenv').config();
const express = require('express');
const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');
const bodyParser = require('body-parser');
const session = require('express-session');
const MongoStore = require('connect-mongo');
const jwt = require('jsonwebtoken');
const path = require('path');
const User = require('./models/userModel'); // Corrected path
const Todo = require('./models/todoModel'); // Corrected path
const app = express();

// Middleware
app.use(bodyParser.urlencoded({ extended: true }));

// Serve static files from the public directory
app.use(express.static(path.join(__dirname, 'public')));
app.set('view engine', 'ejs');

// MongoDB connection with optimized settings
mongoose.connect(process.env.MONGODB_URI, {
  serverSelectionTimeoutMS: 10000, // Increased timeout
  socketTimeoutMS: 45000,
  maxPoolSize: 10,
  minPoolSize: 2,
  dbName: 'todolist3',
  retryWrites: true,
  w: 'majority'
})
.then(() => {
  console.log("Connected to MongoDB");
})
.catch((err) => {
  console.error("MongoDB connection error:", err);
  process.exit(1);
});

// Handle MongoDB connection errors
mongoose.connection.on('error', err => {
  console.error('MongoDB connection error:', err);
});

mongoose.connection.on('disconnected', () => {
  console.log('MongoDB disconnected. Attempting to reconnect...');
});

mongoose.connection.on('connected', () => {
  console.log('MongoDB connected successfully');
});

// Session configuration
const sessionStore = MongoStore.create({
  mongoUrl: process.env.MONGODB_URI,
  collectionName: 'sessions',
  ttl: 24 * 60 * 60,
  autoRemove: 'native',
  crypto: {
    secret: process.env.SESSION_SECRET || process.env.JWT_SECRET || 'your-secret-key'
  }
});

app.use(session({
  secret: process.env.SESSION_SECRET || process.env.JWT_SECRET || 'your-secret-key',
  resave: false,
  saveUninitialized: false,
  store: sessionStore,
  cookie: {
    secure: process.env.NODE_ENV === 'production',
    httpOnly: true,
    maxAge: 24 * 60 * 60 * 1000, // 24 hours
    sameSite: 'lax'
  },
  name: 'sessionId' // Custom session name
}));

// Error handling middleware
app.use((err, req, res, next) => {
  console.error(err.stack);
  res.status(500).send('Something broke!');
});

// Add response time middleware
app.use((req, res, next) => {
  res.locals.startTime = Date.now();
  next();
});

// Add basic caching headers
app.use((req, res, next) => {
  if (req.url.includes('style.css')) {
    res.setHeader('Cache-Control', 'public, max-age=86400'); // Cache for 1 day
  }
  next();
});

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

    // Set session before redirect
    req.session.userId = user._id;
    req.session.save((err) => {
      if (err) {
        console.error('Session save error:', err);
        return res.status(500).send('Session error');
      }
      res.redirect('/todos');
    });
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