const express = require("express");
const shell = require("shelljs");
const cp = require("child_process");
const ejs = require("ejs");
const spawn = cp.spawn;
const bodyParser = require("body-parser");
const mongoose = require("mongoose");

var passport = require("passport");
var LocalStrategy = require("passport-local");
var passportLocalMongoose = require("passport-local-mongoose");

var Comedian = require("./models/comedian");

var currentTestingVideoId = '';

mongoose.connect("mongodb://localhost/fyp");

const app = express();

app.use(bodyParser.json()); 
app.use(express.static('public'));
app.use(bodyParser.urlencoded({extended:true}));


app.use(passport.initialize());
app.use(passport.session());

passport.use(new LocalStrategy(Comedian.authenticate()));
passport.serializeUser(Comedian.serializeUser());
passport.deserializeUser(Comedian.deserializeUser());

app.use(require("express-session")({
    secret : "Sanchit is such a good developer",
    resave : false,
    saveUninitialized : false
}));




function videoIdGenerator(link)
{
    var video_id = link.split('embed/')[1];
        var ampersandPosition = video_id.indexOf('&');
        if(ampersandPosition != -1) {
            video_id = video_id.substring(0, ampersandPosition);
        }
        return video_id;
}

function getThumbnail(vid)
{
    return "https://img.youtube.com/vi/"+vid+"/0.jpg";
}


function getSelectedVideo(identity)
{
    var allVideos = getPendingVideos();
    var selectedVideo = {};
    for(var i=0;i<allVideos.length;i++)
    {
        if(allVideos[i].id === identity)
        {
            selectedVideo = allVideos[i];
            break;
        }
    };
    return selectedVideo;
}

function getPendingVideos()
{
  //return pendingVideo.find();
  Promise.all([
    pendingVideo.find({'tsURL': ''}).exec(),
    AccountModel.find({'cpURL': ''}).exec(),
  ]).then(filteredVideos => {
    return filteredVideos;
  }).catch(err=>console.log("Error getting pendingVideos"));
}



//*************************************** */pendingVideo Database Definition stuff ***********************************//


var pendingVideosSchema = new mongoose.Schema({
    comedian : String,
    link:String,
    thNail : String,
    vid :String,
    title : String,
    tsURL : String, 
    cpURL : String
});

var pendingVideo = mongoose.model("pendingVideo",pendingVideosSchema);

//----------------------------ROUTES---------------------------------------//

app.get("/",function(req,res)
{
    res.render("home.ejs");
});

app.get("/aboutUs",function(req,res)
{
    res.render("aboutUs.ejs");
});

app.get("/getStarted",function(req,res)
{
    res.render("getStarted.ejs");
});

app.get("/userLogin",function(req,res)
{
    res.render("userLogin.ejs");
});

app.get("/testerLogin",function(req,res)
{
    res.render("testerLogin.ejs");
});

app.get("/comedianLogin",function(req,res)
{
    res.render("comedianLogin.ejs");
});

app.post("/comedianLogin",passport.authenticate("local" , {
    successRedirect : "/comedianForm",
    failureRedirect : "/comedianLogin"}),function(req,res){
    });


app.get("/userSignUp",function(req,res)
{
    res.render("userSignUp.ejs");
});

app.get("/comedianSignUp",function(req,res)
{
    res.render("comedianSignup.ejs");
});

app.post("/comedianSignUp",function(req,res){
    //all signUp logic handling.
    //res.send("regsteration");
    Comedian.register(new Comedian({username : req.body.username , email : req.body.email}) , req.body.password , function(err,comedian){
        if(err){
            console.log(err+"maa k choot");
            return res.render("/comedianSignUp");
        }
        passport.authenticate("local")(req,res,function(){
            res.redirect("/comedianLogin");
        });
    });
});

app.post("/tester/pendingWork",function(req,res)
{
    var Tid = req.body.testerID;
    pendingVideo.find({'tsURL' : '' , 'cpURL' : ''},function(err,allVideos)
    {
        if(err)
        {
            res.send("Error on internet connection");
        }
        else
        {
            res.render("pendingWork.ejs",{pendingVideos : allVideos , id:Tid});
        }
    });
});

app.get("/comedianForm",function(req,res)
{
    res.render("comedianDataForm.ejs");
});

app.post("/comedian/dataUploaded",function(req,res)
{
    var comedian = req.body.comedian;
    var link = req.body.link;
    var title = req.body.title;
    var videoId = videoIdGenerator(link);
    var thumbNail = getThumbnail(videoId);
    var videoToDb = new pendingVideo({comedian : comedian , link: link,title : title,vid : videoId, thNail : thumbNail,tsURL : '', cpURL : ''});
    videoToDb.save(function(err,video)
    {
        if(err)
        {
            var heading = "OOPS! Something Went Wrong!";
            var message = "Check your Internet Connection and try again";
            console.log("error");
            res.render("comedianDataUploaded.ejs",{heading : heading , message : message});
        }
        else
        {
            var heading = "Thanks , We have received your data";
            var message = "This page is just an acknowledgement that your data has been uploaded to our servers , Soon we will get back to you with the feedback on your video through Email from our qualified testers , Thanks for connecting with hasee to phasee";
            console.log("succesfull upload",video);
            res.render("comedianDataUploaded.ejs",{heading : heading , message : message});
        }
    });
});

app.get("/user/:userName/topVideos",function(req,res)
{
    res.render("topVideos.ejs");
});

app.get("/predict/:vidID", function(req,res)
{
    var vid = req.params.vidID;
    currentTestingVideoId = req.params.vidID;
    pendingVideo.findById(vid,function(err,foundVideo)
    {
        if(err)
        {
            console.log(err);
        }
        else
        {
            console.log("video found");
            console.log(foundVideo); 
            var proc = spawn("python", ["videoTester.py", req.params.vidID]);
            res.render("mlmodel.ejs",{video : foundVideo});
            res.end("exec ho gya");
        }
    });
    
});


app.post("/postReaction", function (req, res) {
   var data = req.body;
   var tsURL = data.tsURL;
   var cpURL = data.cpURL;
   console.log(tsURL);

   if(currentTestingVideoId!=''){
        pendingVideo.findById(currentTestingVideoId).then(foundVideo => {
            foundVideo.tsURL = tsURL;
            foundVideo.cpURL = cpURL;

            return foundVideo.save()
        }).then(result=>{
            console.log("DONE TESTING!");
        }).catch(err=>console.log(err));
   }

});

app.get("user/forgotPassword",function(req,res)
{
    res.render("userForgot.ejs");
});
app.get("comedian/forgotPassword",function(req,res)
{
    res.render("comedianForgot.ejs");
});

app.get("/logout",function(req,res){
    req.logout();
    res.redirect("/");
});

app.post("/giveReview",function(req,res){
    var loggedInComedian = req.session.passport.user;
    pendingVideo.find({'comedian' : loggedInComedian , 'tsURL' : {$ne : ''}},function(err,reviewedVideosOfThisComedian)
    {
        if(err)
        {
            res.send("Error on internet connection");
        }
        else
        {
            res.render("ReviewAnalysis.ejs",{videos : reviewedVideosOfThisComedian , loggedInComedian : loggedInComedian});
        }
    });
});

app.listen(3000,function()
{
    console.log("server working!");
});

