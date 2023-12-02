const express = require("express");
const cors = require("cors");
require("dotenv").config();
const stripe = require("stripe")(process.env.STRIPE_SECRET_KEY);
const { MongoClient, ServerApiVersion, ObjectId } = require("mongodb");

const app = express();
const port = process.env.PORT || 5000;

// middleware
app.use(cors());
app.use(express.json());

const uri = `mongodb+srv://${process.env.DB_USER}:${process.env.DB_PASS}@cluster0.unqmcva.mongodb.net/?retryWrites=true&w=majority`;

const client = new MongoClient(uri, {
  serverApi: {
    version: ServerApiVersion.v1,
    strict: true,
    deprecationErrors: true,
  },
});

async function run() {
  try {
    const mealsCollection = client.db("mealsDB").collection("meals");
    const packageCollection = client.db("mealsDB").collection("premium");
    const usersCollection = client.db("mealsDB").collection("users");
    const upcomingMealsCollection = client
      .db("mealsDB")
      .collection("upcomingMeals");

    const requestedMealsCollection = client
      .db("mealsDB")
      .collection("requestedMeals");
    // Get all meals
    app.get("/meals", async (req, res) => {
      const cursor = mealsCollection.find();
      const result = await cursor.toArray();
      res.send(result);
    });
    // get upcoming meals
    app.get("/upcoming-meals", async (req, res) => {
      const cursor = upcomingMealsCollection.find();
      const result = await cursor.toArray();
      res.send(result);
    });
    //get all users
    app.get("/users", async (req, res) => {
      const cursor = usersCollection.find();
      const result = await cursor.toArray();
      res.send(result);
    });
    //get all requested meals
    app.get("/meals/request", async (req, res) => {
      const cursor = requestedMealsCollection.find();
      const result = await cursor.toArray();
      res.send(result);
    });

    // Get all premium packages
    app.get("/premium", async (req, res) => {
      const cursor = packageCollection.find();
      const result = await cursor.toArray();
      res.send(result);
    });

    app.get("/meals/reviews", async (req, res) => {
      try {
        const { page = 1, limit = 5 } = req.query;

        const reviews = await mealsCollection
          .aggregate([
            {
              $unwind: "$reviews",
            },
            {
              $project: {
                _id: 1,
                title: 1,
                likes: 1,
                reviewUser: "$reviews.user",
                reviewComment: "$reviews.comment",
              },
            },
            {
              $sort: {
                likes: -1,
              },
            },
          ])
          .skip((page - 1) * limit)
          .limit(parseInt(limit))
          .toArray();

        res.json(reviews);
      } catch (error) {
        console.error("Error fetching reviews:", error);
        res.status(500).json({ error: "Internal Server Error" });
      }
    });

    // Get a specific meal by ID
    app.get("/meals/:id", async (req, res) => {
      const id = req.params.id;
      const query = {
        _id: new ObjectId(id),
      };

      const result = await mealsCollection.findOne(query);
      res.send(result);
    });
    // Get a specific packages by Id
    app.get("/premium/:id", async (req, res) => {
      const id = req.params.id;
      const query = {
        _id: new ObjectId(id),
      };

      const result = await packageCollection.findOne(query);
      res.send(result);
    });

    app.get("/users/:email", async (req, res) => {
      const userEmail = req.params.email;

      try {
        const userQuery = { email: userEmail };
        const user = await usersCollection.findOne(userQuery);

        if (!user) {
          return res.status(404).json({ error: "User not found." });
        }

        res.json(user);
      } catch (error) {
        console.error("Error fetching user details:", error);
        res.status(500).json({ error: "Internal server error." });
      }
    });
    app.get("/users/admin/:email", async (req, res) => {
      const userEmail = req.params.email;
      try {
        const userQuery = { email: userEmail };
        const user = await usersCollection.findOne(userQuery);

        if (!user) {
          return res.status(404).json({ error: "User not found." });
        }
        let admin = false;
        if (user) {
          admin = user?.role === "admin";
        }

        res.send({ admin });
      } catch (error) {
        console.error("Error fetching user details:", error);
        res.status(500).json({ error: "Internal server error." });
      }
    });

    app.get("/meals/request-multiple/:email", async (req, res) => {
      const userEmail = req.params.email;

      try {
        const query = { "userData.email": userEmail };
        const requestedMeals = await requestedMealsCollection
          .find(query)
          .toArray();

        res.json(requestedMeals);
      } catch (error) {
        console.error("Error fetching requested meals:", error);
        res.status(500).json({ error: "Internal server error." });
      }
    });

    app.get("/meals/user-reviews/:email", async (req, res) => {
      const userEmail = req.params.email;

      try {
        const reviews = await mealsCollection
          .find({ reviews: { $elemMatch: { email: userEmail } } })
          .toArray();
        res.json(reviews);
      } catch (error) {
        console.error("Error fetching user reviews:", error);
        res.status(500).json({ error: "Internal server error." });
      }
    });

    app.get("/meals/reviews", async (req, res) => {
      try {
        const cursor = mealsCollection.aggregate([
          { $unwind: "$reviews" },
          { $project: { review: "$reviews" } },
        ]);

        const reviews = await cursor.toArray();
        res.json(reviews);
      } catch (error) {
        console.error("Error fetching meal reviews:", error);
        res.status(500).json({ error: "Internal server error." });
      }
    });

    // Update likes for a specific meal by ID
    app.put("/meals/like/:id", async (req, res) => {
      const id = req.params.id;

      try {
        const query = { _id: new ObjectId(id) };
        const update = { $inc: { likes: 1 } };

        const result = await mealsCollection.updateOne(query, update);

        if (result.modifiedCount > 0) {
          res.json({ success: true, message: "Like updated successfully." });
        } else {
          res.status(404).json({ success: false, message: "Meal not found." });
        }
      } catch (error) {
        console.error(error);
        res
          .status(500)
          .json({ success: false, message: "Internal server error." });
      }
    });

    app.put("/meals/:id", async (req, res) => {
      try {
        const id = req.params.id;
        const query = { _id: new ObjectId(id) };

        const updatedMeals = req.body;
        // console.log(updatedJobs);
        delete updatedMeals["_id"];

        const result = await mealsCollection.updateOne(
          query,
          {
            $set: { ...updatedMeals },
          },
          { upsert: true }
        );
        console.log(result);
        if (result.modifiedCount === 1) {
          // Product updated successfully
          res.status(200).json({ message: "Product updated successfully" });
        } else {
          // No product was updated (ID not found)
          res.status(404).json({ message: "Product not found" });
        }
      } catch (error) {
        console.error("Error updating product:", error);
        res.status(500).json({ message: "Internal server error" });
      }
    });

    app.put("/meals/request/:id", async (req, res) => {
      const requestId = req.params.id;

      try {
        // Check if the meal with the specified ID exists
        const meal = await requestedMealsCollection.findOne({
          _id: new ObjectId(requestId),
        });

        if (!meal) {
          return res.status(404).json({
            success: false,
            message: "Meal request not found.",
          });
        }

        // Check if the meal is already delivered
        if (meal.requestStatus === "Delivered") {
          return res.json({
            success: false,
            message: "Meal is already served.",
          });
        }

        // Update the status of the meal to "Delivered"
        const result = await requestedMealsCollection.updateOne(
          { _id: new ObjectId(requestId) },
          { $set: { requestStatus: "Delivered" } }
        );

        if (result.modifiedCount > 0) {
          res.json({
            success: true,
            message: "Meal served successfully.",
          });
        } else {
          res.status(500).json({
            success: false,
            message: "Failed to serve meal. Please try again.",
          });
        }
      } catch (error) {
        console.error("Error serving meal:", error);
        res.status(500).json({
          success: false,
          message: "Internal server error. Please try again later.",
        });
      }
    });

    app.patch("/meals/review/:id", async (req, res) => {
      const mealId = req.params.id;
      const { email, user, comment } = req.body;

      try {
        const query = { _id: new ObjectId(mealId), "reviews.email": email };
        const update = {
          $set: {
            "reviews.$.user": user,
            "reviews.$.comment": comment,
          },
        };

        const result = await mealsCollection.updateOne(query, update);

        if (result.modifiedCount > 0) {
          res.json({ success: true, message: "Review updated successfully." });
        } else {
          res
            .status(404)
            .json({ success: false, message: "Review not found." });
        }
      } catch (error) {
        console.error(error);
        res
          .status(500)
          .json({ success: false, message: "Internal server error." });
      }
    });
    app.patch("/users/admin/:id", async (req, res) => {
      const id = req.params.id;
      const filter = { _id: new ObjectId(id) };
      const updatedDoc = {
        $set: {
          role: "admin",
        },
      };
      const result = await usersCollection.updateOne(filter, updatedDoc);
      res.send(result);
    });

    app.post("/meals", async (req, res) => {
      try {
        const newMeal = req.body;
        const result = await mealsCollection.insertOne(newMeal);

        if (result.insertedId) {
          res.status(201).json({
            success: true,
            message: "Meal added successfully.",
            insertedId: result.insertedId,
          });
        } else {
          res.status(500).json({
            success: false,
            message: "Failed to add meal. Please try again.",
          });
        }
      } catch (error) {
        console.error("Error adding meal:", error);
        res.status(500).json({
          success: false,
          message: "Internal server error. Please try again later.",
        });
      }
    });
    // upcoming meals
    app.post("/upcoming-meals", async (req, res) => {
      try {
        const newUpcomingMeal = req.body;
        const result = await upcomingMealsCollection.insertOne(newUpcomingMeal);

        if (result.insertedId) {
          res.status(201).json({
            success: true,
            message: "Upcoming meal added successfully.",
            insertedId: result.insertedId,
          });
        } else {
          res.status(500).json({
            success: false,
            message: "Failed to add upcoming meal. Please try again.",
          });
        }
      } catch (error) {
        console.error("Error adding upcoming meal:", error);
        res.status(500).json({
          success: false,
          message: "Internal server error. Please try again later.",
        });
      }
    });
    app.post("/upcoming-meals/:mealId/like", async (req, res) => {
      try {
        const mealId = req.params.mealId;

        // Fetch the meal from the database based on the mealId
        const meal = await upcomingMealsCollection.findOne({
          _id: new ObjectId(mealId),
        });

        if (!meal) {
          return res.status(404).json({
            success: false,
            message: "Meal not found.",
          });
        }

        // Increment the likes count
        const updatedLikes = meal.likes + 1;

        // Update the likes count in the database
        const result = await upcomingMealsCollection.updateOne(
          { _id: new ObjectId(mealId) },
          { $set: { likes: updatedLikes } }
        );

        if (result.modifiedCount > 0) {
          res.status(200).json({
            success: true,
            message: "Like added successfully.",
            likes: updatedLikes,
          });
        } else {
          res.status(500).json({
            success: false,
            message: "Failed to add like. Please try again.",
          });
        }
      } catch (error) {
        console.error("Error adding like:", error);
        res.status(500).json({
          success: false,
          message: "Internal server error. Please try again later.",
        });
      }
    });

    app.post("/reviews/byUser", async (req, res) => {
      const { mealId, user, email, comment } = req.body;

      try {
        const query = { _id: new ObjectId(mealId) };
        const update = { $push: { reviews: { email, user, comment } } };

        const result = await mealsCollection.updateOne(query, update);

        if (result.modifiedCount > 0) {
          res.json({ success: true, message: "Review added successfully." });
        } else {
          res.status(404).json({ success: false, message: "Meal not found." });
        }
      } catch (error) {
        console.error(error);
        res
          .status(500)
          .json({ success: false, message: "Internal server error." });
      }
    });
    app.post("/users", async (req, res) => {
      try {
        const userData = req.body;
        const query = { email: userData.email };
        const existingUser = await usersCollection.findOne(query);
        if (existingUser) {
          return res.send({
            message: "user already exists",
            instertedId: null,
          });
        }

        // Save user information to the users collection
        const result = await usersCollection.insertOne({
          ...userData,
          badge: "Bronze", // Add the default badge here
        });

        // Check if the user was inserted successfully
        if (result.insertedCount > 0) {
          res.json({ success: true, message: "User registered successfully." });
        } else {
          res
            .status(500)
            .json({ success: false, message: "Failed to register user." });
        }
      } catch (error) {
        console.error("Error during user registration:", error);
        res
          .status(500)
          .json({ success: false, message: "Internal server error." });
      }
    });

    app.post("/create-payment-intent", async (req, res) => {
      let { amount, currency, userEmail, packageType } = req.body;

      try {
        // Create a PaymentIntent with the order amount and currency
        const paymentIntent = await stripe.paymentIntents.create({
          amount,
          currency,
        });

        // Send the PaymentIntent ID to the client
        res.json({ clientSecret: paymentIntent.client_secret });

        // After successful payment, assign the badge based on the package type
        const userQuery = { email: userEmail };
        const user = await usersCollection.findOne(userQuery);

        if (!user) {
          console.error("User not found:", userEmail);
          return;
        }

        let badge = "";

        switch (packageType) {
          case "Bronze":
            badge = "Bronze";
            break;
          case "Silver":
            badge = "Silver";
            break;
          case "Gold":
            badge = "Gold";
            break;
          case "Platinum":
            badge = "Platinum";
            break;
          // Add more cases for other package types if needed
          default:
            break;
        }

        // Update the user's badge in your database
        await usersCollection.updateOne(userQuery, { $set: { badge } });
      } catch (error) {
        console.error("Error creating PaymentIntent:", error);
        res.status(500).json({ error: "Internal Server Error" });
      }
    });

    app.post("/meals/request-multiple", async (req, res) => {
      const { meals, userData } = req.body;

      try {
        const response = await requestedMealsCollection.insertOne({
          meals,
          userData,
          requestStatus: "Pending",
        });

        if (response.insertedId) {
          res.json({
            success: true,
            message: "Meal request sent successfully!",
          });
        } else {
          res.status(500).json({
            success: false,
            message: "Failed to send meal request.",
          });
        }
      } catch (error) {
        console.error(error);
        res.status(500).json({
          success: false,
          message: "Internal server error.",
        });
      }
    });

    app.delete("/meals/request-multiple/:id", async (req, res) => {
      const requestId = req.params.id;

      try {
        const result = await requestedMealsCollection.deleteOne({
          _id: new ObjectId(requestId),
        });

        if (result.deletedCount > 0) {
          res.json({
            success: true,
            message: "Meal request canceled successfully.",
          });
        } else {
          res
            .status(404)
            .json({ success: false, message: "Meal request not found." });
        }
      } catch (error) {
        console.error("Error canceling meal request:", error);
        res
          .status(500)
          .json({ success: false, message: "Internal server error." });
      }
    });

    app.delete("/meals/review/:id", async (req, res) => {
      const mealId = req.params.id;
      const email = req.body.email;
      const user = req.body.user;

      try {
        const result = await mealsCollection.updateOne(
          { _id: new ObjectId(mealId) },
          { $pull: { reviews: { email: email } } }
        );

        if (result.modifiedCount > 0) {
          res.json({ success: true, message: "Review deleted successfully." });
        } else {
          res
            .status(404)
            .json({ success: false, message: "Review not found." });
        }
      } catch (error) {
        console.error(error);
        res
          .status(500)
          .json({ success: false, message: "Internal server error." });
      }
    });

    app.delete("/meals/:id", async (req, res) => {
      try {
        const mealId = req.params.id;

        // Perform any additional checks here if needed before deletion

        const result = await mealsCollection.deleteOne({
          _id: new ObjectId(mealId),
        });

        if (result.deletedCount === 1) {
          res.status(200).json({
            success: true,
            message: "Meal deleted successfully.",
          });
        } else {
          res.status(404).json({
            success: false,
            message: "Meal not found.",
          });
        }
      } catch (error) {
        console.error("Error deleting meal:", error);
        res.status(500).json({
          success: false,
          message: "Internal server error. Please try again later.",
        });
      }
    });

    // DELETE endpoint to delete a review by mealId and comment
    app.delete("/meals/reviews/:mealId", async (req, res) => {
      try {
        const { mealId } = req.params;
        const { comment } = req.body;

        // Convert mealId to ObjectId
        const mealObjectId = new ObjectId(mealId);

        // Update the reviews in the database
        const result = await mealsCollection.updateOne(
          { _id: mealObjectId },
          { $pull: { reviews: { comment } } }
        );

        if (result.modifiedCount === 0) {
          return res.status(404).json({ error: "Review not found" });
        }

        res.json({ message: "Review deleted successfully" });
      } catch (error) {
        console.error("Error deleting review:", error);
        res.status(500).json({ error: "Internal Server Error" });
      }
    });

    app.get("/upcoming-meals", async (req, res) => {
      try {
        // Get all upcoming meals
        const cursor = upcomingMealsCollection.find();
        const upcomingMeals = await cursor.toArray();

        // Sort upcoming meals based on likes count (descending order)
        upcomingMeals.sort((a, b) => b.likes - a.likes);

        res.json(upcomingMeals);
      } catch (error) {
        console.error("Error fetching upcoming meals:", error);
        res.status(500).json({
          success: false,
          message: "Internal server error. Please try again later.",
        });
      }
    });

    app.put("/upcoming-meals/publish/:id", async (req, res) => {
      const mealId = req.params.id;

      try {
        // Check if the upcoming meal with the specified ID exists
        const upcomingMeal = await upcomingMealsCollection.findOne({
          _id: new ObjectId(mealId),
        });

        if (!upcomingMeal) {
          return res.status(404).json({
            success: false,
            message: "Upcoming meal not found.",
          });
        }

        // Check if the meal has at least 10 likes
        if (upcomingMeal.likes < 10) {
          return res.json({
            success: false,
            message: "Meal needs at least 10 likes to be published.",
          });
        }

        // Add the upcoming meal to the all-meals collection
        const result = await mealsCollection.insertOne(upcomingMeal);

        if (result.insertedId) {
          // Remove the published upcoming meal from the upcoming-meals collection
          await upcomingMealsCollection.deleteOne({
            _id: new ObjectId(mealId),
          });

          res.json({
            success: true,
            message: "Meal published successfully.",
          });
        } else {
          res.status(500).json({
            success: false,
            message: "Failed to publish meal. Please try again.",
          });
        }
      } catch (error) {
        console.error("Error publishing meal:", error);
        res.status(500).json({
          success: false,
          message: "Internal server error. Please try again later.",
        });
      }
    });

    console.log(
      "Pinged your deployment. You successfully connected to MongoDB!"
    );
  } finally {
    // Ensures that the client will close when you finish/error
    // await client.close();
  }
}

run().catch(console.dir);

app.get("/", (req, res) => {
  res.send("Meal Mate Server is running");
});

app.listen(port, () => {
  console.log(`Meal Mate Server is running on port: ${port}`);
});
