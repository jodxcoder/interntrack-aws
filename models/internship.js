const { Schema, model } = require("mongoose");

const internshipSchema = new Schema({
    companyName: {
        type: String,
        required: true,
    },
    jobTitle: {
        type: String,
        required: true,
    },
    location: {
        type: String,
        default: "Remote",
    },
    status: {
        type: String,
        enum: ["Applied", "Under Review", "Interview", "Selected", "Rejected"],
        default: "Applied",
    },
    appliedDate: {
        type: Date,
        default: Date.now,
    },
    // THE FLOW: We link this to the User (the creator: Admin or Student)
    creator: {
        type: Schema.Types.ObjectId,
        ref: "user",
        required: true,
    },
    notes: String,
    // Add this inside your internshipSchema
    jobDescription: {
        type: String,
        required: true, // We make it required so the AI always has data to work with
    },
    aiScore: {
    type: String,
    default: null,
},
resumePath: {
    type: String,
    default: null,
},  
}, { timestamps: true });

const Internship = model("internship", internshipSchema);
module.exports = Internship;
