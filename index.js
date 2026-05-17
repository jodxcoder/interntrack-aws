const express = require("express");
const Internship = require("./models/internship");

const userRoutes = require('./routes/user')
const internshipRoutes = require("./routes/internship");


const path = require("path");
const { checkForAuthenticationCookie } = require("./middlewares/auth");
const cookieParser = require("cookie-parser");




const mongoose = require("mongoose"); // 1. Import the translator

const app = express();
const PORT = 8000;


app.use(cookieParser()); // Ensure this is already there
app.use(checkForAuthenticationCookie("token")); // Tell the app to check for the "token" cookie


// 2. Configure View Engine
app.set("view engine", "ejs");
app.set("views", path.resolve("./views"));


// 2. Connect to the Database
mongoose.connect("mongodb://127.0.0.1:27017/interntrack")
    .then(() => console.log("✅ MongoDB Connected"))
    .catch((err) => console.log("❌ Mongo Error", err));


// 3. Middlewares
app.use(express.urlencoded({ extended: false })); // To understand Form Data
app.use(express.static(path.resolve("./public"))); // To serve CSS/Images



app.get("/", async (req, res) => {
    if (!req.user) return res.redirect("/user/signin");

    // Fetch all internships for this user
    const allInternships = await Internship.find({ creator: req.user._id });

    // Calculate Stats
    const stats = {
        total: allInternships.length,
        applied: allInternships.filter(i => i.status === 'Applied').length,
        interviews: allInternships.filter(i => i.status === 'Interview').length,
    };

    return res.render("home", {
        user: req.user,
        internships: allInternships,
        stats: stats // Send the stats to the page!
    });
});


app.use('/user', userRoutes);
app.use("/internship", internshipRoutes);




app.listen(PORT, () => console.log(`Server started at http://localhost:${PORT}`));
