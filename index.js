require("dotenv").config();
const express = require("express");
const cors = require("cors");
const bodyParser = require("body-parser");
const mongoose = require("mongoose");
const path = require("path");
const bcrypt = require("bcrypt");
const jwt = require("jsonwebtoken");
const nodemailer = require("nodemailer");
const randomstring = require("randomstring");

const app = express();
const PORT = 3000;

app.use(cors());
app.use(express.json());
app.use(bodyParser.urlencoded({ extended: true }));
app.use(express.static(__dirname));

const connectDB = async () => {
  try {
    const conn = await mongoose.connect(process.env.MONGO_URI);
    console.log(`MongoDB Connected: ${conn.connection.host}`);
  } catch (error) {
    console.log(error);
    process.exit(1);
  }
};

const userSchema = new mongoose.Schema({
  username: String,
  password: String,
  email: String,
  resetPasswordToken: String,
  resetPasswordExpires: Date,
});

const taskSchema = new mongoose.Schema({
  title: String,
  description: String,
  dueDate: Date,
  priority: Number,
  category: String,
  status: { type: String, default: 'pending' },
  user: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
  },
});

userSchema.pre('save', function (next) {
  // Only proceed if the password is modified or this is a new user
  if (!this.isModified('password') && !this.isNew) {
    return next();
  }

  this.resetPasswordToken = undefined;
  this.resetPasswordExpires = undefined;
  next();
});

userSchema.pre('remove', async function (next) {
  try {
    // Import the mongoose model directly to ensure it's available
    const Task = mongoose.model('Task');
    await Task.deleteMany({ user: this._id });
    next();
  } catch (error) {
    console.error(error);
    next(error);
  }
});

const Task = mongoose.model('Task', taskSchema);
const User = mongoose.model('User', userSchema);


const transporter = nodemailer.createTransport({
  service: "gmail",
  auth: {
    user: process.env.EMAIL_USERNAME,
    pass: process.env.EMAIL_PASSWORD,
  },
});

// Route to request a password reset
app.post("/forgot-password", async (req, res) => {
  try {
    const { email } = req.body;

    // Find the user by email
    const user = await User.findOne({ email });

    if (!user) {
      return res.status(404).send("User not found");
    }

    // Generate a random token for password reset
    const resetToken = randomstring.generate();

    // Save the token and expiration date to the user document
    user.resetPasswordToken = resetToken;
    user.resetPasswordExpires = Date.now() + 3600000; // Token expires in 1 hour
    await user.save();

    // Send the reset password email
    const resetLink = `${process.env.FRONTEND_URL || 'http://localhost:3000' || 'chromify.site'}/reset-password?token=${resetToken}`;
    const mailOptions = {
      from: process.env.EMAIL_USERNAME,
      to: email,
      subject: "Password Reset For ChroniFy",
      html: `
        <html>
          <head></head>
          <body>
            <p>Click <a href="${resetLink}">here</a> to reset your password.</p>
          </body>
        </html>
      `,
    };

    await transporter.sendMail(mailOptions);

    res.status(200).send("Password reset email sent");
  } catch (err) {
    console.error(err);
    res.status(500).send("Internal Server Error");
  }
});

// Route to reset password with the provided token
app.post("/reset-password", async (req, res) => {
  try {
    const { token, newPassword } = req.body;

    // Find the user by the reset token
    const user = await User.findOne({
      resetPasswordToken: token,
      resetPasswordExpires: { $gt: Date.now() },
    });

    if (!user) {
      return res.status(400).send("Invalid or expired reset token");
    }

    // Update the password
    const hashedPassword = await bcrypt.hash(newPassword, 10);
    user.password = hashedPassword;
    user.resetPasswordToken = undefined;
    user.resetPasswordExpires = undefined;
    await user.save();
    res.status(200).json({ message: "Password reset successfully" });
  } catch (err) {
    console.error(err);
    res.status(500).send("Internal Server Error");
  }
});


app.get("/login", (req, res) => {
  res.sendFile(path.join(__dirname, "login.html"));
});


// Register route
app.post("/register", async (req, res) => {
  try {
    const { username, email, password } = req.body;

    // Check if username already exists
    const existingUser = await User.findOne({ username });
    const existingEmail = await User.findOne({ email });

    if (existingUser) {
      return res.status(409).send("Username already exists");
    }
    if (existingEmail) {
      return res.status(409).send("Email already registered");
    }

    // Hash the password
    const hashedPassword = await bcrypt.hash(password, 10);
    
    // Create a new user
    const newUser = new User({
      username,
      password: hashedPassword,
      email,
    });
    
    console.log("New User:", newUser);
    await newUser.save();
    console.log("User registered successfully");
    res.status(201).send("User registered successfully");
  } catch (err) {
    console.error(err);
    res.status(500).send(`Registration failed: ${err.message}`);
  }
});

// Login route
app.post("/login", async (req, res) => {
  try {
    const { email, password } = req.body;

    // Find the user by username
    const user = await User.findOne({ email });

    if (!user) {
      return res.status(401).send("Invalid username or password");
    }

    // Check the password
    const isPasswordValid = await bcrypt.compare(password, user.password);

    if (!isPasswordValid) {
      return res.status(401).send("Invalid username or password");
    }

    const token = jwt.sign({ userId: user._id, username: user.username }, process.env.JWT_SECRET);
    console.log("Token stored in local storage:", token);


    return res.json({ token });
  } catch (err) {
    console.error(err);
    res.status(500).send("Internal Server Error");
  }
});

const invalidatedTokens = [];

app.get("/logout", (req, res) => {
  // Invalidate the token
  const token = req.header("Authorization");
  invalidatedTokens.push(token);

  // Redirect to the login page
  res.redirect("/login");
});

