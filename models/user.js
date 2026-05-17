const { Schema, model } = require("mongoose");
const { createHmac, randomBytes } = require("crypto");

const {createTokenForUser} = require('../services/auth')

const userSchema = new Schema({
    fullName: {
        type: String,
        required: true,
    },
    email: {
        type: String,
        required: true,
        unique: true,
    },
    salt: {
        type: String, // Used for extra security in hashing
    },
    password: {
        type: String,
        required: true,
    },
    profileImageURL: {
        type: String,
        default: "/images/default.png",
    },
    role: {
        type: String,
        enum: ["STUDENT", "ADMIN"],
        default: "STUDENT",
    },
}, { timestamps: true });


userSchema.pre("save", async function () {
    const user = this;
    if (!user.isModified("password")) return ;

    
    const salt = randomBytes(16).toString('hex');
    
    
    const hashedPassword = createHmac("sha256", salt)
        .update(user.password)
        .digest("hex");

   
    this.salt = salt;
    this.password = hashedPassword;
    
});

// THE FLOW: Verification Logic for Login
userSchema.static("matchPasswordAndGenerateToken", async function (email, password) {
    const user = await this.findOne({ email });
    if (!user) throw new Error("User not found!");

    const salt = user.salt;
    const hashedPassword = user.password;

    const userProvidedHash = createHmac("sha256", salt)
        .update(password)
        .digest("hex");

    if (hashedPassword !== userProvidedHash) throw new Error("Incorrect Password");

    // If password matches, create the token and return it
    const token = createTokenForUser(user);
    return token;
});



const User = model("user", userSchema);
module.exports = User;
