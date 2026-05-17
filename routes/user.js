const {Router} = require('express')
const User = require("../models/user");

const router = Router()


router.get('/signup',(req,res)=>{
    res.render('signup')
})


// 2. Handle the POST request
router.post("/signup", async (req, res) => {
    const { fullName, email, password } = req.body; // Extract data from the form
    
    await User.create({
        fullName,
        email,
        password,
    });
    return res.redirect("/"); // After saving, go to the home page
});

router.get('/signin',(req,res)=>{
    res.render('signin')
})

// 2. POST Route: To handle the actual login
router.post("/signin", async (req, res) => {
    const { email, password } = req.body;
    try {
        // THE FLOW: We call the static method we just wrote!
        const token = await User.matchPasswordAndGenerateToken(email, password);
        // THE FLOW: We store the token in a Cookie called "token"
        return res.cookie("token", token).redirect("/");
    } catch (error) {
        // If password is wrong or email not found, show the page again with an error
        return res.render("signin", {
            error: "Incorrect Email or Password",
        });
    }
});

// THE FLOW: Logging Out
router.get("/logout", (req, res) => {
    // We clear the cookie named 'token'
    res.clearCookie("token").redirect("/");
});


module.exports=router;