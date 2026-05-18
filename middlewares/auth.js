const { validateToken } = require("../services/auth");

function checkForAuthenticationCookie(cookieName) {
    return (req, res, next) => {
        const tokenCookieValue = req.cookies[cookieName];
        if (!tokenCookieValue) {
            return next(); // No cookie? Just move on (user is a "guest")
        }

        try {
            // THE FLOW: If cookie exists, validate it
            const userPayload = validateToken(tokenCookieValue);
            req.user = userPayload; // Attach user info to the request!
        } catch (error) {
            // Token was invalid or expired? Do nothing
        }

        return next();
    };
}

function checkForAdminOnly(req,res,next){
    if(!req.user || req.user.role !== 'ADMIN'){
        return res.status(403).send("Unauthorized");
    }
    next();
}

function restrictToLoggedIn(req, res, next) {
    if (!req.user) {
        return res.redirect("/user/signin");
    }
    next();
}

module.exports = {
    checkForAuthenticationCookie,
    checkForAdminOnly,
    restrictToLoggedIn
};

