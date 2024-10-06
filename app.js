const express = require("express");
const app = express();
const mongoose = require("mongoose");
const Listing = require("./models/listing.js");
const path = require("path");
const methodOverride = require("method-override");
const ejsMate = require("ejs-mate");
const Review = require("./models/review.js");
const { wrap } = require("module");
const session = require("express-session")
const flash = require("connect-flash");
const passport = require("passport");
const LocalStrategy = require("passport-local");
const User = require("./models/user.js");
const {isLoggedIn} = require("./middleware.js");
const {saveRedirectUrl} = require("./middleware.js");
const { isOwner} = require("./middleware.js");
const{ isReviewAuthor } = require("./middleware.js");

const mbxGeocoding = require('@mapbox/mapbox-sdk/services/geocoding');
const mapToken  = 'pk.eyJ1IjoidGhlY2xhc3Nyb29tIiwiYSI6ImNscnJ6dXo4ajAxYTMya3A0NG55cW1pMjYifQ.oLJ-X878O9NJFYwI_rwiLQ';

const geocodingClient = mbxGeocoding({ accessToken: mapToken});

const MONGO_URL = "mongodb://127.0.0.1:27017/Wanderbnb"

main()
  .then(() => {
    console.log("connected to DB");
  })
  .catch((err) => {
    console.log(err);
  });

async function main() {
  await mongoose.connect(MONGO_URL);
}

app.set("view engine", "ejs");
app.set("views", path.join(__dirname, "views"));
app.use(express.urlencoded({ extended: true }));
app.use(methodOverride("_method"));
app.engine("ejs", ejsMate);
app.use(express.static(path.join(__dirname, "/public")));



// app.get("/", (req, res) => {
//   res.send("Hi, I am root");
// });

const sessionOptions = {
  secret: "mysupersecretcode",
  resave: false,
  saveUnitialized: true,
  cookie: {
    expires: Date.now() + 7 * 24 * 60 * 60 * 1000,
    maxAge: 7 
    * 24 * 60 * 60 * 1000,
    httpOnly: true,
  },
};


app.use(session(sessionOptions));
app.use(flash());

app.use(passport.initialize());
app.use(passport.session());
passport.use(new LocalStrategy(User.authenticate()));

passport.serializeUser(User.serializeUser());
passport.deserializeUser(User.deserializeUser());


app.use((req, res ,next) => {
  res.locals.success = req.flash("success");
  res.locals.error = req.flash("error");
  res.locals.currUser = req.user;
  next();
});

//demo user
// app.get("/demouser", async (req, res) => {
//   let fakeUser = new User ({
//     email:"student@gmail.com",
//     username: "delta-teacher",
//   })

//   let registerUser = await User.register(fakeUser, "hello");
//   res.send(registerUser);
// })

//signup user
app.get("/signup", (req, res) => {
 res.render("users/signup.ejs")
})

//signup route
app.post("/signup", async(req, res) => {
  try {
    let {username, email, password} = req.body;
  const newUser = new User({email, username});
  const registerUser = await User.register(newUser, password);
  console.log(registerUser);
  req.login(registerUser, (err) => {
    if(err) {
      return next(err);
    }
    req.flash("success", "Welcome to Wanderlust");
    res.redirect("/listings");
  });

  } catch (e) {
    req.flash("error", e.message);
    res.redirect("/signup");
  }
}) 

//login user
app.get("/login", (req, res) => {
  res.render("users/login.ejs")
})

//login route
app.post("/login",
saveRedirectUrl,
passport.authenticate("local", {
  failureRedirect: "/login",
  failureFlash: true,
}),
 async(req, res) => {
  req.flash("success", "Welcome back to Wanderlust")
  let redirectUrl = res.locals.redirectUrl || "/listings"
  res.redirect(redirectUrl);
})

//logout route
app.get("/logout", (req, res, next) => {
  req.logout((err) => {
    if(err) { 
      return next(err);
    }
    req.flash("success", "you are logged out!")
    res.redirect("/listings");
  });
});

//Index Route
app.get("/listings", async (req, res) => {
  const allListings = await Listing.find({});
  res.render("listings/index.ejs", { allListings });
});

//New Route
app.get("/listings/new",isLoggedIn,(req, res) => {
  res.render("listings/new.ejs");
});

//Show Route
app.get("/listings/:id", async (req, res) => {
  let { id } = req.params;
  const listing = await Listing.findById(id)
  .populate({
    path: "reviews", 
  populate: {
    path:"author",
  },
})
  .populate("owner");
  if(!listing) {
    req.flash("error", "Listing you requested for does not exist!")
    res.redirect("/listings");
  }
  res.render("listings/show.ejs", { listing });
});

//Create Route
app.post("/listings",isLoggedIn, async (req, res) => {
  let response = await geocodingClient
  .forwardGeocode({
    query: req.body.listing.location,
    limit: 1,
  })
    .send();
  const newListing = new Listing(req.body.listing);

  newListing.owner = req.user._id;

  newListing.geometry = response.body.features[0].geometry;

 let savedListing = await newListing.save();
 console.log(savedListing);

  req.flash("success", "New Listing Created");
  res.redirect("/listings");

});

// console.log(coordinates)
// const marker = new mapboxgl.Marker()
// .setLangLat(coordinates)
// .addTo(map);

//Edit Route
app.get("/listings/:id/edit",isLoggedIn,
isOwner, 
async (req, res) => {
  let { id } = req.params;
  const listing = await Listing.findById(id);
  res.render("listings/edit.ejs", { listing });
});

//Update Route
app.put("/listings/:id",isLoggedIn,
isOwner,
 async (req, res) => {
  let { id } = req.params;
  await Listing.findByIdAndUpdate(id, { ...req.body.listing });
  req.flash("success", "Listing Updated");
  res.redirect(`/listings/${id}`);
});

//Delete Route
app.delete("/listings/:id",isLoggedIn, 
isOwner,
async (req, res) => {
  let { id } = req.params;
  let deletedListing = await Listing.findByIdAndDelete(id);
  console.log(deletedListing);
  req.flash("success", "Listing Deleted");
  res.redirect("/listings");
});

//Reviews
//Post Reviews Route
app.post("/listings/:id/reviews",
isLoggedIn,
 async(req, res ) => {
  let listing = await Listing.findById(req.params.id);
  let newReview = new Review(req.body.review);
  newReview.author = req.user._id;
  listing.reviews.push(newReview);

  req.flash("success", "New Review Added");
  await newReview.save();
  await listing.save();

  res.redirect(`/listings/${listing._id}`)
})

//Delete Reviews Route

app.delete(
  "/listings/:id/reviews/:reviewId",
  isLoggedIn,
  isReviewAuthor,
   async (req, res) => {
  let {id , reviewId} = req.params;

  req.flash("success", "Review Deleted");
await Listing.findByIdAndUpdate (id, {$pull : {reviews: reviewId}});
await Review.findByIdAndDelete(reviewId);

res.redirect(`/listings/${id}`);

})

// app.get("/testListing", async (req, res) => {
//   let sampleListing = new Listing({
//     title: "My New Villa",
//     description: "By the beach",
//     price: 1200,
//     location: "Calangute, Goa",
//     country: "India",
//   });

//   await sampleListing.save();
//   console.log("sample was saved");
//   res.send("successful testing");
// });

app.listen(8080, () => {
  console.log("server is listening to port 8080");
});