const verifyToken = (req, res, next) => {
    const token = req.header("Authorization");
    try { 
        const decoded = jwt.verify(token, process.env.JWT_SECRET);
        console.log("Token decoded:", decoded);
        req.user = decoded;
        next();
    } catch (ex) {
        console.error("Invalid token:", token);
        return res.redirect("/login");
    }
};


app.get("/", verifyToken, (req, res) => {
  const token = req.query.token;
  if (!token) {
    return res.redirect("/login");
  }
  res.sendFile(path.join(__dirname, "index.html"));
});

app.get('/reset-password', (req, res) => {
  res.sendFile(path.join(__dirname, 'reset-password.html'));
});

app.get("/login", (req, res) => {
  res.sendFile(path.join(__dirname, "login.html"));
});

app.get("/viewTasks", (req, res) => {
  res.sendFile(path.join(__dirname, "viewTasks.html"));
});

app.post("/tasks/create", verifyToken, async (req, res) => {
    try {
        const newTask = new Task({
            title: req.body.title,
            description: req.body.description,
            dueDate: req.body.dueDate,
            priority: req.body.priority,
            category: req.body.category,
            user: req.body.user,
        });

        await newTask.save();
        console.log("Data inserted successfully");
        res.redirect("/");
    } catch (err) {
        console.error(err);
        res.status(500).send("Internal Server Error");
    }
});

// Add this route after the verifyToken middleware
app.get("/user", verifyToken, async (req, res) => {
  try {
    // Retrieve user information based on the decoded token
    const user = await User.findOne({ username: req.user.username });

    if (!user) {
      console.error("User not found");
      return res.status(404).send("User not found");
    }

    // Return user information
    res.json({
      username: user.username,
      userId: user._id,
    });
  } catch (err) {
    console.error(err);
    res.status(500).send("Internal Server Error");
  }
});

app.get("/categories", verifyToken, async (req, res) => {
  try {
    const categories = await Task.distinct("category", { user: req.user.userId });
    res.json(categories);
  } catch (err) {
    console.error(err);
    res.status(500).send("Internal Server Error");
  }
});

app.get("/tasks", async (req, res) => {
  try {
    let sortQuery = {};

    if (req.query.sortBy) {
      if (req.query.sortBy === "priority") {
        sortQuery.priority = 1;
      } else if (req.query.sortBy === "dueDate") {
        sortQuery.dueDate = 1;
      }
    }

    let filterQuery = {};

    if (req.query.category) {
      filterQuery.category = req.query.category;
    }

    if (req.query.status) {
      filterQuery.status = req.query.status;
    }

    if (req.query.search) {
      filterQuery.$or = [
        { title: { $regex: new RegExp(req.query.search, "i") } },
        { description: { $regex: new RegExp(req.query.search, "i") } },
      ];
    }
    filterQuery.user = req.query.userId;
    const tasks = await Task.find(filterQuery).sort(sortQuery);

    console.log("Tasks are retrieved from the database");
    res.json(tasks);
  } catch (err) {
    console.error(err);
    res.status(500).send("Internal Server Error");
  }
});

app.get("/tasks/:taskId", async (req, res) => {
    try {
      const taskId = req.params.taskId;
      // Only retrieve the task if it is associated with the logged-in user
      const task = await Task.findOne({ _id: taskId});
  
      if (!task) {
        return res.status(404).send("Task not found");
      }
  
      res.json(task);
      console.log("item retrieved");
    } catch (err) {
      console.error(err);
      res.status(500).send("Internal Server Error");
    }
  });

  app.put("/tasks/:taskId", async (req, res) => {
    try {
      const taskId = req.params.taskId;
      // Ensure the task is associated with the logged-in user
      const task = await Task.findOne({ _id: taskId});
  
      if (!task) {
        console.log("Task not found");
        return res.status(404).send("Task not found");
      }
  
      const updatedTask = {
        title: req.body.title,
        description: req.body.description,
        dueDate: req.body.dueDate,
        priority: req.body.priority,
        category: req.body.category,
      };
      
    // Update the task
    const updatedTaskResult = await Task.findByIdAndUpdate(taskId, updatedTask, {
        new: true,
      });
  
      console.log("Task updated successfully");
      res.json(updatedTaskResult);
    } catch (err) {
      console.error(err);
      res.status(500).send("Internal Server Error");
    }
});

app.put("/tasks/:taskId/complete", async (req, res) => {
  try {
    const taskId = req.params.taskId;

    const task = await Task.findOne({ _id: taskId})

    if (!task) {
      return res.status(404).send("Task not found");
    }

    // Toggle the status between 'pending' and 'completed'
    const newStatus = task.status === "pending" ? "completed" : "pending";

    // Update the task with the new status
    const updatedTask = await Task.findByIdAndUpdate(
      taskId,
      { status: newStatus },
      { new: true }
    );

    res.json(updatedTask);
    console.log("Item status toggled");
  } catch (err) {
    console.error(err);
    res.status(500).send("Internal Server Error");
  }
});

app.delete("/tasks/:taskId", async (req, res) => {
  try {
    const taskId = req.params.taskId;
    const deletedTask = await Task.findOneAndDelete({ _id: taskId});


    if (!deletedTask) {
      return res
        .status(404)
        .json({ error: "Task not found so could not delete" });
    }

    res.json({ message: "Task has been deleted successfully" });
  } catch (err) {
    console.error(err);
    res.status(500).send("Internal Server Error");
  }
});

//Connect to the database before listening
connectDB().then(() => {
  app.listen(PORT, () => {
    console.log(`Server is running`);
  });
})