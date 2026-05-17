const fs = require('fs');
const pdfParse = require('pdf-parse');
const { checkForAdminOnly } = require('../middlewares/auth')

const Groq = require("groq-sdk");

// THE FLOW: Setup the AI with your Key
const groq = new Groq({ apiKey: process.env.GROQ_API_KEY });

const { Router } = require('express')
const path = require('path')

const multer = require('multer')


const Internship = require('../models/internship')

const router = Router()


// THE FLOW: Setting up the storage engine
const storage = multer.diskStorage({
    destination: function (req, file, cb) {
        cb(null, path.resolve(`./public/uploads/`)); // Files go here
    },
    filename: function (req, file, cb) {
        const fileName = `${Date.now()}-${file.originalname}`; // Unique filename
        cb(null, fileName);
    },
});
const upload = multer({ storage: storage });



// GET /feed - Show all official internships (MUST be above /view/:id)
router.get('/feed', async (req, res) => {
    const publicJobs = await Internship.find({}).populate('creator');
    const officialJobs = publicJobs.filter(job => job.creator && job.creator.role === "ADMIN");
    return res.render("feed", {
        user: req.user,
        jobs: officialJobs,
    });
});


router.get('/add-new', checkForAdminOnly, (req, res) => {
    return res.render('addInternship', { user: req.user })
})

router.get('/view/:id', async (req, res) => {
    // 1. Fetch the internship AND its creator
    const internship = await Internship.findById(req.params.id).populate('creator');

    // 2. ADMIN ONLY: Fetch students who are tracking this job
    let applicants = [];
    if (req.user.role === 'ADMIN' && internship.creator._id.toString() === req.user._id.toString()) {
        applicants = await Internship.find({
            companyName: internship.companyName,
            jobTitle: internship.jobTitle,
            creator: { $ne: req.user._id } // Don't include the admin themselves
        }).populate('creator');
    }

    // 3. CHECK IF ALREADY TRACKING (For Students):
    const isAlreadyTracking = await Internship.findOne({
        creator: req.user._id,
        companyName: internship.companyName,
        jobTitle: internship.jobTitle
    });

    // 4. UPDATED SECURITY:
    const isOwner = internship.creator._id.toString() === req.user._id.toString();
    const isAdminJob = internship.creator.role === 'ADMIN';

    if (!isOwner && !isAdminJob) {
        return res.status(403).send("Unauthorized: You don't have access to this application.");
    }

    return res.render('internshipDetails', {
        user: req.user,
        internship: internship,
        applicants: applicants,
        isAlreadyTracking: !!isAlreadyTracking
    });
});

// GET /update-status/:id - Render the status update page
router.get('/update-status/:id', async (req, res) => {
    if (req.user.role !== 'ADMIN') return res.status(403).send("Admins only.");
    const application = await Internship.findById(req.params.id).populate('creator');
    return res.render('updateStatus', { user: req.user, application });
});

// POST /update-status/:id - Actually update the status
router.post('/update-status/:id', async (req, res) => {
    if (req.user.role !== 'ADMIN') return res.status(403).send("Admins only.");
    const { status } = req.body;
    const application = await Internship.findByIdAndUpdate(req.params.id, { status }, { new: true });

    // Find the ADMIN's original posting to redirect back to
    const adminOriginal = await Internship.findOne({
        companyName: application.companyName,
        jobTitle: application.jobTitle,
        creator: req.user._id
    });

    // Redirect admin back to THEIR version of the job (with the applicant table)
    return res.redirect(`/internship/view/${adminOriginal._id}`);
});

router.post('/', checkForAdminOnly, async (req, res) => {
    const { companyName, jobTitle, location, notes, jobDescription } = req.body
    await Internship.create({
        companyName,
        jobTitle,
        location,
        notes,
        jobDescription,
        creator: req.user._id,
    })
    return res.redirect('/')
})

// THE FLOW: Catching the uploaded PDF, extracting text, and calling Gemini
router.post("/analyze/:id", upload.single("resume"), async (req, res) => {
    if (!req.file) return res.status(400).send("No file uploaded.");

    try {
        // 1. Fetch the internship (to get the Job Description)
        const internship = await Internship.findById(req.params.id);

        // 2. Read the PDF file from the disk
        const dataBuffer = fs.readFileSync(req.file.path);

        // 3. Extract text from the PDF using the stable version
        const pdfData = await pdfParse(dataBuffer);
        const resumeText = pdfData.text;

        console.log("Resume Text Extracted! Length:", resumeText.length);

        const prompt = `
            You are an expert ATS (Applicant Tracking System) analyzer. 
            Compare the following Resume with the Job Description.
            
            Job Description: ${internship.jobDescription}
            Resume: ${resumeText}

            Provide the response in this EXACT format:
            Match Score: [0-100]%
            Matching Keywords: [List 5-10 keywords found]
            Missing Keywords: [List 5-10 important keywords missing]
            Recommendation: [One sentence advice]
        `;

        const response = await groq.chat.completions.create({
            model: "llama-3.3-70b-versatile", // Try this model
            messages: [
                {
                    role: "system",
                    content: "You are a helpful assistant."
                },
                {
                    role: "user",
                    content: prompt
                }
            ]

        });

        const aiResult = response.choices[0].message.content;
        // After getting the aiResult, save it:
        await Internship.findByIdAndUpdate(req.params.id, {
            aiScore: aiResult,
            resumePath: req.file.path
        });


        // 5. Render back the same page but with the AI result!
        return res.render("internshipDetails", {
            user: req.user,
            internship,
            aiResult,
        });

    } catch (error) {
        console.error("AI Error:", error);
        return res.status(500).send("AI Analysis failed. Make sure your API key is correct.");
    }
});



// (feed route moved to top of file)


// POST /internship/track/:id - Add an official job to student's dashboard
router.get('/track/:id', async (req, res) => {
    const officialJob = await Internship.findById(req.params.id);

    // Create a NEW internship record for this specific student
    await Internship.create({
        companyName: officialJob.companyName,
        jobTitle: officialJob.jobTitle,
        location: officialJob.location,
        jobDescription: officialJob.jobDescription,
        status: "Applied",
        creator: req.user._id, // Assign it to the current creator
    });

    return res.redirect('/'); // Go back to dashboard to see it!
});



module.exports = router